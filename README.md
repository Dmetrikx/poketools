# Poketools

A Pokemon TCG deck builder. Import, edit, and export decklists — similar to [Limitless TCG](https://limitlesstcg.com) and RK9. Built to support simulation jobs and additional tooling in the future.

## Stack

| Layer | Technology |
|---|---|
| Backend | Go, [chi](https://github.com/go-chi/chi) router |
| Database | SQLite via [modernc/sqlite](https://pkg.go.dev/modernc.org/sqlite) (CGO-free) |
| DB queries | [sqlc](https://sqlc.dev) — type-safe Go generated from SQL |
| Card data | [TCGdex API](https://tcgdex.dev) with in-memory cache |
| Frontend | React 18 + TypeScript, Vite |

---

## Prerequisites

- **Go** 1.21+
- **Node.js** 18+ with npm
- **sqlc** (only needed when changing SQL queries): `go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest`

---

## Getting Started

```bash
# 1. Clone and enter the repo
git clone <repo-url>
cd poketools

# 2. Install frontend dependencies
cd web && npm install && cd ..

# 3. Run everything
make dev
```

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
│   ├── api/                    # HTTP handlers (deck_handler.go, card_handler.go)
│   ├── card/                   # Card domain type + CardService (proxies TCGdex)
│   ├── config/                 # Env-based config (PORT, DATABASE_PATH, ENV)
│   ├── deck/                   # Deck domain types + DeckService
│   ├── format/
│   │   ├── formatter.go        # DeckFormatter interface
│   │   ├── ptcglive/           # PTCG Live parser + tests
│   │   └── limitless/          # Limitless TCG parser + tests
│   ├── repository/
│   │   ├── db.go               # Open DB + run schema migrations
│   │   ├── deck_repository.go  # DeckRepository interface
│   │   └── sqlite/
│   │       ├── schema.sql      # Source-of-truth DDL (edit this, then run sqlc)
│   │       ├── queries/        # SQL input for sqlc
│   │       │   ├── decks.sql
│   │       │   └── entries.sql
│   │       ├── deck_repository.go   # SQLite implementation
│   │       └── *.sql.go        # sqlc-generated (do not edit)
│   └── server/
│       ├── router.go           # chi router + all route definitions
│       └── server.go           # http.Server + graceful shutdown
│
├── pkg/
│   └── tcgdex/                 # TCGdex API client (client.go, types.go, cache.go)
│
├── web/                        # React + TypeScript frontend
│   └── src/
│       ├── api/                # Typed API wrappers (client.ts, decks.ts, cards.ts)
│       ├── types/              # Shared TypeScript types (deck.ts, card.ts)
│       ├── pages/              # Route-level page components
│       ├── components/         # UI components (layout/, deck/, card/)
│       └── hooks/              # useDecks, useDeck, useCardSearch, useDebounce
│
├── sqlc.yaml                   # sqlc configuration
├── Makefile
└── go.mod
```

---

## Make Targets

```bash
make dev             # Run backend + frontend concurrently
make dev-backend     # Go API server only (port 8080)
make dev-frontend    # Vite dev server only (port 5173)
make build           # Production build (frontend → binary with embed.FS)
make test            # go test ./...
make test-v          # go test -v ./...
make sqlc            # Regenerate DB query code from SQL
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
| `ENV` | `development` | `development` or `production` |

---

## API Reference

All endpoints are under `/api`.

### Decks

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/decks` | List all decks |
| `POST` | `/api/decks` | Create a deck `{ name, format }` |
| `GET` | `/api/decks/:id` | Get deck with all entries |
| `PUT` | `/api/decks/:id` | Update deck metadata `{ name, format }` |
| `DELETE` | `/api/decks/:id` | Delete deck and all entries |

### Deck Entries

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/decks/:id/entries` | Add a card entry |
| `PUT` | `/api/decks/:id/entries/:eid` | Update entry count `{ count }` |
| `DELETE` | `/api/decks/:id/entries/:eid` | Remove entry |

### Import / Export

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/decks/import` | Parse decklist text → deck. Set `save: true` in body to persist. Query param `?format=ptcglive\|limitless` |
| `GET` | `/api/decks/:id/export` | Export deck as text. Query param `?format=ptcglive\|limitless` |

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

The schema is defined in `internal/repository/sqlite/schema.sql`. The application applies it automatically on startup — there is no separate migration step during development.

```sql
decks        (id, name, format, created_at, updated_at)
deck_entries (id, deck_id, card_id, name, set_code, number, count, section, position)
```

`section` is constrained to `pokemon | trainer | energy`.

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
2. Add a `parser_test.go` with import/roundtrip tests
3. Add a case in `internal/api/deck_handler.go` → `formatterFor()`

---

## Modifying Database Queries

Queries are generated by sqlc — **do not edit `*.sql.go` files directly**.

1. Edit SQL in `internal/repository/sqlite/queries/` (or `schema.sql` for schema changes)
2. Run `make sqlc` to regenerate
3. Update `internal/repository/sqlite/deck_repository.go` if method signatures changed

---

## Card Data

Card search and lookup is proxied through the [TCGdex API](https://tcgdex.dev). Responses are cached in memory for 15 minutes.

The client lives in `pkg/tcgdex/`. To swap in a different card data source, implement the `card.TCGdexClient` interface in `internal/card/service.go` and wire it in `cmd/server/main.go`.
