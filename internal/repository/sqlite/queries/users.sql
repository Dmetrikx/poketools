-- name: CreateUser :exec
INSERT INTO users (id, email, password_hash, created_at)
VALUES (?, ?, ?, ?);

-- name: GetUserByEmail :one
SELECT id, email, password_hash, created_at
FROM users
WHERE email = ?;
