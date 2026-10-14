# Ontario Life 🍁

A Sims-style life sim across Ontario's 401 corridor, from **Ottawa** to **Kitchener-Waterloo**. You start in your hometown, **Oshawa**. Ride GO trains and buses, take VIA Rail, carpool or drive the 401, eat your way through 11 cities, work shifts, make friends, and pay rent on the 1st.
Plain HTML/CSS/JS, no build step, no API keys. Progress saves to `localStorage` (key `ontarioLife.v1`, separate from Toronto Life).
**Two ways to run it:**
- **Guest / static mode:** any static host (or `file://`). Fully playable offline, no accounts.
- **Online mode:** the optional Node server in [`server/`](server) serves the same game from one origin and adds accounts, cloud saves, real friends, DMs, leaderboards and "meet a real player" in cities. If the server isn't there, the game quietly stays in guest mode.

Grew out of [Toronto Life](../toronto-life) (whose Toronto spots are all kept). Inspired by the idea of city life-sims like Lagos Life; all code, art (emoji + CSS/SVG) and text here are original.

## Run it
**Online mode (Node 20+):**
```
cd server && npm install        # express, better-sqlite3, bcryptjs, zod, helmet, cors, express-rate-limit, cookie-parser
cp .env.example .env            # optional; every variable has a safe default
npm start                       # http://127.0.0.1:8082 (game + /api on one origin), SQLite at server/data/ontario-life.db
```
**Static guest mode:** `python3 -m http.server 8081` then visit http://localhost:8081 (or open `index.html` from `file://`). `backend.json` (`{"api": false}`) tells the game there is no server; the Node server answers that URL with `{"api": true}`.
Mobile-first (phone-sized layout); installable via `manifest.webmanifest` + `sw.js` (the service worker never caches `/api/`).

## Online features (server mode)
- **Accounts:** username + password (min 8 chars, bcrypt). Session = random token in an `HttpOnly; SameSite=Lax` cookie (`Secure` in production), stored hashed in SQLite, 30 days. On sign-up you can **claim your guest save** into the account (checked by default).
- **Cloud save:** `GET/PUT /api/save` with a version + `updatedAt` conflict check. The game autosyncs every 2 minutes when there are changes, and soon after key events (travel, moving, a new goal, a new day, game over), plus when the tab is hidden. `localStorage` stays the working copy, so offline play works and syncs later. On a conflict (two devices) you pick **Use the cloud save** or **Keep this device**. The HUD sync badge shows 👤 guest, ☁️✓ synced, ☁️• unsynced, 🔄 syncing, 📴 offline, ⚠️ conflict.
- **Real friends (🌐 Online → Friends):** profiles (display name, avatar emoji, home city, level, stats), search by username, friend requests (accept/decline; mutual requests auto-accept), friends list showing each friend's **current city** and **online status**.
- **Messages (Chat):** DMs between friends, polled every 4 s while a chat is open (inbox every 15 s). Max 500 chars, rate-limited, basic profanity filter, ⚑ report a message or player, block/unblock (blocking removes the friendship and stops DMs, requests, waves and search).
- **Leaderboards (Ranks):** net worth, cities visited, goals completed, days survived, each **weekly** (ISO week, UTC) or **all-time**, for all Ontario or **per home city**. Scores are submitted after a sync and checked by the server: bounds (11 cities, 22 goals...), at most one submission per 30 s, days can't grow faster than real time allows (30-day grace + 10 game days per real minute), and net worth must be plausible for the days played. Rejected submissions are logged.
- **Shared world:** when you're in a city, **📍 Here** shows real players in that city right now (friends tagged), and you can **👋 wave**. There's also a small city feed (arrivals, waves, goals). You only see who's in a city while you're in it too.

### API overview (all JSON under `/api`; writes need `X-OL-Client: 1`)
| Method & path | What it does |
|---|---|
| `GET /health`, `GET /meta` | Liveness; cities, avatars, limits |
| `POST /auth/signup` `{username,password,displayName?,avatar?,homeCity?}` | Create account and session cookie |
| `POST /auth/login`, `POST /auth/logout` | Session in, session out |
| `GET /me` (200 with `user:null` for guests), `PATCH /me`, `DELETE /me` `{password}` | Profile, edit, delete account |
| `GET /save`, `PUT /save` `{state, baseVersion, baseUpdatedAt?, force?}` | Cloud save; `409` + server summary on conflict |
| `POST /presence` `{city, loc?}` | Heartbeat and current city (online = seen in the last 2 min) |
| `GET /users/search?q=`, `GET /users/:username` | Find players, public profile (current city only for friends) |
| `GET /friends` | Friends (city, online, unread) plus incoming and outgoing requests |
| `POST /friends/requests` `{username}`; `POST /friends/requests/:id/accept\|decline`; `DELETE /friends/:username` | Friend requests and unfriending |
| `GET /messages/:username?after=id`, `POST /messages/:username` `{body}` | DMs (friends only; marks as read) |
| `GET /inbox` | Pending requests, unread counts, new waves |
| `GET/POST /blocks`, `DELETE /blocks/:username`, `POST /reports` | Block, unblock, report |
| `POST /leaderboard` `{netWorth,cities,goals,days,homeCity,city?}`; `GET /leaderboard?metric=&period=weekly\|alltime&city=` | Submit (validated) and read |
| `GET /world/:city`, `POST /world/wave` `{username}` | Players in your city and the feed; wave |

### Security
zod validation on every input (strict objects, enums for cities and avatars); helmet (CSP `script-src 'self'`, HSTS in production); CORS off by default (`CORS_ORIGINS` allowlist); CSRF defence = SameSite=Lax cookie + Origin check + required custom header; express-rate-limit per IP (API and auth) plus per-user limits (messages, friend requests, waves, reports, leaderboard); parameterized SQL only (better-sqlite3 prepared statements; leaderboard column names come from a whitelist); bcrypt with a constant-time-ish dummy compare for unknown users; only whitelisted game files are served (never `server/`, `.env`, tests); no secrets are needed or committed (`server/.env.example` documents the variables).

### Environment variables (`server/.env.example`)
`PORT` (8082), `HOST` (127.0.0.1; use `0.0.0.0` on a host), `NODE_ENV` (`production` turns on Secure cookies, HSTS, upgrade-insecure-requests), `DB_PATH` (`server/data/ontario-life.db`), `STATIC_DIR`, `COOKIE_SECURE`, `SESSION_TTL_DAYS` (30), `BCRYPT_ROUNDS` (12), `CORS_ORIGINS`, `TRUST_PROXY` (set `1` behind a platform proxy), `RATE_LIMIT_API_PER_MIN` (300), `RATE_LIMIT_AUTH_PER_15MIN` (20), `MSG_RATE_MAX`/`MSG_RATE_WINDOW_MS` (10 per 30 s), `FRIEND_REQ_PER_HOUR` (30), `LB_MIN_INTERVAL_MS` (30000), `LB_DAYS_GRACE` (30), `LB_MAX_DAYS_PER_MIN` (10), `ONLINE_WINDOW_MS` (120000), `CITY_WINDOW_MS` (600000), `MAX_SAVE_BYTES` (256 KB).

### Deployment notes (nothing is deployed by this repo)
- **Render / Railway / Fly.io:** run `cd server && npm ci && npm start` with `NODE_ENV=production HOST=0.0.0.0 TRUST_PROXY=1`, and the platform's `PORT`. SQLite needs a **persistent volume**: Render persistent disk, Railway volume, or `fly volumes create` mounted at e.g. `/data` with `DB_PATH=/data/ontario-life.db`. Run a **single instance** (SQLite is a local file; to scale out, move to Postgres). Back up the DB file (e.g. `sqlite3 .backup` or Litestream).
- HTTPS comes from the platform; keep the game and API on the same origin so cookies stay first-party.
- **GitHub Pages** (or any static host) can only serve **guest mode**: it serves `backend.json` with `api:false`, so there are no accounts or friends there.

## Test
```
npm install && npx playwright install chromium && (cd server && npm install)
npm --prefix server test    # API tests (node:test + supertest, in-memory SQLite): auth, CSRF, rate limits, save conflicts, friends, DMs, block/report, waves, leaderboard validation
node tests/smoke.js [url]   # starts the Node server on a free port with a temp DB (or uses [url]); guest UI path + bot plays ~21 days;
                            # then sign up (claim guest save) -> play -> autosync + Sync now -> new browser context -> sign in -> save restored -> reload.
                            # Fails on any console error/warning; writes screenshot-map.png + screenshot-city.png. A static URL runs guest-only.
node tests/social.js        # two players: search, friend request, accept, DMs both ways (HTML escaped), see each other's city and online status,
                            # meet in Toronto + wave, city feed, weekly/all-time/per-city leaderboards; writes screenshot-social.png
node tests/features.js      # 401 closure, VIA/GO routing, moving, Sens game, cottage weekend, canal skating
node tests/economy.js       # bot survives 75 days in Oshawa (with weekend trips), and a second bot moves to K-W
```

## How to play
- Keep **Energy, Hunger, Mood, Social** up and **Money** positive. Pay **rent on the 1st** at home (late fee on the 2nd, evicted on the 4th). Car owners also pay $160 insurance.
- **Map → city view**: tap a spot and take local transit (TTC, OC Transpo, DRT, MiWay, Brampton Transit, YRT/Viva, HSR, GRT, Kingston Transit, Guelph Transit), walk, taxi, or drive. 2-hour transfers; GTA agencies share a One Fare-style free transfer, including after a GO trip.
- **Map → 🗺️ Ontario**: regional SVG map (401, QEW, 416, GO lines, VIA corridor). Tap a city for trip options with real departure/arrival times:
  - **GO Train** (Lakeshore East/West, Kitchener, Stouffville lines; transfer at Union), **GO Bus** (all GO cities), distance-based fares, random delays.
  - **VIA Rail** (Toronto–Oshawa–Kingston–Ottawa, ~6 departures/day; auto-connects with GO to/from other cities).
  - **Carpool** (rideshare app) or **your own car** (buy a used Chevy in Oshawa): rush-hour traffic, Friday cottage traffic, collisions, construction, speed traps.
  - **Winter storms** can make the OPP close the 401: no driving, carpools or GO buses that day; trains run late.
- **Cities**: Ottawa, Kingston, Oshawa, Ajax/Pickering, Toronto, Vaughan/Markham, Brampton, Mississauga, Hamilton, Guelph, Kitchener-Waterloo, each with 3–6 local spots plus a station (departures board, motel/bench when you're away from home). Rent ranges from $580 (Kingston) to $850 (Toronto, Vaughan/Markham).
- **Jobs by city**: warehouse/logistics (Ajax, Oshawa, Brampton, Mississauga, Etobicoke), auto-parts plant (Oshawa), federal temp work (Ottawa; French classes raise pay), tech contracts (K-W; finish the coding course for dev pay), industrial (Hamilton), food plant (Guelph), campus jobs (Queen's, U of G), retail everywhere.
- **Moving**: visit any city and move there (truck $300, half price if a Good friend lives there). New rent from the 1st.
- **Friends**: 15 NPCs across the province. Chat/treat them, unlock favours (Good friend) and loans (Best friend).
- **Events**: 401 closures, GO service alerts, O-Train delays, Leafs/Sens nights (and the Battle of Ontario), Raptors/Sens/Generals/Ticats home games, cottage weekend invites, Canada geese, plows, raccoons, holidays.
- **Goals**: 22 goals incl. *Ontario tour* (visit all 11 cities), *Leaving the GTA* (move to Ottawa, Kingston, Hamilton, Guelph or K-W), GO commuter, VIA trip, 401 road warrior, Skateway, On the Hill, City of Waterfalls, Waterloo dreams.

## Files
`index.html` · `style.css` · `data.js` (cities, spots, foods, NPCs, goals, transit data) · `game.js` (engine, travel, UI) · `net.js` (optional online layer: login, sync, friends, chat, ranks, Here card) · `backend.json` · `manifest.webmanifest` · `sw.js` · `icon.svg` · `tests/` · `package.json`
`server/`: `src/app.js` (Express app, security middleware, static whitelist) · `src/auth.js` · `src/routes-save.js` · `src/routes-social.js` · `src/routes-leaderboard.js` · `src/routes-world.js` · `src/db.js` (SQLite schema) · `src/config.js` (env; reads cities/goals from `data.js`) · `src/profanity.js` · `test/` · `.env.example`

## Notes
- Food menus deliberately have no fish/tuna and no swallow-type foods.
- Fares, schedules, rents and wages are game-balanced approximations, not real timetables.
- Reset from Menu → Reset game, or clear site data. When signed in, a reset syncs too (the cloud keeps one save per account).
