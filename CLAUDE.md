# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Poketools** is a multi-user Pokémon TCG deck builder: import, edit and export decklists (PTCG Live, Limitless), pick card art, and generate practice opening hands. It's a Go REST API with a React + TypeScript SPA embedded in the binary, SQLite on a Fly.io volume.

It follows the same layout and conventions as the user's other projects started from go-fly-template (calendario, necroLog, palTracker). When in doubt, match necroLog.

## Quick Start Commands

```bash
make dev              # Run backend + frontend concurrently (port 8080 + 5173)
make dev-backend      # Build + exec the Go API server (refuses if :8080 is taken)
make dev-frontend     # Vite dev server only (port 5173)
make kill-stale       # Kill a leftover dev server holding :8080
make test             # All Go tests, with -race
make sqlc             # Regenerate sqlc query code after modifying SQL
make build            # Production build (frontend compiled into binary, version via ldflags)
make deploy-check     # Tests + vet + frontend build + clean tree: ready to push to main
make deploy-status    # fly status
make deploy-logs      # fly logs
```

## Architecture

### Technology Stack
- **Backend**: Go 1.25 with chi router
- **Database**: SQLite (modernc/sqlite, CGO-free), sqlc for queries, numbered migrations
- **Auth**: email + bcrypt passwords, server-side sessions (hashed tokens in SQLite)
- **Card data**: TCGdex API with in-memory 15-minute cache
- **Frontend**: React 18 + TypeScript + Vite, CSS modules

### Invariants

- **Every deck query is scoped by `user_id`.** A deck that belongs to someone else must be indistinguishable from one that doesn't exist (`deck.ErrNotFound` → 404). Entry mutations are scoped by `deck_id` *and* the service checks deck ownership first, so a user can't reach another user's entry by pairing it with their own deck ID. `internal/server/router_test.go` (`TestAPI_DecksAreIsolatedPerUser`) enforces this: extend it when adding deck/entry endpoints.
- **Handlers get the user from the context**, via `userID(r)` in `internal/api/auth_middleware.go` (backed by `auth.UserFrom`). Never accept a user ID from the request body or query.
- **Migrations are immutable.** Files in `internal/repository/migrations/` are checksummed into `schema_migrations`; editing one that has run anywhere is a startup error. Add a new `NNNN_name.sql` instead.
- **Timestamps are INTEGER epoch milliseconds (UTC)** in the database. The domain uses `time.Time`; the sqlite adapters convert (`UnixMilli` / `time.UnixMilli(...).UTC()`).
- **SQLite pragmas go in the DSN** (`repository.Open`), never `db.Exec`. `foreign_keys` and `busy_timeout` are per-connection; Exec only configures one pooled connection.
- **The `/*` SPA route stays outside `RequireAuth`.** The login page is served by it. And its fallback rewrites to `/`, not `/index.html` (FileServer redirects `/index.html` → `./`, which loops on nested routes).
- **Only `sha256(token)` is stored for sessions.** The raw token exists only in the `poketools_session` cookie (HttpOnly, SameSite=Lax, Secure outside development).
- **Secrets go through `fly secrets set`**, never `[env]` in fly.toml. Never bulk-import a `.env` into fly secrets.

### Key Design Decisions

**Handler package placement**: HTTP handlers live in `internal/api/`, not in domain packages. Format packages import deck types, so handlers in `deck` would create an import cycle. Keep handlers thin.

**Interfaces live with their consumer**: `deck.Repository` and `auth.Repository` are defined in the domain package; `internal/repository/sqlite/*_repository.go` implements them. Tests use fakes, not mocks.

**Code generation**: sqlc reads the schema from `internal/repository/migrations/` and queries from `internal/repository/sqlite/queries/`. **Never edit** `*.sql.go`; change the SQL and run `make sqlc`.

**Format system**: `internal/format/formatter.go` defines `DeckFormatter` (`Import` / `Export`). Each format is its own package; selection is `formatterFor()` in `internal/api/deck_handler.go`.

**Card data**: `pkg/tcgdex/` is a self-contained client + cache. Basic energy always resolves to the `swsh` set for images.

### Dependency Injection Flow
```
cmd/server/main.go
  ├─ config.Load()
  ├─ repository.Open() + repository.Migrate()
  ├─ auth.NewService(sqlitedb.NewUserRepository(db))
  ├─ api.NewAuthHandler(authSvc, cfg.AllowSignup, cfg.IsDevelopment())
  ├─ deck.NewService(sqlitedb.NewDeckRepository(db)) → api.NewDeckHandler
  ├─ card.NewService(tcgdex.New()) → api.NewCardHandler
  ├─ go cleanupSessions(ctx, authSvc)      # hourly expired-session purge
  └─ server.NewRouter(authSvc, authHandler, deckHandler, cardHandler) → server.New().Start()
```

## Project Structure

```
cmd/server/main.go                   # Entry point, wiring, session cleanup ticker

internal/
  api/                               # HTTP handlers (thin)
    auth_handler.go                  # signup / login / logout / me, session cookie
    auth_middleware.go               # RequireAuth, userID(r)
    deck_handler.go                  # Deck CRUD, entries, import/export
    card_handler.go                  # Card search + detail
    response.go                      # writeJSON / writeError
  auth/                              # Accounts domain
    auth.go                          # User, Session, errors, WithUser/UserFrom
    service.go                       # Signup, Login, Logout, Authenticate, Repository
  card/                              # Card domain (proxies TCGdex)
  config/config.go                   # PORT, DATABASE_PATH, ENV, ALLOW_SIGNUP
  deck/                              # Deck domain
    deck.go                          # Deck, CardEntry, Section, ErrNotFound
    service.go                       # Service + Repository (all methods take userID)
  format/                            # DeckFormatter + ptcglive/, limitless/
  repository/
    db.go                            # Open (DSN pragmas), Migrate (checksummed runner)
    migrations/NNNN_*.sql            # Schema, applied in order (immutable once applied)
    sqlite/
      queries/*.sql                  # sqlc input
      deck_repository.go             # deck.Repository implementation
      user_repository.go             # auth.Repository implementation
      *.sql.go, models.go            # sqlc-generated (DO NOT EDIT)
  server/
    router.go                        # Public auth routes, RequireAuth group, SPA
    router_test.go                   # End-to-end API tests over a real SQLite DB
    server.go                        # http.Server with timeouts, graceful shutdown
  version/version.go                 # Build version (ldflags, VCS fallback)

pkg/tcgdex/                          # TCGdex client + 15-minute cache

web/src/
  api/                               # client.ts (fetch wrapper, 401 event), auth.ts, decks.ts, cards.ts
  hooks/                             # useAuth, useDecks, useDeck, useCardSearch, useCardImages, useBasicPokemon, useDebounce
  pages/                             # LoginPage, HomePage, DeckEditorPage, ImportPage
  components/practice/               # PracticeHandModal, DeckFan, PlayingCard (flip)
  practice/deal.ts                   # Shuffle + mulligan dealing, deck sort
  components/layout/                 # AppShell, Navbar (user email + logout)
  components/deck/, components/card/
  types/                             # auth.ts, deck.ts, card.ts
```

## Database

Schema lives in `internal/repository/migrations/`, applied on startup by `repository.Migrate`:
- `0001_init.sql`: baseline decks/entries (drops pre-runner tables)
- `0002_accounts.sql`: users, sessions, and decks recreated with `user_id`

**Tables**:
- `users(id, email UNIQUE COLLATE NOCASE, password_hash, created_at)`
- `sessions(id = sha256(token), user_id → users, created_at, expires_at)`
- `decks(id, user_id → users, name, format, created_at, updated_at)`
- `deck_entries(id, deck_id → decks, card_id, name, set_code, number, count, section, position, image_url)`, where `section ∈ pokemon | trainer | energy`

All foreign keys `ON DELETE CASCADE`.

**Changing the schema**: add `internal/repository/migrations/NNNN_name.sql`, run `make sqlc`, update the adapter in `internal/repository/sqlite/`. SQLite can't `ADD COLUMN ... NOT NULL` without a default (or with a FK + non-null default); recreate the table instead.

**sqlc pitfalls**: use `:execrows` for scoped UPDATE/DELETE so the adapter can map 0 rows to `ErrNotFound` (see `rowsAffected` in `deck_repository.go`).

## API Routes

**Public**
- `POST /api/auth/signup` `{email, password}` → 201 `{user}` + cookie (403 if `ALLOW_SIGNUP=false`, 409 if email taken, 400 on validation)
- `POST /api/auth/login` `{email, password}` → 200 `{user}` + cookie, 401 on bad credentials
- `POST /api/auth/logout` → 204, clears cookie
- `GET /api/auth/me` → 200 `{user | null, allowSignup}` (never 401)
- `GET /health` → `200 "ok"`
- `GET /*` → SPA

**Behind `RequireAuth`** (401 without a valid session)
- `GET|POST /api/decks`, `POST /api/decks/import?format=ptcglive|limitless`
- `GET|PUT|DELETE /api/decks/{id}`, `GET /api/decks/{id}/export?format=...`
- `POST /api/decks/{id}/entries`, `PUT|DELETE /api/decks/{id}/entries/{eid}`, `PUT /api/decks/{id}/entries/{eid}/art`
- `GET /api/cards/search?q=&set=`, `GET /api/cards/{id}`

## Testing

Standard library `testing` only, with fakes over mocks. `make test` runs with `-race`.

- `internal/auth/service_test.go`: service against a fake repository (bcrypt at `MinCost`, injectable clock)
- `internal/server/router_test.go`: the real router over a temp SQLite DB with cookie-jar clients; covers auth, isolation between users, and the SPA fallback
- `internal/repository/db_test.go`: migration runner, pragma-per-connection, pre-runner schema replacement
- `internal/format/*/parser_test.go`: import + roundtrip per format

`internal/server` tests need `web/dist` to exist (it's embedded). CI creates a placeholder; locally, run `make build-frontend` once.

## Frontend Patterns

- `src/api/client.ts` wraps fetch; any 401 from a non-auth endpoint dispatches `auth:unauthorized`, which `useAuth` turns into a return to the login page.
- `App.tsx` renders `LoginPage` in place of the routes when there's no user, so the user lands back on the URL they opened.
- Practice Hands is a modal on the Deck Editor: one dealt hand, face-down prizes and next card (click to flip), and the remaining deck in a scrollable fan with "seen" marks for prize checking. The hand and its reveal/mark state persist in `localStorage` (`practice-hand-{deckId}`) and are discarded when the deck's contents change; basic-Pokémon overrides persist under `practice-overrides-{deckId}`.
- `useCardImages` keeps a module-level image cache; `overrideImage` powers the art picker, persisted via the entry's `imageUrl`.
- Energy images try the `swsh` set first, then the entry's own set.

## Configuration

| Variable | Default | |
|---|---|---|
| `PORT` | `8080` | |
| `DATABASE_PATH` | `poketools.db` | `/data/poketools.db` on Fly |
| `ENV` | `development` | anything else turns on `Secure` cookies |
| `ALLOW_SIGNUP` | `true` | `false` closes registration (403) |

## Deployment (Fly.io)

App `poketools-k5-rwq`, region `lax`, volume `poketools_data` at `/data`, scale-to-zero.

**There is exactly one path to production: push to main.** `ci.yml` runs vet, build, race tests and the frontend build; `fly-deploy.yml` triggers on CI's `workflow_run`, deploys only if CI succeeded, checks out exactly the tested SHA, and passes it as `VERSION`. Deliberately no `make deploy`. Run `make deploy-check` before pushing.

## Removed: Game Board

The drag-and-drop game board (`HandDetailPage`, reached from Practice Hands) was removed to be redesigned later. It was frontend-only (no backend state). Recover it from git history: PRs #3 and #5–#10, last version at `8aa2b34`.

## Adding a New Decklist Format

1. Create `internal/format/yourformat/parser.go` implementing `DeckFormatter`
2. Add `parser_test.go` with import + roundtrip tests
3. Add a case in `formatterFor()` in `internal/api/deck_handler.go`

## Related

- README.md: overview, getting started, API reference, Fly operations
