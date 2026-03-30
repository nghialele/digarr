# Installing Digarr on Synology NAS

## Prerequisites

- Synology DSM 7.1+ with the **Docker** package (DSM 7.1) or **Container Manager** package (DSM 7.2+)
- At least 512 MB free RAM (app uses ~80 MB, PostgreSQL ~30 MB)
- Internet access for pulling images

---

## DSM 7.2+ (Container Manager -- has Project support)

Container Manager supports compose projects natively. This is the easiest path.

### Option A: GUI

1. Open **Container Manager** > **Project** > **Create**
2. Set the project name to `digarr`
3. Set the path to a shared folder (e.g., `/volume1/docker/digarr`)
4. Paste the contents of the [docker-compose.yml](https://raw.githubusercontent.com/iuliandita/digarr/main/deploy/docker/docker-compose.yml)
5. In the environment/variables section, set at minimum: `DB_PASS` (pick any password -- this is internal to the containers)
6. Click **Done**

Both the app and PostgreSQL containers start together automatically.

### Option B: SSH

```sh
mkdir -p /volume1/docker/digarr && cd /volume1/docker/digarr
curl -LO https://raw.githubusercontent.com/iuliandita/digarr/main/deploy/docker/docker-compose.yml
curl -LO https://raw.githubusercontent.com/iuliandita/digarr/main/deploy/docker/.env.example
cp .env.example .env
vi .env  # set DB_PASS at minimum
sudo docker compose up -d
```

---

## DSM 7.1 (Docker package -- no Project support)

The Docker package on DSM 7.1 does not support compose projects in the GUI.
You need to create the PostgreSQL and Digarr containers separately.

### Option A: GUI (two containers)

#### Step 1: Create the PostgreSQL container

1. Open **Docker** > **Registry** > search for `postgres`
2. Download `postgres:17-alpine`
3. Go to **Image** > select `postgres:17-alpine` > **Launch**
4. Name: `digarr-db`
5. Under **Advanced Settings** > **Environment**:
   - `POSTGRES_USER` = `digarr`
   - `POSTGRES_PASSWORD` = pick a password (remember it for the next step)
   - `POSTGRES_DB` = `digarr`
6. Under **Advanced Settings** > **Volume**: add a volume mapping
   - Mount path: `/var/lib/postgresql/data`
   - Either create a new folder (e.g., `/volume1/docker/digarr-db`) or let Docker manage the volume
7. Under **Advanced Settings** > **Network**: leave as `bridge`
8. Click **Apply** to start the container
9. Go to **Container** > `digarr-db` > **Details** > **Network** and note the container's IP address (e.g., `172.17.0.2`)

#### Step 2: Create the Digarr container

1. Go to **Registry** > search for `iuliandita/digarr`
2. Download `iuliandita/digarr:latest`
3. Go to **Image** > select `iuliandita/digarr:latest` > **Launch**
4. Name: `digarr`
5. Under **Port Settings**: set local port `3000` -> container port `3000`
6. Under **Advanced Settings** > **Environment**:
   - `DATABASE_URL` = `postgresql://digarr:<your-password>@<postgres-ip>:5432/digarr`
     (replace `<your-password>` with the password from step 1, and `<postgres-ip>` with the IP from step 1.9)
   - `DIGARR_INITIAL_USERNAME` = pick an admin username (optional but recommended)
   - `DIGARR_INITIAL_PASSWORD` = pick a password, min 8 chars (optional but recommended)
7. Click **Apply** to start the container

Open `http://<nas-ip>:3000` in your browser.

> **Tip:** If the postgres container IP changes after a NAS reboot, the app
> will fail to connect. To avoid this, create a custom bridge network in
> **Docker** > **Network** and attach both containers to it -- then use the
> container name (`digarr-db`) as the hostname in `DATABASE_URL`:
> `postgresql://digarr:<password>@digarr-db:5432/digarr`

### Option B: SSH (recommended for 7.1)

Even without GUI compose support, `docker compose` works via SSH:

```sh
mkdir -p /volume1/docker/digarr && cd /volume1/docker/digarr
curl -LO https://raw.githubusercontent.com/iuliandita/digarr/main/deploy/docker/docker-compose.yml
curl -LO https://raw.githubusercontent.com/iuliandita/digarr/main/deploy/docker/.env.example
cp .env.example .env
vi .env  # set DB_PASS at minimum
sudo docker compose up -d
```

---

## ARM-based Synology models

Digarr publishes multi-arch images (amd64 + arm64). ARM-based models
(DS220j, DS223, DS124, etc.) work out of the box -- Docker pulls the
correct architecture automatically.

## Updating

### Compose (SSH or DSM 7.2 Project)

```sh
cd /volume1/docker/digarr
sudo docker compose pull
sudo docker compose up -d
```

### GUI (DSM 7.1)

1. Open **Docker** > **Registry** > search for `iuliandita/digarr`
2. Download the latest tag
3. Stop the `digarr` container
4. **Action** > **Reset** (this recreates the container with the new image)
5. Start the container

PostgreSQL does not need to be updated unless you specifically want a newer version.

## Notes

- PostgreSQL data persists in a volume across restarts and updates.
- Resource usage is low enough for entry-level NAS models (1 GB RAM).
- If using a reverse proxy (Synology's built-in or external), set
  `ALLOWED_ORIGIN` to your public URL (via environment variable or the web UI).
