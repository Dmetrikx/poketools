-- Baseline schema for the migration runner.
--
-- Databases created before the runner existed have decks/deck_entries but no
-- schema_migrations row, so this migration would otherwise no-op on them via
-- IF NOT EXISTS and leave the old DATETIME columns in place. They are dropped
-- instead: pre-runner data was agreed to be disposable.
DROP TABLE IF EXISTS deck_entries;
DROP TABLE IF EXISTS decks;

-- Timestamps are INTEGER epoch milliseconds (UTC).
CREATE TABLE decks (
    id         TEXT    PRIMARY KEY,
    name       TEXT    NOT NULL,
    format     TEXT    NOT NULL DEFAULT 'standard',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE deck_entries (
    id        TEXT    PRIMARY KEY,
    deck_id   TEXT    NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
    card_id   TEXT    NOT NULL,
    name      TEXT    NOT NULL,
    set_code  TEXT    NOT NULL,
    number    TEXT    NOT NULL,
    count     INTEGER NOT NULL DEFAULT 1,
    section   TEXT    NOT NULL CHECK (section IN ('pokemon', 'trainer', 'energy')),
    position  INTEGER NOT NULL DEFAULT 0,
    image_url TEXT    NOT NULL DEFAULT ''
);

CREATE INDEX idx_deck_entries_deck_id ON deck_entries(deck_id);
