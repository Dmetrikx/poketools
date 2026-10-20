package auth

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"golang.org/x/crypto/bcrypt"
)

type fakeRepo struct {
	users    map[string]*User // by email
	sessions map[string]*Session
}

func newFakeRepo() *fakeRepo {
	return &fakeRepo{users: map[string]*User{}, sessions: map[string]*Session{}}
}

func (r *fakeRepo) CreateUser(ctx context.Context, u *User) error {
	if _, ok := r.users[u.Email]; ok {
		return ErrEmailTaken
	}
	r.users[u.Email] = u
	return nil
}

func (r *fakeRepo) GetUserByEmail(ctx context.Context, email string) (*User, error) {
	u, ok := r.users[email]
	if !ok {
		return nil, ErrNotFound
	}
	return u, nil
}

func (r *fakeRepo) CreateSession(ctx context.Context, s *Session) error {
	r.sessions[s.ID] = s
	return nil
}

func (r *fakeRepo) GetSessionUser(ctx context.Context, tokenHash string, now time.Time) (*User, error) {
	s, ok := r.sessions[tokenHash]
	if !ok || !s.ExpiresAt.After(now) {
		return nil, ErrNotFound
	}
	for _, u := range r.users {
		if u.ID == s.UserID {
			return u, nil
		}
	}
	return nil, ErrNotFound
}

func (r *fakeRepo) DeleteSession(ctx context.Context, tokenHash string) error {
	delete(r.sessions, tokenHash)
	return nil
}

func (r *fakeRepo) DeleteExpiredSessions(ctx context.Context, now time.Time) (int64, error) {
	var n int64
	for k, s := range r.sessions {
		if !s.ExpiresAt.After(now) {
			delete(r.sessions, k)
			n++
		}
	}
	return n, nil
}

func newTestService(now time.Time) (*Service, *fakeRepo) {
	repo := newFakeRepo()
	svc := NewService(repo)
	svc.cost = bcrypt.MinCost
	svc.now = func() time.Time { return now }
	return svc, repo
}

var t0 = time.Date(2026, 10, 20, 12, 0, 0, 0, time.UTC)

func TestSignup_CreatesUserAndSession(t *testing.T) {
	svc, repo := newTestService(t0)
	ctx := context.Background()

	u, token, err := svc.Signup(ctx, "  Ash@Example.com ", "pikachu123")
	if err != nil {
		t.Fatalf("Signup: %v", err)
	}
	if u.Email != "ash@example.com" {
		t.Errorf("email = %q, want normalized ash@example.com", u.Email)
	}
	if token == "" {
		t.Fatal("empty token")
	}
	if _, ok := repo.sessions[token]; ok {
		t.Error("raw token stored as session ID; only its hash may be persisted")
	}

	got, err := svc.Authenticate(ctx, token)
	if err != nil {
		t.Fatalf("Authenticate: %v", err)
	}
	if got.ID != u.ID {
		t.Errorf("Authenticate returned user %q, want %q", got.ID, u.ID)
	}
}

func TestSignup_Validation(t *testing.T) {
	cases := []struct {
		name, email, password string
		want                  error
	}{
		{"bad email", "not-an-email", "pikachu123", ErrInvalidEmail},
		{"display-name email", "Ash <ash@example.com>", "pikachu123", ErrInvalidEmail},
		{"short password", "ash@example.com", "short", ErrWeakPassword},
		{"long password", "ash@example.com", strings.Repeat("a", 73), ErrWeakPassword},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			svc, _ := newTestService(t0)
			_, _, err := svc.Signup(context.Background(), tc.email, tc.password)
			if !errors.Is(err, tc.want) {
				t.Errorf("err = %v, want %v", err, tc.want)
			}
		})
	}
}

func TestSignup_DuplicateEmail(t *testing.T) {
	svc, _ := newTestService(t0)
	ctx := context.Background()
	if _, _, err := svc.Signup(ctx, "ash@example.com", "pikachu123"); err != nil {
		t.Fatalf("first Signup: %v", err)
	}
	if _, _, err := svc.Signup(ctx, "ASH@example.com", "other-pass"); !errors.Is(err, ErrEmailTaken) {
		t.Errorf("err = %v, want ErrEmailTaken", err)
	}
}

func TestLogin(t *testing.T) {
	svc, _ := newTestService(t0)
	ctx := context.Background()
	if _, _, err := svc.Signup(ctx, "ash@example.com", "pikachu123"); err != nil {
		t.Fatalf("Signup: %v", err)
	}

	if _, token, err := svc.Login(ctx, "Ash@Example.com", "pikachu123"); err != nil || token == "" {
		t.Errorf("valid login: token=%q err=%v", token, err)
	}
	if _, _, err := svc.Login(ctx, "ash@example.com", "wrong-pass"); !errors.Is(err, ErrInvalidCredentials) {
		t.Errorf("wrong password: err = %v, want ErrInvalidCredentials", err)
	}
	if _, _, err := svc.Login(ctx, "misty@example.com", "pikachu123"); !errors.Is(err, ErrInvalidCredentials) {
		t.Errorf("unknown email: err = %v, want ErrInvalidCredentials", err)
	}
}

func TestAuthenticate_ExpiredSession(t *testing.T) {
	svc, _ := newTestService(t0)
	ctx := context.Background()
	_, token, err := svc.Signup(ctx, "ash@example.com", "pikachu123")
	if err != nil {
		t.Fatalf("Signup: %v", err)
	}

	svc.now = func() time.Time { return t0.Add(SessionTTL) }
	if _, err := svc.Authenticate(ctx, token); !errors.Is(err, ErrNotFound) {
		t.Errorf("err = %v, want ErrNotFound for expired session", err)
	}
}

func TestLogout_RevokesSession(t *testing.T) {
	svc, _ := newTestService(t0)
	ctx := context.Background()
	_, token, err := svc.Signup(ctx, "ash@example.com", "pikachu123")
	if err != nil {
		t.Fatalf("Signup: %v", err)
	}
	if err := svc.Logout(ctx, token); err != nil {
		t.Fatalf("Logout: %v", err)
	}
	if _, err := svc.Authenticate(ctx, token); !errors.Is(err, ErrNotFound) {
		t.Errorf("err = %v, want ErrNotFound after logout", err)
	}
}

func TestDeleteExpiredSessions(t *testing.T) {
	svc, repo := newTestService(t0)
	ctx := context.Background()
	if _, _, err := svc.Signup(ctx, "ash@example.com", "pikachu123"); err != nil {
		t.Fatalf("Signup: %v", err)
	}

	if n, _ := svc.DeleteExpiredSessions(ctx); n != 0 {
		t.Errorf("deleted %d live sessions", n)
	}
	svc.now = func() time.Time { return t0.Add(SessionTTL + time.Second) }
	if n, _ := svc.DeleteExpiredSessions(ctx); n != 1 {
		t.Errorf("deleted %d sessions, want 1", n)
	}
	if len(repo.sessions) != 0 {
		t.Errorf("%d sessions remain", len(repo.sessions))
	}
}

func TestAuthenticate_EmptyToken(t *testing.T) {
	svc, _ := newTestService(t0)
	if _, err := svc.Authenticate(context.Background(), ""); !errors.Is(err, ErrNotFound) {
		t.Errorf("err = %v, want ErrNotFound", err)
	}
}
