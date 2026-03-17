# Contributing to Digarr

## Dev setup

```sh
git clone https://github.com/your-org/digarr.git
cd digarr
bun install
```

Start PostgreSQL (requires Docker):

```sh
docker run -d \
  --name digarr-pg \
  -e POSTGRES_USER=digarr \
  -e POSTGRES_PASSWORD=digarr \
  -e POSTGRES_DB=digarr \
  -p 5432:5432 \
  postgres:17-alpine
```

Or use the Compose file:

```sh
# From deploy/docker -- only starts the postgres service
docker compose up postgres -d
```

Copy the env file and set your API keys:

```sh
cp .env.example .env
# edit .env with your Lidarr URL/key, Last.fm key, etc.
```

Run migrations and start the dev server:

```sh
bun run db:migrate
bun run dev
```

The app is now at http://localhost:3000.

---

## Code style

Digarr uses [Biome](https://biomejs.dev/) for linting and formatting.

```sh
bun run lint        # check
bun run lint:fix    # auto-fix
```

TypeScript strict mode is enforced. No `any` -- use `unknown`, generics, or proper types.

---

## Testing

```sh
bun run test         # run once
bun run test:watch   # watch mode
```

Tests live in `tests/`. Keep them close to the code they cover.

---

## Submitting a PR

1. Fork and create a branch: `git checkout -b feat/my-thing`
2. Make your changes, keeping commits focused
3. Confirm `lint`, `typecheck`, and `test` all pass
4. Open a PR against `main` -- fill in the template
5. A maintainer will review; be ready to iterate

---

## Commit style

Conventional commits: `type(scope): description`

Types: `feat`, `fix`, `docs`, `refactor`, `chore`, `ci`

Examples:
- `feat(pipeline): add spotify source`
- `fix(lidarr): handle 404 on artist lookup`
- `docs: update contributing guide`
