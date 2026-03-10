# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Start Commands

```bash
make dev              # Run backend + frontend concurrently (port 8080 + 5173)
make dev-backend      # Go API server only (port 8080)
make dev-frontend     # Vite dev server only (port 5173)
make test             # Run all Go tests
make test-v           # Run tests with verbose output
make sqlc             # Regenerate sqlc query code after modifying SQL
make build            # Production build (frontend compiled into binary)
make clean            # Remove build artifacts (bin/, web/dist/)
```

## Architecture Overview

**Poketools** is a Pokemon TCG deck builder with a Go REST API backend + React TypeScript frontend.

### Technology Stack
- **Backend**: Go 1.25+ with chi HTTP router
- **Database**: SQLite (modernc/sqlite, CGO-free) with sqlc for type-safe queries
- **Card Data**: TCGdex API with in-memory 15-minute cache
- **Frontend**: React 18 + TypeScript with Vite
- **Import/Export**: Pluggable format system (PTCG Live, Limitless TCG)

### Key Design Decisions

**Handler Package Placement**
- HTTP handlers live in `internal/api/` (not in domain packages like `internal/deck/`)
- Reason: Format packages (`internal/format/`) import deck types → circular import if handlers were in deck package
- Keep handlers as thin wrappers around service layer

**Code Generation**
- sqlc is the source of truth for database queries
- **Never edit** `internal/repository/sqlite/*.sql.go` files directly
- Modify SQL in `internal/repository/sqlite/queries/` or `schema.sql`, then run `make sqlc`

**Format System**
- `internal/format/formatter.go` defines a single interface (`DeckFormatter` with `Import()` and `Export()`)
- Each format gets its own package: `ptcglive/`, `limitless/`, etc.
- Format selection happens in `internal/api/deck_handler.go` via `formatterFor()`
- Adding formats is straightforward: implement the interface + add router case

**Card Data**
- `pkg/tcgdex/` is a self-contained public package with HTTP client + cache
- To swap card sources, implement the `card.TCGdexClient` interface and wire in `cmd/server/main.go`
- Energy cards receive special treatment: always fetch `swsh` set for images (set-agnostic)

### Dependency Injection Flow
```
cmd/server/main.go
  ├─ config.Load()
  ├─ repository.Open() → *sql.DB
  ├─ sqlitedb.NewDeckRepository(db)
  ├─ deck.NewService(deckRepo)
  ├─ api.NewDeckHandler(deckSvc)
  ├─ tcgdex.New() → TCGdex client with cache
  ├─ card.NewService(tcgdexClient)
  ├─ api.NewCardHandler(cardSvc)
  └─ server.New() + server.Start()
```

## Project Structure

```
cmd/server/main.go                   # Entry point, wires all dependencies

internal/
  api/                               # HTTP handlers (thin layer)
    deck_handler.go                  # Deck CRUD + import/export
    card_handler.go                  # Card search + detail
    response.go                      # Common response types

  card/                              # Card domain
    service.go                       # CardService (proxies TCGdex)
    types.go                         # Card type

  deck/                              # Deck domain
    service.go                       # DeckService
    types.go                         # Deck + Entry types, sections enum

  format/                            # DeckFormatter interface + implementations
    formatter.go                     # DeckFormatter interface
    ptcglive/parser.go               # PTCG Live format
    ptcglive/parser_test.go
    limitless/parser.go              # Limitless TCG format
    limitless/parser_test.go

  config/                            # Environment-based config
    config.go                        # Loads PORT, DATABASE_PATH, ENV

  repository/                        # Repository abstraction
    deck_repository.go               # DeckRepository interface
    db.go                            # Open(path), Migrate(db)
    sqlite/
      schema.sql                     # Source of truth for DDL
      queries/
        decks.sql                    # Deck queries
        entries.sql                  # Entry queries
      deck_repository.go             # SQLite implementation
      *.sql.go                       # sqlc-generated (DO NOT EDIT)

  server/                            # HTTP server wiring
    router.go                        # chi router, route definitions
    server.go                        # http.Server, graceful shutdown

pkg/tcgdex/                          # Public TCGdex API client
  client.go                          # HTTP client
  types.go                           # Card, Set types from TCGdex API
  cache.go                           # 15-minute in-memory cache

web/
  src/
    api/
      client.ts                      # Base HTTP client
      decks.ts                       # Deck API methods
      cards.ts                       # Card API methods
    types/
      deck.ts                        # TypeScript Deck interface
      card.ts                        # TypeScript Card interface
    pages/
      HomePage.tsx                   # Deck list + create (gallery thumbnails)
      DeckEditorPage.tsx             # Edit entries + import/export (default: gallery view)
      ImportPage.tsx                 # Paste decklist + select format
      PracticeHandsPage.tsx          # Generate 10 opening hands
      HandDetailPage.tsx             # Hand simulation (draw, thin, board, discard, undo)
    components/
      layout/                        # Nav, layout wrapper
      deck/
        DeckGalleryView.tsx          # Gallery view for deck editor (cards as images)
        DeckThumbnail.tsx            # Deck card thumbnail for home page
        CardRow.tsx                  # List-view row for a card entry
        SectionGroup.tsx             # Groups entries by section
        CardImageModal.tsx           # Art picker modal
      card/                          # Card search + selection
    hooks/
      useDecks.ts                    # Fetch + manage deck list
      useDeck.ts                     # Fetch single deck
      useCardSearch.ts               # Search cards with debounce
      useCardImages.ts               # Resolve card images; returns [imageMap, overrideImage]
      useDebounce.ts                 # Debounce hook
```

## Database

**Schema** is defined in `internal/repository/sqlite/schema.sql`. Migrations run automatically on startup.

**Tables**:
- `decks(id, name, format, created_at, updated_at)` — deck metadata
- `deck_entries(id, deck_id, card_id, name, set_code, number, count, section, position, image_url)` — individual cards
  - `section` is constrained to `pokemon | trainer | energy`
  - `image_url` stores per-entry custom art selection (default `''`)

**Modifying Queries**:
1. Edit SQL in `internal/repository/sqlite/queries/` (`.sql` files)
2. Run `make sqlc` to regenerate `*.sql.go` files
3. Update `internal/repository/sqlite/deck_repository.go` if method signatures changed

## API Routes

All routes are under `/api`:

**Decks**
- `GET /decks` — list all decks
- `POST /decks` — create deck
- `GET /decks/:id` — get deck with entries
- `PUT /decks/:id` — update deck metadata
- `DELETE /decks/:id` — delete deck

**Deck Entries**
- `POST /decks/:id/entries` — add card
- `PUT /decks/:id/entries/:eid` — update count/imageUrl
- `PUT /decks/:id/entries/:eid/art` — update entry's custom art image URL
- `DELETE /decks/:id/entries/:eid` — remove card

**Import/Export**
- `POST /decks/import?format=ptcglive|limitless` — parse text, optionally save
- `GET /decks/:id/export?format=ptcglive|limitless` — export as text

**Cards**
- `GET /cards/search?q=charizard&set=OBF` — search TCGdex
- `GET /cards/:id` — get card detail

**Health**
- `GET /health` → `200 "ok"`

## Testing

Tests follow Go conventions with `*_test.go` files alongside source code.

**Test Patterns**:
- Format parsers use table-driven imports/exports + roundtrip validation
- Example: `internal/format/ptcglive/parser_test.go`
  - `TestImport`: Parse sample decklist, verify structure
  - `TestRoundtrip`: Import → Export → Re-import, compare totals
- Use standard library `testing` package (no external frameworks)

**Run Tests**:
```bash
make test           # All tests
make test-v         # Verbose
go test ./...       # Manual invocation
go test -run TestImport ./internal/format/ptcglive  # Single test
```

## Adding a New Decklist Format

1. Create `internal/format/yourformat/parser.go` implementing `DeckFormatter`
   - Implement `Import(text string) (*deck.Deck, error)` and `Export(d *deck.Deck) (string, error)`
2. Add `parser_test.go` with import + roundtrip tests
3. Add case in `internal/api/deck_handler.go` → `formatterFor()` function to register it
4. Routes already handle the `?format=` query param generically

## Frontend Patterns

**API Client**:
- Typed wrappers in `src/api/` (`decks.ts`, `cards.ts`)
- Base client in `src/api/client.ts` handles `Content-Type`, error handling
- All requests go to `/api/*` (Vite dev proxies to Go backend)

**Hooks**:
- Data fetching: `useDecks`, `useDeck`, `useCardSearch`
- Side effects: `useDebounce` for search input
- Image resolution: `useCardImages` — returns `[imageMap, overrideImage]`
  - Module-level cache (`imageCache`) persists across unmount/remount and page navigation
  - `overrideImage(key, url)` lets callers manually set an image (art picker)
  - Supports `imageUrl` field on entries for persisted/saved art selections

**Component Organization**:
- Page components in `src/pages/` correspond to route paths
- Reusable components in `src/components/` with CSS modules
- Props pass data down, events bubble up

**Energy Card Image Handling**:
- Frontend detects energy cards by `section === 'energy'`
- Tries swsh set first, falls back to original setCode
- Backend complements this: `CardService.Get()` detects basic energy, forces swsh lookup

**Deck Editor View Modes**:
- Default view is gallery (`DeckGalleryView`) — cards displayed as images grouped by section
- Gallery supports increment/decrement, remove, and art picker (select/save art per entry)
- Art selections saved to the entry's `imageUrl` field and persisted to the DB

## Hand Detail Page (Game Simulation)

Route: `/decks/:id/practice/:handIndex` — navigated to from `PracticeHandsPage` by clicking a hand panel.

State is passed via React Router `location.state` (type `{ hand: Hand, entries: CardEntry[] }`). No backend calls are made on this page.

**Game State** (`GameState` type):
- `handCards` — cards in hand (from opening deal)
- `nextCard` — top card after hand (burn card)
- `remainingDeck` — draw pile
- `drawnCards` — cards drawn one at a time via "Draw" button
- `thinnedCards` — cards removed from deck via thin action (deck reshuffles after)
- `boardCards` — cards moved to the board zone
- `discardCards` — cards moved to the discard zone

**Actions**:
- **Draw** — pull top card of remaining deck into drawn pile
- **Thin** — remove a card from remaining deck (sorted view), deck reshuffles
- **Board / Discard** — hover any hand/drawn/thinned/next card to reveal buttons that move it to the board or discard zone
- **Reshuffle** — shuffle all non-boarded, non-discarded cards back into the deck
- **Shuffle to Bottom** — send hand + drawn + thinned cards to bottom of deck
- **Draw 6 / Draw 8** — draw N cards from remaining deck directly into hand
- **Undo** — revert to previous game state (full history stack); also triggered by Cmd/Ctrl+Z

**HoverCard component**: wraps any card image and shows "Board" / "Discard" action buttons on mouse enter.

## Configuration

Environment variables (defaults provided for development):
```
PORT=8080                    # HTTP listen port
DATABASE_PATH=poketools.db   # SQLite file
ENV=development              # development or production
```

## Development Tips

**Vite proxy issue**: The Vite dev server proxies `/api/*` to `http://localhost:8080`. Make sure the Go backend is running (`make dev-backend`).

**CORS**: Development CORS allows `localhost:5173` and `localhost:8080`. For other origins, update `internal/server/router.go`.

**sqlc installation**: Required only when modifying SQL queries. Install via:
```bash
go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest
```

**IDE Setup**: The `.idea/` directory is gitignored. IntelliJ projects rebuild on open.

## Utility Scripts

- `scripts/clear_tables.sh` — clears deck and deck_entries tables from SQLite database. Usage: `./scripts/clear_tables.sh [DATABASE_PATH]`

## Related Documentation

- README.md — Project overview, getting started, detailed API reference
- STUDY_GUIDE.md — Implementation walkthrough, feature notes (reference for understanding changes)