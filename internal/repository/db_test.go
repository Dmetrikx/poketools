package repository

import (
	"context"
	"database/sql"
	"path/filepath"
	"sync"
	"testing"
)

func openTemp(t *testing.T) *sql.DB {
	t.Helper()
	db, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	return db
}

func TestMigrate_FreshDatabase(t *testing.T) {
	db := openTemp(t)

	if err := Migrate(db, nil); err != nil {
		t.Fatalf("Migrate: %v", err)
	}

	// Every table the app depends on must exist after a single migrate.
	for _, table := range []string{"users", "sessions", "decks", "deck_entries"} {
		var name string
		err := db.QueryRow(
			`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`, table,
		).Scan(&name)
		if err != nil {
			t.Errorf("table %q missing after migrate: %v", table, err)
		}
	}
}

func TestMigrate_IsIdempotent(t *testing.T) {
	db := openTemp(t)

	if err := Migrate(db, nil); err != nil {
		t.Fatalf("first Migrate: %v", err)
	}

	var before int
	if err := db.QueryRow(`SELECT COUNT(*) FROM schema_migrations`).Scan(&before); err != nil {
		t.Fatalf("count migrations: %v", err)
	}

	if err := Migrate(db, nil); err != nil {
		t.Fatalf("second Migrate: %v", err)
	}

	var after int
	if err := db.QueryRow(`SELECT COUNT(*) FROM schema_migrations`).Scan(&after); err != nil {
		t.Fatalf("count migrations: %v", err)
	}
	if before != after {
		t.Errorf("re-running Migrate changed applied count: %d -> %d", before, after)
	}
	if before == 0 {
		t.Error("no migrations were recorded")
	}
}

func TestMigrate_RejectsModifiedMigration(t *testing.T) {
	db := openTemp(t)

	if err := Migrate(db, nil); err != nil {
		t.Fatalf("Migrate: %v", err)
	}

	// Simulate someone editing an already-applied migration file.
	if _, err := db.Exec(
		`UPDATE schema_migrations SET checksum = 'deadbeefdeadbeef' WHERE version = 1`,
	); err != nil {
		t.Fatalf("tamper: %v", err)
	}

	if err := Migrate(db, nil); err == nil {
		t.Fatal("expected Migrate to reject a modified migration, got nil")
	}
}

// TestOpen_PragmasApplyToEveryPooledConnection guards against setting the
// pragmas with db.Exec, which runs on one pooled connection. foreign_keys and busy_timeout are per-connection, so every
// other connection database/sql opened under load ran with SQLite's defaults.
// A single-connection test could never see it — the pool has to be forced
// open concurrently.
func TestOpen_PragmasApplyToEveryPooledConnection(t *testing.T) {
	db := openTemp(t)

	const conns = 8
	db.SetMaxOpenConns(conns)

	var wg sync.WaitGroup
	results := make([]string, conns)
	start := make(chan struct{})

	for i := range conns {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			c, err := db.Conn(context.Background())
			if err != nil {
				results[i] = "conn error: " + err.Error()
				return
			}
			defer c.Close()

			<-start // hold every connection at once so the pool must grow

			var fk, journal, busy string
			if err := c.QueryRowContext(context.Background(), `PRAGMA foreign_keys`).Scan(&fk); err != nil {
				results[i] = "scan error: " + err.Error()
				return
			}
			c.QueryRowContext(context.Background(), `PRAGMA journal_mode`).Scan(&journal) //nolint:errcheck
			c.QueryRowContext(context.Background(), `PRAGMA busy_timeout`).Scan(&busy)    //nolint:errcheck
			results[i] = fk + "/" + journal + "/" + busy
		}(i)
	}
	close(start)
	wg.Wait()

	for i, got := range results {
		if got != "1/wal/5000" {
			t.Errorf("connection %d has pragmas %q, want \"1/wal/5000\"", i, got)
		}
	}
}

func TestMigrate_ForeignKeysEnforced(t *testing.T) {
	db := openTemp(t)
	if err := Migrate(db, nil); err != nil {
		t.Fatalf("Migrate: %v", err)
	}

	_, err := db.Exec(
		`INSERT INTO deck_entries (id, deck_id, card_id, name, set_code, number, section)
		 VALUES ('e1', 'ghost', 'c1', 'Pikachu', 'SVI', '1', 'pokemon')`,
	)
	if err == nil {
		t.Fatal("expected foreign key violation, insert succeeded")
	}
}

// Databases created before the migration runner have the old DATETIME schema
// and no schema_migrations table. The baseline migration must replace it.
func TestMigrate_ReplacesPreRunnerSchema(t *testing.T) {
	db := openTemp(t)
	if _, err := db.Exec(`
		CREATE TABLE decks (
			id TEXT PRIMARY KEY, name TEXT NOT NULL, format TEXT NOT NULL DEFAULT 'standard',
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		);
		CREATE TABLE deck_entries (
			id TEXT PRIMARY KEY, deck_id TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
			card_id TEXT NOT NULL, name TEXT NOT NULL, set_code TEXT NOT NULL, number TEXT NOT NULL,
			count INTEGER NOT NULL DEFAULT 1, section TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0
		);
		INSERT INTO decks (id, name) VALUES ('old', 'Old Deck');
		INSERT INTO deck_entries (id, deck_id, card_id, name, set_code, number, section)
			VALUES ('e1', 'old', 'c1', 'Pikachu', 'SVI', '1', 'pokemon');
	`); err != nil {
		t.Fatalf("seed old schema: %v", err)
	}

	if err := Migrate(db, nil); err != nil {
		t.Fatalf("Migrate: %v", err)
	}

	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM decks`).Scan(&n); err != nil {
		t.Fatalf("count decks: %v", err)
	}
	if n != 0 {
		t.Errorf("old decks survived migration: %d rows", n)
	}

	var colType string
	if err := db.QueryRow(
		`SELECT type FROM pragma_table_info('decks') WHERE name = 'created_at'`,
	).Scan(&colType); err != nil {
		t.Fatalf("read column type: %v", err)
	}
	if colType != "INTEGER" {
		t.Errorf("decks.created_at type = %q, want INTEGER", colType)
	}
}
