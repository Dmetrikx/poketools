// Package auth implements multi-user accounts: email/password signup and
// login, and opaque server-side session tokens. Only a hash of each token is
// stored, so the database alone can't be used to impersonate anyone.
package auth

import (
	"context"
	"errors"
	"time"
)

const (
	// SessionTTL is how long a session stays valid after login.
	SessionTTL = 30 * 24 * time.Hour

	minPasswordLen = 8
	// bcrypt ignores everything past 72 bytes; reject longer passwords
	// rather than silently truncating them.
	maxPasswordLen = 72
)

var (
	// ErrInvalidCredentials is returned for any login failure. The message is
	// deliberately generic — it never reveals whether the email or the
	// password was wrong.
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrInvalidEmail       = errors.New("invalid email address")
	ErrWeakPassword       = errors.New("password must be between 8 and 72 characters")
	ErrEmailTaken         = errors.New("an account with that email already exists")

	// ErrNotFound is returned by a Repository when a user or live session
	// doesn't exist.
	ErrNotFound = errors.New("not found")
)

type User struct {
	ID           string    `json:"id"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	CreatedAt    time.Time `json:"createdAt"`
}

type Session struct {
	ID        string // sha256(token), hex-encoded
	UserID    string
	CreatedAt time.Time
	ExpiresAt time.Time
}

type ctxKey struct{}

// WithUser returns a copy of ctx carrying the authenticated user.
func WithUser(ctx context.Context, u *User) context.Context {
	return context.WithValue(ctx, ctxKey{}, u)
}

// UserFrom returns the authenticated user stored by WithUser, if any.
func UserFrom(ctx context.Context) (*User, bool) {
	u, ok := ctx.Value(ctxKey{}).(*User)
	return u, ok && u != nil
}
