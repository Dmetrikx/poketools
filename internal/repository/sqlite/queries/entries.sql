-- Entry mutations are scoped by deck_id; the service verifies the caller owns
-- the deck first, so together they keep entries per-user.

-- name: ListEntriesByDeck :many
SELECT id, deck_id, card_id, name, set_code, number, count, section, position, image_url
FROM deck_entries
WHERE deck_id = ?
ORDER BY section, position;

-- name: GetEntry :one
SELECT id, deck_id, card_id, name, set_code, number, count, section, position, image_url
FROM deck_entries
WHERE id = ?;

-- name: CreateEntry :exec
INSERT INTO deck_entries (id, deck_id, card_id, name, set_code, number, count, section, position, image_url)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);

-- name: UpdateEntryCount :execrows
UPDATE deck_entries
SET count = ?
WHERE id = ? AND deck_id = ?;

-- name: UpdateEntryImageUrl :execrows
UPDATE deck_entries
SET image_url = ?
WHERE id = ? AND deck_id = ?;

-- name: DeleteEntry :execrows
DELETE FROM deck_entries WHERE id = ? AND deck_id = ?;

-- name: DeleteEntriesByDeck :exec
DELETE FROM deck_entries WHERE deck_id = ?;

-- name: UpsertEntry :exec
INSERT INTO deck_entries (id, deck_id, card_id, name, set_code, number, count, section, position, image_url)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET count = excluded.count, position = excluded.position;
