CREATE TABLE IF NOT EXISTS decks (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    format     TEXT NOT NULL DEFAULT 'standard',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS deck_entries (
    id       TEXT PRIMARY KEY,
    deck_id  TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
    card_id  TEXT NOT NULL,
    name     TEXT NOT NULL,
    set_code TEXT NOT NULL,
    number   TEXT NOT NULL,
    count    INTEGER NOT NULL DEFAULT 1,
    section  TEXT NOT NULL CHECK(section IN ('pokemon','trainer','energy')),
    position INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_deck_entries_deck_id ON deck_entries(deck_id);
