# Poketools

A multi-user Pokemon TCG deck tool. Import a decklist (PTCG Live or Limitless) and test draw opening hands, with face-down prizes for prize checking. Decks can also be edited, given custom card art and two cover cards. Built to support simulation jobs and additional tooling in the future.

## Stack

| Layer | Technology |
|---|---|
| Backend | Go, [chi](https://github.com/go-chi/chi) router |
| Database | SQLite via [modernc/sqlite](https://pkg.go.dev/modernc.org/sqlite) (CGO-free), numbered migrations |
| Auth | Email + bcrypt, server-side sessions stored hashed in SQLite |
| DB queries | [sqlc](https://sqlc.dev) — type-safe Go generated from SQL |
| Card data | [TCGdex API](https://tcgdex.dev) with in-memory cache |
| Frontend | React 18 + TypeScript, Vite |

---

## Prerequisites

- **Go** 1.25.x
- **Node.js** 22 with npm (matches CI and the Dockerfile)
- **sqlc** (only needed when changing SQL queries): `go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest`

---

## Getting Started

```bash
# 1. Clone and enter the repo
git clone <repo-url>
cd poketools

# 2. Install frontend dependencies
cd web && npm install && cd ..

# 3. Build the frontend once (web/dist is embedded into the Go binary)
make build-frontend

# 4. Run everything
make dev
```

Open http://localhost:5173 and create an account.

`make dev` starts both servers concurrently:

| Server | URL |
|---|---|
| Go API | http://localhost:8080 |
| Vite (React) | http://localhost:5173 |

The Vite dev server proxies `/api/*` to the Go server, so the frontend just calls `/api/...` without any CORS configuration needed in development.

---

## Project Structure

```
poketools/
├── cmd/
│   └── server/main.go          # Entry point — wires all dependencies
│
├── internal/
│   ├── api/                    # HTTP handlers (auth, deck, card) + RequireAuth middleware
│   ├── auth/                   # Accounts: signup/login, sessions, context helpers
│   ├── card/                   # Card domain type + CardService (proxies TCGdex)
│   ├── config/                 # Env-based config (PORT, DATABASE_PATH, ENV, ALLOW_SIGNUP)
│   ├── deck/                   # Deck domain types + DeckService (scoped per user)
│   ├── format/
│   │   ├── formatter.go        # DeckFormatter interface
│   │   ├── ptcglive/           # PTCG Live parser + tests
│   │   └── limitless/          # Limitless TCG parser + tests
│   ├── repository/
│   │   ├── db.go               # Open DB (pragmas in DSN) + migration runner
│   │   ├── migrations/         # NNNN_name.sql, applied in order, immutable once applied
│   │   └── sqlite/
│   │       ├── queries/        # SQL input for sqlc (decks, entries, users, sessions)
│   │       ├── deck_repository.go   # deck.Repository implementation
│   │       ├── user_repository.go   # auth.Repository implementation
│   │       └── *.sql.go        # sqlc-generated (do not edit)
│   ├── server/
│   │   ├── router.go           # chi router: public auth routes, protected /api, SPA
│   │   ├── router_test.go      # End-to-end API tests
│   │   └── server.go           # http.Server + graceful shutdown
│   └── version/                # Build version (ldflags)
│
├── pkg/
│   └── tcgdex/                 # TCGdex API client (client.go, types.go, cache.go)
│
├── web/                        # React + TypeScript frontend
│   └── src/
│       ├── api/                # Typed API wrappers (client.ts, auth.ts, decks.ts, cards.ts)
│       ├── types/              # Shared TypeScript types (auth.ts, deck.ts, card.ts)
│       ├── pages/              # LoginPage, HomePage, DeckEditorPage, ImportPage
│       ├── components/         # UI components (layout/, deck/, card/)
│       └── hooks/              # useAuth, useDecks, useDeck, useCardSearch, useCardImages, useDebounce
│
├── .github/workflows/          # ci.yml, fly-deploy.yml (deploys after CI passes)
├── sqlc.yaml                   # sqlc configuration
├── Makefile
└── go.mod
```

---

## Make Targets

```bash
make dev             # Run backend + frontend concurrently
make dev-backend     # Build + exec the Go API server (refuses if :8080 is taken)
make dev-frontend    # Vite dev server only (port 5173)
make kill-stale      # Kill a leftover dev server holding :8080
make build           # Production build (frontend → binary with embed.FS, version via ldflags)
make test            # go test -race ./...
make test-v          # go test -race -v ./...
make sqlc            # Regenerate DB query code from SQL
make deploy-check    # Tests, vet, frontend build, clean tree — ready to push to main
make deploy-status   # fly status
make deploy-logs     # fly logs
make clean           # Remove bin/ and web/dist/
make help            # List all targets
```

---

## Configuration

The server reads configuration from environment variables. All have sensible defaults for local development.

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | HTTP listen port |
| `DATABASE_PATH` | `poketools.db` | SQLite file path |
| `ENV` | `development` | `development` or `production` (non-development sets `Secure` on the session cookie) |
| `ALLOW_SIGNUP` | `true` | Set to `false` to close registration |

---

## API Reference

All endpoints are under `/api`. Everything except `/api/auth/*` requires a session cookie (`poketools_session`) and returns `401` without one. Decks are private to their owner; another user's deck or entry returns `404`.

### Auth

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/signup` | Create an account `{ email, password }` (8–72 chars) and log in. `403` when signups are closed, `409` if the email is taken |
| `POST` | `/api/auth/login` | Log in `{ email, password }` |
| `POST` | `/api/auth/logout` | End the session |
| `GET` | `/api/auth/me` | `{ user \| null, allowSignup }`, always `200` |

### Decks

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/decks` | List your decks |
| `POST` | `/api/decks` | Create a deck `{ name, format }` |
| `GET` | `/api/decks/:id` | Get deck with all entries |
| `PUT` | `/api/decks/:id` | Update deck metadata `{ name, format }` |
| `DELETE` | `/api/decks/:id` | Delete deck and all entries |
| `PUT` | `/api/decks/:id/covers` | Set the deck's cover cards `{ entryIds }` (up to 2 of its entries, in slot order) |

Decks include `covers`: the entries chosen as cover cards, or empty slots that the client fills with the two highest-HP Pokémon and then saves.

### Deck Entries

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/decks/:id/entries` | Add a card entry |
| `PUT` | `/api/decks/:id/entries/:eid` | Update entry count/imageUrl `{ count, imageUrl }` |
| `PUT` | `/api/decks/:id/entries/:eid/art` | Update entry's custom art image URL `{ imageUrl }` |
| `DELETE` | `/api/decks/:id/entries/:eid` | Remove entry |

### Import

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/decks/import` | Parse decklist text → deck. Set `save: true` in body to persist. Optional `imageUrls` (by entry index) sets art on save. Query param `?format=ptcglive\|limitless` |

**Import request body:**
```json
{
  "text": "Pokémon: 4\n4 Charizard ex OBF 125\n...",
  "name": "My Deck",
  "format": "standard",
  "save": true
}
```

### Cards

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/cards/search` | Search TCGdex. Query params: `?q=charizard&set=OBF` |
| `GET` | `/api/cards/:id` | Get single card detail |

### Health

```
GET /health  →  200 "ok"
```

---

## Database

The schema lives in numbered migrations under `internal/repository/migrations/`, applied automatically on startup and recorded (with checksums) in `schema_migrations`.

```sql
users        (id, email, password_hash, created_at)
sessions     (id = sha256(token), user_id, created_at, expires_at)
decks        (id, user_id, name, format, created_at, updated_at)
deck_entries (id, deck_id, card_id, name, set_code, number, count, section, position, image_url)
deck_covers  (deck_id, slot 0|1, entry_id)
```

Timestamps are epoch milliseconds. `section` is constrained to `pokemon | trainer | energy`. `image_url` stores per-entry custom art selections (default `''`).

---

## Adding a New Decklist Format

The `format.DeckFormatter` interface is the only contract to implement:

```go
// internal/format/formatter.go
type DeckFormatter interface {
    Import(text string) (*deck.Deck, error)
    Export(d *deck.Deck) (string, error)
}
```

Steps:
1. Create `internal/format/<yourformat>/parser.go` implementing `DeckFormatter`
2. Add a `parser_test.go` with import/roundtrip tests (`Export` isn't served over HTTP; it exists for the roundtrip)
3. Add a case in `internal/api/deck_handler.go` → `formatterFor()`

---

## Modifying Database Queries

Queries are generated by sqlc — **do not edit `*.sql.go` files directly**.

1. Edit SQL in `internal/repository/sqlite/queries/`. For schema changes, add a new `internal/repository/migrations/NNNN_name.sql`; never edit one that has already been applied
2. Run `make sqlc` to regenerate
3. Update the adapters in `internal/repository/sqlite/` if method signatures changed

---

## Card Data

Card search and lookup is proxied through the [TCGdex API](https://tcgdex.dev). Responses are cached in memory for 15 minutes.

The client lives in `pkg/tcgdex/`. To swap in a different card data source, implement the `card.TCGdexClient` interface in `internal/card/service.go` and wire it in `cmd/server/main.go`.

---

## Deployment (Fly.io)

The app runs on Fly.io as a single shared-CPU VM (`shared-cpu-1x`, 256MB RAM) with a persistent 1GB volume for SQLite. Configuration lives in `fly.toml`.

**App name**: `poketools-k5-rwq`
**Region**: `lax`
**Volume**: `poketools_data` mounted at `/data` (SQLite lives at `/data/poketools.db`)

### Prerequisites

```bash
# Install flyctl
brew install flyctl

# Authenticate
fly auth login
```

### How deploys happen

**Push to `main`. That's the only path to production.**

1. `.github/workflows/ci.yml` runs on every PR and push to main: `go vet`, `go build`, `go test -race`, and the frontend type-check + build.
2. `.github/workflows/fly-deploy.yml` runs when CI completes on main. It deploys only if CI succeeded, checks out exactly the commit CI tested, and passes its short SHA as the `VERSION` build arg (logged at startup).

Run `make deploy-check` before pushing. There's deliberately no `make deploy`: two paths that can disagree about what's running is worse than one slow one. The only GitHub secret is `FLY_API_TOKEN`.

### Rollback to a previous release

```bash
fly releases          # list past releases with version numbers
fly deploy --image <image-ref>   # re-deploy a specific release image
```

Or use the dashboard shortcut:

```bash
fly open             # opens the Fly.io dashboard in browser
```

### Check status and logs

```bash
fly status           # machine health, current image
fly logs             # tail live logs
fly logs --instance <id>   # logs for a specific machine instance
```

### SSH into the running VM

```bash
fly ssh console
```

Useful for inspecting the SQLite file directly:

```bash
# Inside the VM
sqlite3 /data/poketools.db
.tables
SELECT * FROM decks;
```

### Volume and data notes

- The volume (`poketools_data`) persists across deploys — deck and account data survive redeployments.
- `min_machines_running = 0` means Fly scales the VM to zero when idle. The first request after sleep has a cold-start delay (~1–2s). Acceptable for personal use.
- If you ever delete the app, the volume is deleted too. Back up your data first:

```bash
fly ssh console -C "sqlite3 /data/poketools.db .dump" > backup.sql
```

### Environment variables

Non-secret config is managed in `fly.toml` under `[env]`. Secrets (if ever needed) go through `fly secrets set`, never `[env]`:

```bash
fly secrets set MY_SECRET=value
```

| Variable | Value in production |
|---|---|
| `PORT` | `8080` |
| `DATABASE_PATH` | `/data/poketools.db` |
| `ENV` | `production` |
| `ALLOW_SIGNUP` | unset (`true`). Set `ALLOW_SIGNUP = "false"` under `[env]` to close registration |
