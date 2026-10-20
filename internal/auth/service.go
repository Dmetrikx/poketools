package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"net/mail"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// Repository is the persistence interface the service depends on.
type Repository interface {
	// CreateUser returns ErrEmailTaken if the email is already registered.
	CreateUser(ctx context.Context, u *User) error
	GetUserByEmail(ctx context.Context, email string) (*User, error)

	CreateSession(ctx context.Context, s *Session) error
	// GetSessionUser returns the owner of a session that expires after now.
	GetSessionUser(ctx context.Context, tokenHash string, now time.Time) (*User, error)
	DeleteSession(ctx context.Context, tokenHash string) error
	DeleteExpiredSessions(ctx context.Context, now time.Time) (int64, error)
}

// Service handles signup, login and the session lifecycle.
type Service struct {
	repo Repository
	now  func() time.Time
	cost int

	dummyOnce sync.Once
	dummyHash []byte
}

func NewService(repo Repository) *Service {
	return &Service{
		repo: repo,
		now:  func() time.Time { return time.Now().UTC() },
		cost: bcrypt.DefaultCost,
	}
}

// Signup registers a new user and logs them in, returning the raw session
// token.
func (s *Service) Signup(ctx context.Context, email, password string) (*User, string, error) {
	email, err := normalizeEmail(email)
	if err != nil {
		return nil, "", err
	}
	if len(password) < minPasswordLen || len(password) > maxPasswordLen {
		return nil, "", ErrWeakPassword
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), s.cost)
	if err != nil {
		return nil, "", fmt.Errorf("hash password: %w", err)
	}
	u := &User{
		ID:           uuid.NewString(),
		Email:        email,
		PasswordHash: string(hash),
		CreatedAt:    s.now(),
	}
	if err := s.repo.CreateUser(ctx, u); err != nil {
		if errors.Is(err, ErrEmailTaken) {
			return nil, "", ErrEmailTaken
		}
		return nil, "", fmt.Errorf("create user: %w", err)
	}

	token, err := s.createSession(ctx, u.ID)
	if err != nil {
		return nil, "", err
	}
	return u, token, nil
}

// Login verifies credentials and, on success, creates a new session and
// returns its raw token (the token itself is never persisted — only its hash
// is).
func (s *Service) Login(ctx context.Context, email, password string) (*User, string, error) {
	email, _ = normalizeEmail(email)

	u, err := s.repo.GetUserByEmail(ctx, email)
	if err != nil && !errors.Is(err, ErrNotFound) {
		return nil, "", fmt.Errorf("get user: %w", err)
	}

	// Always run a bcrypt comparison, even for an unknown email, so a wrong
	// email doesn't return faster than a wrong password.
	hash := s.dummy()
	if u != nil {
		hash = []byte(u.PasswordHash)
	}
	if cmpErr := bcrypt.CompareHashAndPassword(hash, []byte(password)); u == nil || cmpErr != nil {
		return nil, "", ErrInvalidCredentials
	}

	token, err := s.createSession(ctx, u.ID)
	if err != nil {
		return nil, "", err
	}
	return u, token, nil
}

// Logout deletes the session backing the given raw token, if any.
func (s *Service) Logout(ctx context.Context, token string) error {
	if err := s.repo.DeleteSession(ctx, hashToken(token)); err != nil {
		return fmt.Errorf("delete session: %w", err)
	}
	return nil
}

// Authenticate returns the user owning a live session for the given raw
// token, or ErrNotFound.
func (s *Service) Authenticate(ctx context.Context, token string) (*User, error) {
	if token == "" {
		return nil, ErrNotFound
	}
	return s.repo.GetSessionUser(ctx, hashToken(token), s.now())
}

// DeleteExpiredSessions removes sessions past their expiry and reports how
// many were deleted. Expired sessions are already rejected by Authenticate;
// this only keeps the table from growing forever.
func (s *Service) DeleteExpiredSessions(ctx context.Context) (int64, error) {
	return s.repo.DeleteExpiredSessions(ctx, s.now())
}

func (s *Service) createSession(ctx context.Context, userID string) (string, error) {
	token, err := generateToken()
	if err != nil {
		return "", fmt.Errorf("generate token: %w", err)
	}
	now := s.now()
	if err := s.repo.CreateSession(ctx, &Session{
		ID:        hashToken(token),
		UserID:    userID,
		CreatedAt: now,
		ExpiresAt: now.Add(SessionTTL),
	}); err != nil {
		return "", fmt.Errorf("create session: %w", err)
	}
	return token, nil
}

// dummy returns a hash at the service's cost to compare against when the
// email is unknown, computed once on first use.
func (s *Service) dummy() []byte {
	s.dummyOnce.Do(func() {
		s.dummyHash, _ = bcrypt.GenerateFromPassword([]byte("poketools-dummy-password"), s.cost)
	})
	return s.dummyHash
}

func normalizeEmail(email string) (string, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	addr, err := mail.ParseAddress(email)
	if err != nil || addr.Address != email {
		return email, ErrInvalidEmail
	}
	return email, nil
}

func generateToken() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
