# Digarr

[![CI](https://github.com/your-org/digarr/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/digarr/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Music discovery for your Lidarr library.** Digarr pulls your listening history from Last.fm or ListenBrainz, uses an AI model to find artists you might like, and pushes new additions straight to Lidarr.

---

## Features

- Connects to Last.fm or ListenBrainz for listening history
- AI-powered artist recommendations (OpenAI or Anthropic)
- Enriches results via MusicBrainz metadata
- One-click Lidarr integration -- adds artists and triggers search
- Setup wizard + web UI
- Scheduled background runs (configurable interval)

---

## Quick start

```sh
# 1. Clone
git clone https://github.com/your-org/digarr.git
cd digarr/deploy/docker

# 2. Copy and edit env
cp .env.example .env

# 3. Start
docker compose up -d

# 4. Open the setup wizard
open http://localhost:3000
```

Complete the setup wizard to connect your Lidarr instance, music source, and AI provider. Digarr will start discovering artists immediately.

---

## Configuration

All configuration is done through the web UI. The underlying values are stored in the database -- no config files to manage.

For environment variable reference see [`deploy/docker/.env.example`](deploy/docker/.env.example).

---

## Deployment

| Method | Guide |
|--------|-------|
| Docker Compose | [`deploy/docker/`](deploy/docker/) |
| Helm (Kubernetes) | [`deploy/helm/`](deploy/helm/) |
| Raw manifests | [`deploy/k8s/`](deploy/k8s/) |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

MIT -- see [LICENSE](LICENSE).
