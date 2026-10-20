-- Every deck query is scoped by user_id: a deck that belongs to someone else
-- must be indistinguishable from one that doesn't exist.

-- name: ListDecks :many
SELECT id, user_id, name, format, created_at, updated_at
FROM decks
WHERE user_id = ?
ORDER BY updated_at DESC;

-- name: GetDeck :one
SELECT id, user_id, name, format, created_at, updated_at
FROM decks
WHERE id = ? AND user_id = ?;

-- name: CreateDeck :exec
INSERT INTO decks (id, user_id, name, format, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?);

-- name: UpdateDeck :execrows
UPDATE decks
SET name = ?, format = ?, updated_at = ?
WHERE id = ? AND user_id = ?;

-- name: DeleteDeck :execrows
DELETE FROM decks WHERE id = ? AND user_id = ?;
