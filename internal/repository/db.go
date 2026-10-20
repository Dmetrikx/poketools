// Package repository owns the database connection and the schema migration
// runner.
//
// Migrations are numbered SQL files in migrations/, embedded into the binary
// and applied in order inside individual transactions. Applied versions are
// recorded in schema_migrations along with a checksum, so an edit to a
// migration that has already run is a startup error rather than a silent
// divergence between environments.
package repository

import (
	"crypto/sha256"
	"database/sql"
	"embed"
	"encoding/hex"
	"fmt"
	"io/fs"
	"log/slog"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

//go:embed migrations/*.sql
var migrationFS embed.FS

// Open opens the SQLite database at the given path with WAL journaling,
// foreign key enforcement, and a busy timeout.
//
// The pragmas go in the DSN, NOT through db.Exec. `foreign_keys` and
// `busy_timeout` are per-connection settings, and database/sql keeps a pool:
// running them as a statement configures whichever single connection happened
// to serve it and leaves every other one at SQLite's defaults (foreign keys
// OFF, no busy timeout). In the DSN, the driver applies them to each new
// connection as it is opened.
func Open(path string) (*sql.DB, error) {
	dsn := "file:" + url.PathEscape(path) +
		"?_pragma=journal_mode(WAL)" +
		"&_pragma=foreign_keys(1)" +
		// Without a busy timeout, SQLite returns SQLITE_BUSY the instant two
		// writers overlap (e.g. concurrent requests, or the session cleanup
		// ticker) instead of waiting for the lock.
		"&_pragma=busy_timeout(5000)"

	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("open db %s: %w", path, err)
	}

	return db, nil
}

type migration struct {
	version  int
	name     string
	sql      string
	checksum string
}

// Migrate applies every pending migration. It is safe to call on every start:
// already-applied versions are skipped.
func Migrate(db *sql.DB, logger *slog.Logger) error {
	if _, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version    INTEGER PRIMARY KEY,
			name       TEXT    NOT NULL,
			checksum   TEXT    NOT NULL,
			applied_at INTEGER NOT NULL
		)`); err != nil {
		return fmt.Errorf("create schema_migrations: %w", err)
	}

	available, err := loadMigrations()
	if err != nil {
		return err
	}

	applied, err := appliedMigrations(db)
	if err != nil {
		return err
	}

	for _, m := range available {
		if prior, ok := applied[m.version]; ok {
			if prior != m.checksum {
				return fmt.Errorf(
					"migration %04d_%s was modified after it was applied (recorded %s, found %s): "+
						"migrations are immutable — add a new one instead",
					m.version, m.name, prior[:8], m.checksum[:8])
			}
			continue
		}

		if err := applyMigration(db, m); err != nil {
			return err
		}
		if logger != nil {
			logger.Info("applied migration", "version", m.version, "name", m.name)
		}
	}

	return nil
}

func applyMigration(db *sql.DB, m migration) error {
	tx, err := db.Begin()
	if err != nil {
		return fmt.Errorf("migration %04d: begin: %w", m.version, err)
	}
	defer tx.Rollback() //nolint:errcheck // no-op after a successful commit

	if _, err := tx.Exec(m.sql); err != nil {
		return fmt.Errorf("migration %04d_%s: %w", m.version, m.name, err)
	}
	if _, err := tx.Exec(
		`INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES (?, ?, ?, ?)`,
		m.version, m.name, m.checksum, time.Now().UnixMilli(),
	); err != nil {
		return fmt.Errorf("migration %04d: record: %w", m.version, err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("migration %04d: commit: %w", m.version, err)
	}
	return nil
}

// loadMigrations reads and sorts the embedded migration files, rejecting
// malformed names and duplicate version numbers.
func loadMigrations() ([]migration, error) {
	entries, err := fs.ReadDir(migrationFS, "migrations")
	if err != nil {
		return nil, fmt.Errorf("read migrations dir: %w", err)
	}

	out := make([]migration, 0, len(entries))
	seen := make(map[int]string, len(entries))

	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".sql") {
			continue
		}

		base := strings.TrimSuffix(e.Name(), ".sql")
		numPart, namePart, ok := strings.Cut(base, "_")
		if !ok {
			return nil, fmt.Errorf("migration %q: expected NNNN_name.sql", e.Name())
		}
		version, err := strconv.Atoi(numPart)
		if err != nil {
			return nil, fmt.Errorf("migration %q: %q is not a version number", e.Name(), numPart)
		}
		if prior, dup := seen[version]; dup {
			return nil, fmt.Errorf("migration version %d used twice: %s and %s", version, prior, e.Name())
		}
		seen[version] = e.Name()

		body, err := migrationFS.ReadFile("migrations/" + e.Name())
		if err != nil {
			return nil, fmt.Errorf("read migration %q: %w", e.Name(), err)
		}
		sum := sha256.Sum256(body)

		out = append(out, migration{
			version:  version,
			name:     namePart,
			sql:      string(body),
			checksum: hex.EncodeToString(sum[:]),
		})
	}

	sort.Slice(out, func(i, j int) bool { return out[i].version < out[j].version })
	return out, nil
}

func appliedMigrations(db *sql.DB) (map[int]string, error) {
	rows, err := db.Query(`SELECT version, checksum FROM schema_migrations`)
	if err != nil {
		return nil, fmt.Errorf("read schema_migrations: %w", err)
	}
	defer rows.Close()

	applied := make(map[int]string)
	for rows.Next() {
		var version int
		var checksum string
		if err := rows.Scan(&version, &checksum); err != nil {
			return nil, fmt.Errorf("scan schema_migrations: %w", err)
		}
		applied[version] = checksum
	}
	return applied, rows.Err()
}
