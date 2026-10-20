-- Multi-user accounts: every deck now belongs to a user.

CREATE TABLE users (
    id            TEXT    PRIMARY KEY,
    email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT    NOT NULL,
    created_at    INTEGER NOT NULL
);

-- id is sha256(token), hex-encoded. The raw token only ever exists in the
-- client's cookie, so a leaked database can't be replayed as live sessions.
CREATE TABLE sessions (
    id         TEXT    PRIMARY KEY,
    user_id    TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- SQLite can't ADD a NOT NULL foreign-key column to an existing table, and
-- decks created before accounts have no owner to assign, so they are
-- discarded (agreed) and both tables recreated with ownership.
DROP TABLE deck_entries;
DROP TABLE decks;

CREATE TABLE decks (
    id         TEXT    PRIMARY KEY,
    user_id    TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       TEXT    NOT NULL,
    format     TEXT    NOT NULL DEFAULT 'standard',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX idx_decks_user_id_updated_at ON decks(user_id, updated_at);

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
