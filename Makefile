.PHONY: dev dev-backend dev-frontend build build-backend build-frontend sqlc test clean

# ── Development ────────────────────────────────────────────────────────────────

dev: ## Run backend and frontend concurrently
	$(MAKE) -j2 dev-backend dev-frontend

dev-backend: ## Run the Go API server
	go run ./cmd/server

dev-frontend: ## Run the Vite dev server
	cd web && npm run dev

# ── Build ──────────────────────────────────────────────────────────────────────

build: build-frontend build-backend ## Build everything (frontend first, embedded in binary)

build-frontend:
	cd web && npm run build

build-backend:
	go build -o bin/poketools ./cmd/server

# ── Code Generation ────────────────────────────────────────────────────────────

sqlc: ## Regenerate sqlc query code
	sqlc generate

# ── Testing ────────────────────────────────────────────────────────────────────

test: ## Run all Go tests
	go test ./...

test-v: ## Run all Go tests (verbose)
	go test -v ./...

# ── Utilities ─────────────────────────────────────────────────────────────────

clean: ## Remove build artifacts
	rm -rf bin/ web/dist/

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'
