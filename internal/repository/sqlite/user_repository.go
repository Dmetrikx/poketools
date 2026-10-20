package sqlitedb

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"modernc.org/sqlite"
	sqlite3 "modernc.org/sqlite/lib"

	"github.com/dariomendez/poketools/internal/auth"
)

// SQLiteUserRepository implements auth.Repository using sqlc Queries.
type SQLiteUserRepository struct {
	q *Queries
}

func NewUserRepository(db *sql.DB) *SQLiteUserRepository {
	return &SQLiteUserRepository{q: New(db)}
}

func (r *SQLiteUserRepository) CreateUser(ctx context.Context, u *auth.User) error {
	err := r.q.CreateUser(ctx, CreateUserParams{
		ID:           u.ID,
		Email:        u.Email,
		PasswordHash: u.PasswordHash,
		CreatedAt:    u.CreatedAt.UnixMilli(),
	})
	var sqliteErr *sqlite.Error
	if errors.As(err, &sqliteErr) && sqliteErr.Code() == sqlite3.SQLITE_CONSTRAINT_UNIQUE {
		return auth.ErrEmailTaken
	}
	if err != nil {
		return fmt.Errorf("create user: %w", err)
	}
	return nil
}

func (r *SQLiteUserRepository) GetUserByEmail(ctx context.Context, email string) (*auth.User, error) {
	row, err := r.q.GetUserByEmail(ctx, email)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, auth.ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get user by email: %w", err)
	}
	return &auth.User{
		ID:           row.ID,
		Email:        row.Email,
		PasswordHash: row.PasswordHash,
		CreatedAt:    time.UnixMilli(row.CreatedAt).UTC(),
	}, nil
}

func (r *SQLiteUserRepository) CreateSession(ctx context.Context, s *auth.Session) error {
	err := r.q.CreateSession(ctx, CreateSessionParams{
		ID:        s.ID,
		UserID:    s.UserID,
		CreatedAt: s.CreatedAt.UnixMilli(),
		ExpiresAt: s.ExpiresAt.UnixMilli(),
	})
	if err != nil {
		return fmt.Errorf("create session: %w", err)
	}
	return nil
}

func (r *SQLiteUserRepository) GetSessionUser(ctx context.Context, tokenHash string, now time.Time) (*auth.User, error) {
	row, err := r.q.GetSessionUser(ctx, GetSessionUserParams{
		ID:        tokenHash,
		ExpiresAt: now.UnixMilli(),
	})
	if errors.Is(err, sql.ErrNoRows) {
		return nil, auth.ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get session: %w", err)
	}
	return &auth.User{
		ID:        row.ID,
		Email:     row.Email,
		CreatedAt: time.UnixMilli(row.CreatedAt).UTC(),
	}, nil
}

func (r *SQLiteUserRepository) DeleteSession(ctx context.Context, tokenHash string) error {
	if err := r.q.DeleteSession(ctx, tokenHash); err != nil {
		return fmt.Errorf("delete session: %w", err)
	}
	return nil
}

func (r *SQLiteUserRepository) DeleteExpiredSessions(ctx context.Context, now time.Time) (int64, error) {
	n, err := r.q.DeleteExpiredSessions(ctx, now.UnixMilli())
	if err != nil {
		return 0, fmt.Errorf("delete expired sessions: %w", err)
	}
	return n, nil
}
