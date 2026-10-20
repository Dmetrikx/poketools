BINARY  := poketools
MODULE  := github.com/dariomendez/poketools
VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo dev)

.PHONY: dev dev-backend dev-frontend build build-backend build-frontend sqlc test test-v \
	deploy-check deploy-status deploy-logs kill-stale clean help

# ── Development ────────────────────────────────────────────────────────────────

dev: ## Run backend and frontend concurrently
	$(MAKE) -j2 dev-backend dev-frontend

# Builds and execs rather than `go run`. `go run` spawns the compiled binary
# as a CHILD, and on Ctrl-C that child routinely survives and keeps holding
# :8080. The next `make dev` then fails to bind, exits, and leaves you talking
# to a stale server from the previous run — while Vite happily keeps serving
# the frontend so everything looks fine.
#
# `exec` replaces the shell with the server, so Ctrl-C reaches it directly and
# graceful shutdown actually runs.
dev-backend: ## Run the Go API server
	@lsof -ti:$${PORT:-8080} >/dev/null 2>&1 && { \
		echo ""; \
		echo "  ERROR: port $${PORT:-8080} is already in use."; \
		echo "  Most likely a leftover server from a previous run:"; \
		echo ""; \
		echo "      make kill-stale"; \
		echo ""; \
		exit 1; \
	} || true
	@go build -o bin/$(BINARY) ./cmd/server && exec ./bin/$(BINARY)

dev-frontend: ## Run the Vite dev server
	cd web && npm run dev

# ── Build ──────────────────────────────────────────────────────────────────────

build: build-frontend build-backend ## Build everything (frontend first, embedded in binary)

build-frontend:
	cd web && npm run build

build-backend:
	go build -ldflags "-X $(MODULE)/internal/version.Version=$(VERSION)" -o bin/$(BINARY) ./cmd/server

# ── Code Generation ────────────────────────────────────────────────────────────

sqlc: ## Regenerate sqlc query code
	sqlc generate

# ── Testing ────────────────────────────────────────────────────────────────────

# -race is on by default: the session cleanup ticker and request handlers share
# the database pool, so data races are the failure mode most likely to reach
# production undetected.
test: ## Run all Go tests
	go test -race ./...

test-v: ## Run all Go tests (verbose)
	go test -race -v ./...

# ── Deployment ────────────────────────────────────────────────────────────────
#
# There is exactly one path to production: push to main. CI runs, and when it
# passes .github/workflows/fly-deploy.yml deploys that commit. Deliberately no
# `make deploy` — two paths that can disagree about what is running is worse
# than one slow one.

deploy-check: ## Verify the working tree is ready to be pushed to main
	@echo "==> tests"
	@go test -race ./...
	@echo "==> vet"
	@go vet ./...
	@echo "==> frontend"
	@cd web && npm run build
	@echo "==> git"
	@test -z "$$(git status --porcelain)" || { echo "working tree is dirty"; exit 1; }
	@echo
	@echo "Ready. Push to main to deploy."

deploy-status: ## Show the deployed app's status
	fly status

deploy-logs: ## Tail production logs
	fly logs

# ── Utilities ─────────────────────────────────────────────────────────────────

kill-stale: ## Kill a leftover dev server holding the HTTP port
	@pids=$$(lsof -ti:$${PORT:-8080}); \
	if [ -n "$$pids" ]; then \
		echo "killing $$pids on port $${PORT:-8080}"; kill -9 $$pids; \
	else \
		echo "nothing listening on port $${PORT:-8080}"; \
	fi

clean: ## Remove build artifacts
	rm -rf bin/ web/dist/

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'
