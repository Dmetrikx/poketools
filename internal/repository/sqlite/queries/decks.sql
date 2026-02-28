-- name: ListDecks :many
SELECT id, name, format, created_at, updated_at
FROM decks
ORDER BY updated_at DESC;

-- name: GetDeck :one
SELECT id, name, format, created_at, updated_at
FROM decks
WHERE id = ?;

-- name: CreateDeck :exec
INSERT INTO decks (id, name, format, created_at, updated_at)
VALUES (?, ?, ?, ?, ?);

-- name: UpdateDeck :exec
UPDATE decks
SET name = ?, format = ?, updated_at = ?
WHERE id = ?;

-- name: DeleteDeck :exec
DELETE FROM decks WHERE id = ?;
