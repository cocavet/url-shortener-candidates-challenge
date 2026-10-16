# URL Shortener

## Tech Stack

```
url-shortener/
├── applications/web/    # React + React Router v7
└── libs/engine/         # Domain logic
```

| Technology                                    | Description                                                                                       |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [pnpm](https://pnpm.io/)                      | Fast, disk-efficient package manager with built-in monorepo support via workspaces                |
| [Turbo](https://turbo.build/)                 | High-performance build system for monorepos. Runs tasks in parallel and caches results            |
| [React](https://react.dev/)                   | Library for building user interfaces with components                                              |
| [React Router v7](https://reactrouter.com/)   | Full-stack React framework. Handles routing, data loading (loaders), mutations (actions), and SSR |
| [TypeScript](https://www.typescriptlang.org/) | Typed superset of JavaScript for catching errors at compile time                                  |
| [Sass](https://sass-lang.com/)               | SCSS styles organized with the BEM convention                                                     |
| [Vite](https://vite.dev/)                     | Fast build tool and dev server with hot module replacement                                        |

## Local Setup

Use Node.js 22.12+ and pnpm 10.20.0 (the version pinned in `package.json`). If your global pnpm version differs, use `npx --yes pnpm@10.20.0` in place of `pnpm` below.

```bash
pnpm install --frozen-lockfile
cp .env.example .env
pnpm db:generate
pnpm db:migrate
pnpm dev
```

Open `http://localhost:5173`

Development and production use the same custom Node server. `tsx` runs its TypeScript entrypoint; `sirv` serves the built client assets in production. To run the production build locally:

```bash
pnpm build
PUBLIC_URL=http://localhost:3000 pnpm --filter web start
```

`PUBLIC_URL` is required and must be an absolute HTTP(S) origin without credentials, a path, query or fragment. `PORT` defaults to 5173 in development and 3000 in production. The server validates configuration and checks that the migrated database is accessible before listening.

## Tests and Checks

```bash
pnpm test
pnpm test:watch
pnpm typecheck
pnpm format:check
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

Vitest runs the Node-based tests in `libs/**/tests/` and `applications/**/tests/` from the repository root, without starting the web server. Vitest 4.1.11 and Vite 7.3.1 are pinned; the runner reuses the Vite version already resolved by the application.

Prettier keeps source code, SCSS and configuration formatting consistent. Use `pnpm format` to apply formatting and `pnpm format:check` to check it; generated files, the package-manager lockfile and Markdown documents are excluded.

Tests cover domain rules, collision handling, cryptographic code generation, bounded click recording, HTTP adapters, configuration and rate limiting. SQLite integration tests deploy migrations into a temporary database and check uniqueness, concurrent increments, reopening, repeated migration deployment and write-lock failures. They do not use your development database.

Playwright is a development dependency for real Chromium tests of creation, clipboard copying and its manual fallback, validation, pending submissions and statistics. `pnpm test:e2e` builds production assets and starts a dedicated server at `http://127.0.0.1:4173` with a temporary SQLite database, removed on shutdown. It refuses to reuse an existing server. The browser journeys include Unicode destinations and GET/HEAD redirect serialization. HTTP tests also check rejection of unfinished oversized requests. Install Chromium once with the command above; browser binaries and test artifacts are excluded from Git and Docker.

## Database

The data layer uses Prisma 7.10.0 with SQLite, `@prisma/adapter-better-sqlite3` and `better-sqlite3`. Set `DATABASE_URL=file:./dev.db` in `.env` when reusing an existing environment file. Relative paths are resolved from `libs/engine/prisma/`; absolute `file:` paths are also supported. SQLite files and the generated Prisma client are ignored by Git.

Run `pnpm db:generate` to generate the client and `pnpm db:migrate` to apply checked-in migrations. Migration deployment is repeatable and preserves existing links and counters. The CLI defaults to `file:./dev.db` when the variable is absent. The migration script sets `RUST_LOG=info` to work around [Prisma's fresh SQLite database issue on macOS](https://github.com/prisma/prisma/issues/29355).

The counter uses an atomic database increment. Recording waits for confirmation, up to a default 1000 ms deadline; SQLite lock waits are limited to 250 ms. The native driver is synchronous, so the deadline depends on the Node event loop being available. A failed or timed-out write is reported without failing the recording call or retrying automatically. A timed-out operation can still commit: these are recorded requests, not unique visitors or guaranteed destination views.

The web routes now use SQLite. Creation confirms the write before returning 201; invalid input returns 400 and storage failures return 503 with a generic message. GET `/s/:code` returns 302 and records the request; HEAD returns the same redirect without a body or increment. Unknown or malformed codes return 404. Redirects and dynamic responses use `Cache-Control: no-store`. Redirect destinations serialize Unicode domains and characters for HTTP headers while preserving the stored original URL.

Creation is limited to ten attempts per minute per socket IP by default, including invalid attempts. Configure `CREATION_RATE_LIMIT` and `CREATION_RATE_WINDOW_MS` to change the limit and window, and `CLICK_RECORDING_TIMEOUT_MS` for the counter deadline. Rejected attempts return 429 with `Retry-After` and do not write a link. The limiter retains at most 10,000 clients, expires old windows when reclaiming space and rejects new clients if capacity is full without evicting active quotas. Its state belongs to one process and resets on restart. Forwarded headers are ignored; proxy deployments need an explicit trusted-proxy design before treating them as client identities.

The responsive interface uses SCSS and BEM. It provides a URL form with validation and pending feedback, a shareable result, clipboard copying with a manual fallback, and a persisted list showing creation dates and recorded clicks. Reload the page to update counters after visits. The form retains its value on errors and prevents duplicate submissions while pending.

Creation forms are limited to 32 KiB before parsing, with HTTP 413 for larger bodies. The server counts received bytes even without `Content-Length`, closes rejected connections and includes these attempts in the creation quota. This leaves room for valid 2,048-character URLs after Unicode form encoding.

## Docker Setup

```bash
docker compose up --build -d --wait
```

Open `http://localhost:3000`

Requires Docker with the Compose plugin; no local Node installation or `.env` file is needed. The image uses Node 22.23.2 and pnpm 10.20.0, builds the Prisma client and web application inside Linux, and keeps the Prisma CLI for startup migrations. The native SQLite dependency is installed inside the image; compiler tools are confined to the dependency stage.

Startup applies `prisma migrate deploy` and starts the custom Node server only if migration deployment succeeds. The service runs as the image's `node` user. Compose enables an init process, and an HTTP health check verifies that the application can serve its database-backed home page.

SQLite is stored at `/data/links.db` in the named `sqlite-data` volume. Links and counters survive container recreation. `docker compose down` preserves the volume; adding `--volumes` removes it. The local development database is separate and excluded from the image, along with environment files and generated host binaries.

The public origin is set explicitly to `http://localhost:3000` in Compose so a development `.env` cannot change generated links to port 5173. If you change the published port or hostname, also update `PUBLIC_URL` in `docker-compose.yml` to match the address users visit.

To inspect startup or investigate an unhealthy service:

```bash
docker compose ps
docker compose logs web
```

Before submission, verify creation and copying in the browser, visit a short link and refresh its statistics. Then recreate the container and confirm that the same link and counter remain:

```bash
docker compose down
docker compose up -d --wait
```

**Verification status:** verified on Linux ARM64 with Docker Desktop 4.95.0. Production checks cover startup migrations, non-root volume access, creation, clipboard copying, GET/HEAD redirects, counters, errors and persistence after container recreation. The current 179 Vitest tests and type checking pass locally and inside Docker. Eight Playwright cases (six browser journeys and two HTTP checks) pass locally in Chromium. Build and type-check cache restoration were verified in a disposable container after deleting generated files. Other architectures have not been tested.

To run the Node tests and type checking without touching the running service's database:

```bash
docker build --target build -t url-shortener-checks .
docker run --rm --init url-shortener-checks sh -c 'pnpm test && pnpm typecheck --force'
```
