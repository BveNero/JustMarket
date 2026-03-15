# JustMarket

Dark marketplace app with a real Python backend and SQLite database.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/BveNero/JustMarket)

## Features

- Shared accounts, listings, favorites, and chats stored in SQLite
- Register and log in as a company or customer
- Post listings with up to 4 uploaded images
- Browse and filter listings by category, condition, location, and search
- Save ads per logged-in account
- Open buyer-seller chat threads tied to listings
- Delete your own listings
- No seeded demo users, posts, or fake chat history

## Files

- [index.html](/Users/macbook/Desktop/company-marketplace/index.html): marketplace structure and UI
- [styles.css](/Users/macbook/Desktop/company-marketplace/styles.css): dark responsive styling
- [app.js](/Users/macbook/Desktop/company-marketplace/app.js): frontend state, API calls, uploads, filters, and chat logic
- [server.py](/Users/macbook/Desktop/company-marketplace/server.py): Python HTTP server, auth, API routes, and SQLite storage

## Run Locally

1. Open Terminal in [/Users/macbook/Desktop/company-marketplace](/Users/macbook/Desktop/company-marketplace).
2. Start the server:

```bash
python3 server.py
```

3. Open [http://127.0.0.1:8000](http://127.0.0.1:8000).

## Data

- Database file: [/Users/macbook/Desktop/company-marketplace/justmarket.db](/Users/macbook/Desktop/company-marketplace/justmarket.db)
- Client-side storage: only the session token is kept in `localStorage`
- Health check: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)

## Deploy On Render

This app is configured for Render in [render.yaml](/Users/macbook/Desktop/company-marketplace/render.yaml). It uses a persistent disk and stores the SQLite database at `/var/data/justmarket.db`.

1. Put the project in a GitHub repository.
2. In Render, create a new Blueprint or Web Service from that repo.
3. Render will read [render.yaml](/Users/macbook/Desktop/company-marketplace/render.yaml) and create the service with:
   - `python3 server.py` as the start command
   - `/health` as the health check
   - a persistent disk mounted at `/var/data`
4. After deploy, your public URL will be a `*.onrender.com` address.

## Important

- This is no longer a static-only site, so Netlify Drop is not enough.
- The current Render config uses the `starter` plan because persistent disks are needed for SQLite.
- If you want a free-tier-friendly architecture later, the next upgrade is moving from SQLite to Postgres.

## Deploy With Docker

There is also a [Dockerfile](/Users/macbook/Desktop/company-marketplace/Dockerfile) for container-based hosting.

```bash
docker build -t justmarket .
docker run -p 8000:8000 -e JM_DB_PATH=/data/justmarket.db justmarket
```
