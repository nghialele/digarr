# Digarr

[![CI](https://github.com/iuliandita/digarr/actions/workflows/ci.yml/badge.svg)](https://github.com/iuliandita/digarr/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Bun](https://img.shields.io/badge/runtime-Bun-f9f1e1?logo=bun)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)](deploy/docker/)
[![Tests](https://img.shields.io/badge/tests-962_passing-brightgreen)]()
[![Release](https://img.shields.io/github/v/tag/iuliandita/digarr?label=release)](https://github.com/iuliandita/digarr/releases)

**AI-powered music discovery for your *arr stack.** Digarr analyzes your listening history from ListenBrainz, Last.fm, Spotify, Plex, Jellyfin, or Discogs, finds similar artists using MusicBrainz and AI, scores and ranks them, and lets you approve recommendations -- optionally adding them straight to Lidarr, pushing them to a Spotify playlist, or generating weekly discovery playlists for your media server.

Think of it as Jellyseerr/Overseerr, but for music discovery.

![Dashboard](docs/screenshots/dashboard-dark.png)

[More screenshots](docs/SCREENSHOTS.md)

---

## What Makes Digarr Different

Most music discovery tools do one thing: pull similar artists from Last.fm and list them. Digarr goes further with a **7-stage AI-powered pipeline** that actually learns from your feedback:

- **Multi-source taste analysis** -- not just one listening source, but up to 6 (ListenBrainz, Last.fm, Spotify, Plex, Jellyfin, Discogs) combined into a single taste profile
- **AI reasoning** -- every recommendation comes with a written explanation of why the artist matches your taste, powered by your choice of Claude, GPT, Gemini, Ollama, or any OpenAI-compatible provider
- **Weighted scoring** -- recommendations are ranked by a configurable formula (consensus, similarity, genre overlap, AI confidence, feedback learning, popularity), not just a single similarity score
- **Feedback loop** -- approve and reject to teach the pipeline your taste. The more feedback, the better future recommendations get
- **Auto-playlists** -- generate weekly "Digarr Digest" playlists and push them to Navidrome, Jellyfin, Plex, or Spotify automatically
- **15 color themes** -- including streaming-service-inspired themes (Spotarr, Youtarr, Deezarr, Applarr, Tidarr, Amazarr, Qobuzarr) alongside editor classics (Tokyo Night, Catppuccin, Dracula, One Dark, Nord, Gruvbox, Solarized, Rose Pine)
- **Lidarr-optional** -- works without Lidarr in pure discovery mode. Export as JSON, CSV, M3U, or XSPF

---

## Features

### Discovery & Recommendations
- **6 data sources** -- ListenBrainz, Last.fm, Spotify (OAuth), Plex, Jellyfin, and Discogs. Each feeds into the taste profile with listening history, play counts, or collection data
- **AI-powered recommendations** -- Anthropic (Claude), OpenAI, Google Gemini, Ollama, or any OpenAI-compatible provider; includes written explanations per artist
- **Smart scoring** -- weighted composite across consensus, similarity, genre overlap, AI confidence, feedback learning, and popularity; configurable weights, thresholds, and cooldowns
- **Mood discovery** -- free-text prompt ("find me something like Boards of Canada but darker") with instant AI results right from the Discover page
- **Auto-approve** -- automatically add high-scoring recommendations to your targets after each scan
- **Artist logos** -- fanart.tv clearlogo support via Lidarr, displayed on the dashboard hero card
- **Genre discovery** -- browse genres from your library, view recommended/trending/deep-cuts artists per genre with preview playback, subscribe to genres for automatic discovery

### Playlists & Targets
- **Auto-playlists ("Digarr Digest")** -- 4 strategies: Weekly Digest, Genre Focus, Mood Mix, and Rediscover (forgotten gems). Push to Navidrome, Jellyfin, Plex, or Spotify on a separate schedule
- **Target registry** -- pluggable approval targets: Lidarr (download + monitor), Spotify Playlist (OAuth push), Navidrome/Jellyfin/Plex (playlist API). Configure and test from Settings
- **Export** -- JSON, CSV, M3U, XSPF (with artist images, AI reasoning, streaming links, and MusicBrainz metadata)

### Library & Analytics
- **Library health dashboard** -- 6 automated checks (missing metadata, unmonitored artists, missing albums, duplicates, genre gaps, image gaps) with one-click batch fixes
- **Analytics** -- approval rates, genre trends, source effectiveness, batch history, discovery-over-time chart, score distribution histogram, approval rate trend, and time-to-act metrics
- **Feedback insights** -- see how your approval patterns shape future recommendations

### UX & Auth
- **OIDC/SSO authentication** -- Authentik, Authelia, Keycloak, Google, or any OIDC provider. Reverse proxy header auth also supported
- **Multi-user** -- per-user recommendation queues, listening sources, scoring weights, and target configurations
- **Music previews** -- Spotify embeds, Deezer 30-sec clips, or YouTube previews directly from recommendation and genre cards
- **Swipe-to-approve** -- swipe right to approve, left to reject on mobile; desktop gets hover buttons and card-stack mode
- **Contextual hints** -- 24 dismissable tips throughout the app guide new users without cluttering the experience for veterans
- **Progressive disclosure** -- settings organized into Essential/Tuning/Advanced tiers
- **15 themes** with dark and light variants, grouped into Editor and Streaming categories
- **Webhook notifications** -- Discord, Slack, ntfy, Gotify, or any HTTP endpoint
- **Self-hosted** -- single container, runs alongside your existing *arr stack

---

## The Self-Hosted Music Discovery Landscape

Digarr exists in a growing ecosystem of self-hosted music discovery tools. Here's how they compare:

### Direct Competitors

| App | Stars | Approach | AI? | Lidarr? |
|-----|-------|----------|-----|---------|
| **Digarr** | -- | 7-stage AI pipeline with scoring + feedback | 5 providers | Optional |
| [**Aurral**](https://github.com/lklynet/aurral) | 880+ | Last.fm similar artists + Weekly Flow playlists | No | Required |
| [**Sonobarr**](https://github.com/Dodelidoo-Labs/sonobarr) | 350+ | Last.fm + optional AI assistant | Optional | Required |
| [**MixArr**](https://github.com/aquantumofdonuts/mixarr) | 90+ | 56 subscription types across 12 services | 1 of 56 | Required |
| [**Brainarr**](https://github.com/RicherTunes/Brainarr) | 30+ | Native Lidarr plugin with local AI | Local-first | Plugin |

### Adjacent Tools

| App | Stars | What It Does |
|-----|-------|-------------|
| [**Kima Hub**](https://github.com/Chevron7Locked/kima-hub) | 1,070+ | Self-hosted Spotify replacement with audio ML (Vibe System, mood mapping) |
| [**SoulSync**](https://github.com/Nezreka/SoulSync) | 1,260+ | Full music collection manager: Soulseek/Tidal/YouTube downloads, auto playlists |
| [**Explo**](https://github.com/LumePart/Explo) | 1,000+ | "Discover Weekly for self-hosted" -- ListenBrainz recs to media server playlists |
| [**Lidify**](https://github.com/TheWicklowWolf/Lidify) | 530+ | Simple: Lidarr library -> Last.fm similar -> one-click add |
| [**Yoink**](https://github.com/FlyinPancake/yoink) | 95+ | Music acquisition tool with cross-provider album matching (Rust) |
| [**Resonance**](https://github.com/jordojordo/deepcrate) | 35+ | Preview-first discovery with Soulseek downloads |
| [**re-command**](https://github.com/Snapyou2/re-command) | 80+ | ListenBrainz weekly recs downloaded and tagged for Navidrome |
| [**DiscoveryLastFM**](https://github.com/MrRobotoGit/DiscoveryLastFM) | 170+ | Fully automated Last.fm -> Lidarr pipeline (no UI) |
| [**LMS**](https://github.com/epoupon/lms) | 1,560+ | C++ music server with built-in tag-based recommendations |

### Data Sources

- [**MusicMoveArr Datasets**](https://github.com/MusicMoveArr/Datasets) -- MusicBrainz/Spotify/Deezer/Tidal datasets used by Digarr for genre gap filling and popularity scoring
- [**troi-recommendation-playground**](https://github.com/metabrainz/troi-recommendation-playground) -- the engine behind ListenBrainz's recommendation algorithms

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

1. **Collect** -- fetches your current Lidarr library (or runs without it in discovery mode)
2. **Analyze** -- builds a taste profile from all connected sources (ListenBrainz, Last.fm, Spotify, Plex, Jellyfin, Discogs)
3. **Discover** -- queries sources for similar artists (Last.fm similar, Discogs genre search, AI recommendations, library-seeded discovery)
4. **Resolve** -- validates each candidate against MusicBrainz, fetches metadata, streaming URLs, artist images, and logos; genre-aware disambiguation picks the correct artist when multiple share the same name; enriches sparse genres from Spotify data if available
5. **Score** -- applies a weighted composite formula (consensus, similarity, genre overlap, AI confidence, feedback boost, popularity)
6. **Filter** -- removes artists already in your library, previously rejected artists (with cooldown), and below-threshold scores
7. **Store** -- persists the batch and recommendations to the database

The pipeline runs on a configurable cron schedule or manually via the "Run Scan" button. Subscriptions can also trigger targeted discovery for specific genres or similar-artist seeds.

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
