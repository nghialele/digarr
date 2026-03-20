# Digarr

[![CI](https://github.com/iuliandita/digarr/actions/workflows/ci.yml/badge.svg)](https://github.com/iuliandita/digarr/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Bun](https://img.shields.io/badge/runtime-Bun-f9f1e1?logo=bun)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)](deploy/docker/)
[![Tests](https://img.shields.io/badge/tests-758_passing-brightgreen)]()
[![Release](https://img.shields.io/github/v/tag/iuliandita/digarr?label=release)](https://github.com/iuliandita/digarr/releases)

**AI-powered music discovery for your *arr stack.** Digarr analyzes your listening history from ListenBrainz or Last.fm, finds similar artists using MusicBrainz and AI, scores and ranks them, and lets you approve recommendations -- optionally adding them straight to Lidarr, or curating a personal list to export.

Think of it as Jellyseerr/Overseerr, but for music discovery.

![Dashboard](docs/screenshots/dashboard-dark.png)

[More screenshots](docs/SCREENSHOTS.md)

---

## Why Digarr?

Digarr was inspired by and builds on ideas from some great projects in the self-hosted music discovery space:

- [**Mixarr**](https://github.com/DrMxrcy/mixarr) -- the trailblazer for AI-powered music discovery with *arr integration. Supports a wide range of listening sources and multi-user.
- [**Aurral**](https://github.com/icefire-luo/aurral) -- clean Last.fm-based artist recommendations with tag similarity and weekly Soulseek/Navidrome flows.
- [**Lidify**](https://github.com/Gorefistus/lidify) -- lightweight and focused similar-artist discovery via Last.fm.
- [**Explo**](https://github.com/HoreaM/explo) -- clean ListenBrainz-to-music-server pipeline written in Go.
- [**Yoink**](https://github.com/droqen/yoink) -- multi-provider metadata aggregation with confidence-scored provider links.
- [**Kima Hub**](https://github.com/rolinston4/KimaHub) -- neural network mood analysis and 2D/3D music maps.
- [**Soularr**](https://github.com/mrusse/soularr) -- bridges Lidarr wanted lists to Soulseek downloads.
- [**MusicMoveArr**](https://github.com/music-move-arr/music-move-arr) -- large Spotify/Deezer dataset used by digarr for genre gap filling and popularity scoring.

Digarr takes a different approach with a **7-stage weighted scoring pipeline** that learns from your feedback, supports multiple AI providers (Claude, GPT, Gemini, Ollama, any OpenAI-compatible), and adds library health monitoring, genre-based discovery, in-app music previews, and analytics -- all in a single self-hosted container.

---

## Features

- **Listening history analysis** -- connects to ListenBrainz and/or Last.fm to understand your taste
- **AI-powered recommendations** -- Anthropic (Claude), OpenAI, Google Gemini, Ollama, or any OpenAI-compatible provider; includes written explanations per artist
- **Smart scoring** -- weighted composite across consensus, similarity, genre overlap, AI confidence, feedback learning, and popularity; configurable weights, thresholds, and cooldowns
- **Lidarr-optional** -- approve recommendations into Lidarr, or run in discovery-only mode without Lidarr. Setup wizard lets you choose. Export your curated list as JSON, CSV, or M3U
- **Target registry** -- pluggable approval targets (Lidarr first, Navidrome/Jellyfin planned). Configure and test targets from Settings
- **Artist enrichment** -- images (fanart.tv via Lidarr), streaming links (Spotify, YouTube, Deezer), MusicBrainz metadata; optional Spotify genre/popularity enrichment via MusicMoveArr dataset import
- **Music previews** -- play Spotify embeds, Deezer 30-sec clips, or YouTube previews directly from recommendation cards
- **Genre discovery** -- browse genres from your library, search the full catalog, view genre detail pages with sub-genres and library overlap; subscribe to genres for automatic discovery
- **Library health dashboard** -- 6 automated checks (missing metadata, unmonitored artists, missing albums, duplicates, genre gaps, image gaps) with one-click batch fixes, auto-rescan after fixes, and artist links to Lidarr
- **Swipe-to-approve** -- swipe right to approve, left to reject on mobile; desktop gets hover action buttons and a card-stack mode
- **Bulk actions** -- select multiple recommendations, approve or reject in batch
- **Multi-user** -- per-user recommendation queues, session auth with username/password, admin role, installable as a PWA
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
2. **Analyze** -- builds a taste profile from your ListenBrainz/Last.fm listening data
3. **Discover** -- queries multiple sources for similar artists (Last.fm similar artists, AI recommendations, library-seeded discovery)
4. **Resolve** -- validates each candidate against MusicBrainz, fetches metadata, streaming URLs, and artist images; enriches sparse genres from Spotify data if available
5. **Score** -- applies a weighted composite formula (consensus, similarity, genre overlap, AI confidence, feedback boost, popularity)
6. **Filter** -- removes artists already in your library, previously rejected artists (with cooldown), and below-threshold scores
7. **Store** -- persists the batch and recommendations to the database

The pipeline runs on a configurable cron schedule or manually via the "Run Scan" button.

---

## Requirements

| Service | Required | Purpose |
|---------|----------|---------|
| **Lidarr** | Optional | Music library management + auto-download. Works without it in discovery-only mode |
| **ListenBrainz** or **Last.fm** | At least one | Listening history for taste analysis |
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
