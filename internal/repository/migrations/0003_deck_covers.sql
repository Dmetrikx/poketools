-- The (up to) two cards shown for a deck. A cover goes away with its entry,
-- and the client falls back to its default pick for the empty slot.
CREATE TABLE deck_covers (
    deck_id  TEXT    NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
    slot     INTEGER NOT NULL CHECK (slot IN (0, 1)),
    entry_id TEXT    NOT NULL REFERENCES deck_entries(id) ON DELETE CASCADE,
    PRIMARY KEY (deck_id, slot)
);
CREATE INDEX idx_deck_covers_entry_id ON deck_covers(entry_id);
