-- Covers are read through decks so they stay scoped by user_id; writes go
-- through the service, which checks deck ownership and entry membership first.

-- name: ListCoversByUser :many
SELECT c.deck_id, sqlc.embed(e)
FROM deck_covers c
JOIN decks d ON d.id = c.deck_id
JOIN deck_entries e ON e.id = c.entry_id
WHERE d.user_id = ?
ORDER BY c.deck_id, c.slot;

-- name: ListCoversByDeck :many
SELECT sqlc.embed(e)
FROM deck_covers c
JOIN deck_entries e ON e.id = c.entry_id
WHERE c.deck_id = ?
ORDER BY c.slot;

-- name: DeleteCoversByDeck :exec
DELETE FROM deck_covers WHERE deck_id = ?;

-- name: InsertCover :exec
INSERT INTO deck_covers (deck_id, slot, entry_id) VALUES (?, ?, ?);
