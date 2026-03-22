# Digarr

[![CI](https://github.com/iuliandita/digarr/actions/workflows/ci.yml/badge.svg)](https://github.com/iuliandita/digarr/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Bun](https://img.shields.io/badge/runtime-Bun-f9f1e1?logo=bun)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)](deploy/docker/)
[![Tests](https://img.shields.io/badge/tests-962_passing-brightgreen)]()
[![Release](https://img.shields.io/github/v/tag/iuliandita/digarr?label=release)](https://github.com/iuliandita/digarr/releases)

**AI-powered music discovery for your *arr stack.** Digarr analyzes your listening history from ListenBrainz, Last.fm, Spotify, Plex, Jellyfin, or Discogs, finds similar artists using MusicBrainz and AI, scores and ranks them, and lets you approve recommendations -- optionally adding them straight to Lidarr, or curating a personal list to export.

Think of it as Jellyseerr/Overseerr, but for music discovery.

![Dashboard](docs/screenshots/dashboard-dark.png)

[More screenshots](docs/SCREENSHOTS.md)

---

## Why Digarr?

Digarr was inspired by and builds on ideas from some great projects in the self-hosted music discovery space:

- [**Mixarr**](https://github.com/aquantumofdonuts/mixarr) -- the trailblazer for AI-powered music discovery with *arr integration. Supports a wide range of listening sources and multi-user.
- [**Aurral**](https://github.com/lklynet/aurral) -- artist discovery and request manager for Lidarr with tag similarity and Soulseek/Navidrome flows.
- [**Lidify**](https://github.com/TheWicklowWolf/Lidify) -- music discovery based on selected Lidarr artists via Spotify or Last.fm.
- [**Explo**](https://github.com/LumePart/Explo) -- Spotify's "Discover Weekly" for self-hosted music systems.
- [**Yoink**](https://github.com/FlyinPancake/yoink) -- self-hosted music library manager with multiple metadata sources.
- [**Kima Hub**](https://github.com/Chevron7Locked/kima-hub) -- self-hosted music streaming with artist discovery, personalized playlists, and Lidarr integration.
- [**Soularr**](https://github.com/mrusse/soularr) -- bridges Lidarr wanted lists to Soulseek downloads.
- [**MusicMoveArr Datasets**](https://github.com/MusicMoveArr/Datasets) -- MusicBrainz/Spotify/Deezer/Tidal datasets used by digarr for genre gap filling and popularity scoring.

Digarr takes a different approach with a **7-stage weighted scoring pipeline** that learns from your feedback, supports multiple AI providers (Claude, GPT, Gemini, Ollama, any OpenAI-compatible), and adds library health monitoring, genre-based discovery, in-app music previews, and analytics -- all in a single self-hosted container.

---

## Features

- **6 data sources** -- ListenBrainz, Last.fm, Spotify (OAuth), Plex, Jellyfin, and Discogs. Each feeds into the taste profile with listening history, play counts, or collection data
- **AI-powered recommendations** -- Anthropic (Claude), OpenAI, Google Gemini, Ollama, or any OpenAI-compatible provider; includes written explanations per artist
- **Smart scoring** -- weighted composite across consensus, similarity, genre overlap, AI confidence, feedback learning, and popularity; configurable weights, thresholds, and cooldowns. Auto-approve mode can automatically add high-scoring recommendations to your targets after each scan
- **Mood discovery** -- free-text prompt discovery ("find me something like Boards of Canada but darker") powered by the same AI provider, with instant results right from the Discover page
- **Lidarr-optional** -- approve recommendations into Lidarr, or run in discovery-only mode without Lidarr. Setup wizard lets you choose. Per-artist Lidarr profile/root folder selection on approve. Export your curated list as JSON, CSV, M3U, or XSPF (XSPF includes artist images, AI reasoning annotations, streaming links, and MusicBrainz metadata per track)
- **Auto-playlists ("Digarr Digest")** -- automatically generate curated playlists from your approved recommendations and push them to Navidrome, Jellyfin, Plex, or Spotify. Four strategies: Weekly Digest (top recent picks), Genre Focus (single-genre deep dive), Mood Mix (vibe-based), and Rediscover (forgotten gems). Separate schedule from the main pipeline
- **Target registry** -- pluggable approval targets: Lidarr (download + monitor), Spotify Playlist (push to playlist via OAuth), Navidrome/Jellyfin/Plex (playlist push via API). Configure and test targets from Settings
- **OIDC/SSO authentication** -- sign in via Authentik, Authelia, Keycloak, Google, or any OIDC provider. Reverse proxy header auth (X-Forwarded-User) also supported. Local auth remains available as fallback
- **Feedback insights** -- see how your approval patterns shape future recommendations with a genre-level feedback panel on the Discover page
- **Artist enrichment** -- images (fanart.tv via Lidarr) with negative cache TTL (auto-retries after 7 days), streaming links (Spotify, YouTube, Deezer), MusicBrainz metadata; optional Spotify genre/popularity enrichment via [MusicMoveArr](https://github.com/MusicMoveArr/Datasets) dataset import
- **Music previews** -- play Spotify embeds, Deezer 30-sec clips, or YouTube previews directly from recommendation cards
- **Genre discovery** -- browse genres from your library, search the full catalog, view genre detail pages with sub-genres and library overlap; subscribe to genres for automatic discovery
- **Library health dashboard** -- 6 automated checks (missing metadata, unmonitored artists, missing albums, duplicates, genre gaps, image gaps) with one-click batch fixes, auto-rescan after fixes, and artist links to Lidarr
- **Swipe-to-approve** -- swipe right to approve, left to reject on mobile; desktop gets hover action buttons and a card-stack mode
- **Bulk actions** -- select multiple recommendations, approve or reject in batch
- **Multi-user** -- per-user recommendation queues, session auth with username/password, admin role, installable as a PWA. Each user has independent scoring weights, listening source connections, recommendation preferences (rejection cooldown, seed ratio, thresholds), and target configurations
- **Analytics dashboard** -- approval rates, genre trends, source effectiveness, batch history with pagination, discovery-over-time chart, score distribution histogram, approval rate trend, and time-to-act metrics
- **Webhook notifications** -- Discord, Slack, ntfy, Gotify, or any HTTP endpoint
- **Self-hosted** -- single container, runs alongside your existing *arr stack

---

## Quick Start

### Docker Compose (recommended)

```sh
git clone https://github.com/iuliandita/digarr.git
cd digarr/deploy/docker
cp .env.example .env
docker compose up -d
```

Open `http://localhost:3000` and complete the setup wizard. Alternatively, fill in the service env vars in `.env` and setup completes automatically on first boot. Database migrations run automatically on every startup.

For local development, see [CONTRIBUTING.md](CONTRIBUTING.md).

---

## How It Works

Digarr runs a recommendation pipeline with 7 stages:

1. **Collect** -- fetches your current Lidarr library
2. **Analyze** -- builds a taste profile from all connected sources (ListenBrainz, Last.fm, Spotify, Plex, Jellyfin, Discogs)
3. **Discover** -- queries sources for similar artists (Last.fm similar, Discogs genre search, AI recommendations, library-seeded discovery)
4. **Resolve** -- validates each candidate against MusicBrainz, fetches metadata, streaming URLs, and artist images; genre-aware disambiguation picks the correct artist when multiple share the same name; enriches sparse genres from Spotify data if available
5. **Score** -- applies a weighted composite formula (consensus, similarity, genre overlap, AI confidence, feedback boost, popularity)
6. **Filter** -- removes artists already in your library, previously rejected artists (with cooldown), and below-threshold scores
7. **Store** -- persists the batch and recommendations to the database

The pipeline runs on a configurable cron schedule or manually via the "Run Scan" button.

---

## Requirements

| Service | Required | Purpose |
|---------|----------|---------|
| **Lidarr** | Optional | Music library management + auto-download. Works without it in discovery-only mode |
| **Listening source** | At least one | ListenBrainz, Last.fm, Spotify, Plex, Jellyfin, or Discogs |
| **AI Provider** | Yes | Artist recommendations (Anthropic, OpenAI, Ollama, or any compatible endpoint) |
| **PostgreSQL** | Yes | Data storage (included in Docker Compose) |

---

## Configuration

All configuration is done through the web UI after initial setup -- connections, scoring weights, cron schedule, and preferences are all set there. See [`.env.example`](.env.example) for the full list of environment variable fallbacks (useful for zero-touch Docker deployments).

---

## Deployment

| Method | Path | Notes |
|--------|------|-------|
| Docker Compose | [`deploy/docker/`](deploy/docker/) | Recommended. Includes PostgreSQL. |
| Helm chart | [`deploy/helm/digarr/`](deploy/helm/digarr/) | Kubernetes. Bundled PostgreSQL or bring your own. |
| Raw k8s manifests | [`deploy/k8s/`](deploy/k8s/) | Reference manifests for advanced setups. |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

MIT -- see [LICENSE](LICENSE).
