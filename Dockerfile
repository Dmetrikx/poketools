# ── Stage 1: Build frontend ───────────────────────────────────────────────────
FROM node:22-alpine AS frontend
WORKDIR /app/web
COPY web/package.json web/package-lock.json* ./
RUN npm ci
COPY web/ ./
RUN npm run build

# ── Stage 2: Build Go binary ──────────────────────────────────────────────────
FROM golang:1.25-alpine AS backend
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=frontend /app/web/dist ./web/dist
# VERSION comes in as a build arg because .dockerignore excludes .git, so
# `git describe` can't run in here. CI passes the commit SHA; see
# .github/workflows/fly-deploy.yml.
ARG VERSION=docker
RUN go build -ldflags "-X github.com/dariomendez/poketools/internal/version.Version=${VERSION}" \
    -o bin/poketools ./cmd/server

# ── Stage 3: Runtime image ────────────────────────────────────────────────────
FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=backend /app/bin/poketools .

EXPOSE 8080
ENV PORT=8080
ENV DATABASE_PATH=/data/poketools.db
ENV ENV=production

CMD ["./poketools"]