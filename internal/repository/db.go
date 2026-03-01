package repository

import (
	"database/sql"
	_ "embed"
	"fmt"
	"strings"

	_ "modernc.org/sqlite"
)

//go:embed sqlite/schema.sql
var schema string

// Open opens the SQLite database at the given path and applies the schema.
func Open(path string) (*sql.DB, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}

	// Enable WAL mode and foreign key support.
	if _, err = db.Exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;`); err != nil {
		return nil, fmt.Errorf("db pragmas: %w", err)
	}

	return db, nil
}

// Migrate applies the embedded schema DDL and any incremental migrations.
func Migrate(db *sql.DB) error {
	if _, err := db.Exec(schema); err != nil {
		return fmt.Errorf("migrate: %w", err)
	}

	// Add image_url column for existing databases (idempotent).
	_, err := db.Exec(`ALTER TABLE deck_entries ADD COLUMN image_url TEXT NOT NULL DEFAULT ''`)
	if err != nil && !strings.Contains(err.Error(), "duplicate column") {
		return fmt.Errorf("migrate image_url: %w", err)
	}

	return nil
}
