-- name: CreateSession :exec
INSERT INTO sessions (id, user_id, created_at, expires_at)
VALUES (?, ?, ?, ?);

-- name: GetSessionUser :one
SELECT u.id, u.email, u.created_at
FROM sessions s
JOIN users u ON u.id = s.user_id
WHERE s.id = ? AND s.expires_at > ?;

-- name: DeleteSession :exec
DELETE FROM sessions WHERE id = ?;

-- name: DeleteExpiredSessions :execrows
DELETE FROM sessions WHERE expires_at <= ?;
