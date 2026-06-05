# Music Streaming Web App

A full-stack music streaming application built as a portfolio project. Users can
listen to music, create playlists, like songs, follow artists, and discover new
tracks through a personalised feed.

## Tech Stack

### Backend

- **Runtime**: Node.js 18
- **Framework**: Express 5
- **Database**: PostgreSQL (with `pg_trgm` for search)
- **Auth**: JWT access tokens + hashed refresh tokens (bcrypt)
- **File Storage**: Cloudinary (audio + images via `multer-storage-cloudinary`)
- **Other**: cors, helmet, morgan, express-rate-limit

### Frontend

- **Framework**: Next.js 16 (App Router, TypeScript)
- **Styling**: Tailwind CSS 4
- **State**: Zustand (player store)
- **Audio**: HTML5 Audio + WaveSurfer.js (waveform visualiser)
- **Search**: Fuse.js (client-side fuzzy matching)

## Project Structure

```text
.
├── src/                      # Backend (Node.js + Express)
│   ├── config/               # env.js, cloudinary.js
│   ├── controllers/          # Route handlers
│   ├── services/             # Business logic
│   ├── routes/               # Express routers
│   ├── middlewares/           # auth, error, upload (Cloudinary)
│   ├── utils/                # Response helpers, query utils
│   ├── db/
│   │   ├── schema.sql        # Full database schema
│   │   ├── migrations/       # Incremental SQL migrations
│   │   └── pool.js           # pg Pool config
│   ├── app.js                # Express app setup
│   └── server.js             # Server entry point
│
├── frontend/                 # Frontend (Next.js)
│   └── src/
│       ├── app/              # Next.js App Router pages
│       │   ├── (main)/       # User-facing pages
│       │   ├── admin/        # Admin panel pages
│       │   ├── login/
│       │   └── register/
│       ├── components/       # React components
│       │   ├── player/       # BottomPlayer, PlayerProvider
│       │   ├── layout/       # AppShell, Sidebar, AppHeader, etc.
│       │   ├── admin/        # AdminTable, AdminNotice
│       │   ├── playlist/
│       │   ├── song/
│       │   ├── like/
│       │   ├── follow/
│       │   ├── library/
│       │   ├── auth/
│       │   └── ui/
│       ├── stores/           # Zustand stores (player-store.ts)
│       ├── lib/              # API client, auth helpers, utilities
│       └── types/            # TypeScript type definitions
│
├── .env.example              # Backend env template
└── package.json              # Backend dependencies
```

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- A Cloudinary account (free tier works)

### 1. Clone and install

```bash
git clone <repo-url>
cd music
npm install
cd frontend && npm install && cd ..
```

### 2. Configure environment

Copy `.env.example` to `.env` in the project root, then fill in your values:

```env
NODE_ENV=development
PORT=5000

# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=music_streaming
DB_USER=postgres
DB_PASSWORD=your_postgres_password
DB_SSL=false

# Or use Supabase:
# DATABASE_URL=postgresql://postgres.ref:password@host:6543/postgres

FRONTEND_URL=http://localhost:3000

# JWT
JWT_ACCESS_SECRET=replace_with_at_least_32_random_characters
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_TOKEN_EXPIRES_DAYS=7

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```

Copy `frontend/.env.example` to `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

### 3. Create database

```sql
CREATE DATABASE music_streaming;
```

Run the schema:

```bash
psql -U postgres -d music_streaming -f src/db/schema.sql
```

If you are starting fresh, the schema already includes all tables. If upgrading
from an older version, run the migrations in order:

```bash
psql -U postgres -d music_streaming -f src/db/migrations/001_add_is_banned_to_users.sql
psql -U postgres -d music_streaming -f src/db/migrations/002_add_description_to_songs.sql
psql -U postgres -d music_streaming -f src/db/migrations/003_create_recently_played.sql
psql -U postgres -d music_streaming -f src/db/migrations/004_create_follows.sql
psql -U postgres -d music_streaming -f src/db/migrations/005_add_playlist_metadata.sql
psql -U postgres -d music_streaming -f src/db/migrations/006_add_waveform_cache_to_songs.sql
psql -U postgres -d music_streaming -f src/db/migrations/007_add_profile_fields_to_users.sql
```

### 4. Run

Start the backend (port 5000):

```bash
npm run dev
```

Start the frontend (port 3000) in a separate terminal:

```bash
cd frontend
npm run dev
```

Open `http://localhost:3000` in your browser.

## Database Schema

12 tables managed by PostgreSQL:

| Table | Purpose |
|---|---|
| `users` | Accounts, roles (`user`/`admin`), ban status |
| `artists` | Artist profiles, optionally linked to a user |
| `genres` | Music categories with slugs |
| `albums` | Albums linked to an artist |
| `songs` | Tracks with Cloudinary URLs, play count, waveform cache |
| `likes` | User song likes (unique per user+song) |
| `playlists` | User playlists (public/private) |
| `playlist_songs` | Songs in playlists with ordering |
| `refresh_tokens` | Hashed refresh tokens for auth sessions |
| `listening_history` | Full play history per user |
| `recently_played` | Deduplicated recent plays per user |
| `follows` | Social connections between users |

Search uses `pg_trgm` GIN indexes on `users`, `artists`, `genres`, `albums`, and
`songs` for fast fuzzy matching.

## API Reference

Base URL: `http://localhost:5000/api`

### Health

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/health` | — | Health check |

### Auth

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | — | Register a new account |
| POST | `/auth/login` | — | Login, returns tokens |
| POST | `/auth/refresh` | — | Refresh access token |
| POST | `/auth/logout` | — | Revoke refresh token |
| GET | `/auth/me` | User | Get current user profile |
| PATCH | `/auth/me` | User | Update display name and bio |
| POST | `/auth/me/avatar` | User | Upload avatar (Cloudinary) |

### Songs

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/songs` | — | List songs (paginated, filterable) |
| GET | `/songs/search?q=` | — | Search songs by title |
| GET | `/songs/me` | User | Get my uploaded songs |
| GET | `/songs/:id` | — | Get song by ID |
| GET | `/songs/:id/waveform` | — | Get cached waveform peaks |
| POST | `/songs/:id/waveform` | — | Save waveform peaks |
| POST | `/songs/:id/listen` | Optional | Increment play count + save history |
| POST | `/songs/upload` | User | Upload a track (audio + cover to Cloudinary) |
| PATCH | `/songs/:id/play` | — | Increment play count only |
| POST | `/songs` | Admin | Create song record |
| PUT | `/songs/:id` | Admin | Update song record |
| DELETE | `/songs/:id` | Admin | Soft-delete song (`is_active = false`) |

Query parameters for `GET /songs`: `page`, `limit`, `genre_id`, `artist_id`,
`album_id`.

### Artists

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/artists` | — | List artists (`?page=&limit=&q=`) |
| GET | `/artists/:id` | — | Get artist by ID |
| POST | `/artists` | Admin | Create artist |
| PUT | `/artists/:id` | Admin | Update artist |
| DELETE | `/artists/:id` | Admin | Delete artist |

### Genres

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/genres` | — | List genres (`?page=&limit=&q=`) |
| GET | `/genres/:id` | — | Get genre by ID |
| POST | `/genres` | Admin | Create genre |
| PUT | `/genres/:id` | Admin | Update genre |
| DELETE | `/genres/:id` | Admin | Delete genre |

### Albums

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/albums` | — | List albums (`?page=&limit=&q=`) |
| GET | `/albums/:id` | — | Get album by ID |
| POST | `/albums` | Admin | Create album |
| PUT | `/albums/:id` | Admin | Update album |
| DELETE | `/albums/:id` | Admin | Delete album |

### Likes

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/likes/me` | User | Get my liked songs (paginated) |
| POST | `/likes/` | User | Like a song (`{ "songId": "..." }`) |
| DELETE | `/likes/` | User | Unlike a song (`{ "songId": "..." }`) |

### Playlists

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/playlists` | User | Create playlist |
| GET | `/playlists/me` | User | Get my playlists (paginated) |
| GET | `/playlists` | User | Get public playlists |
| GET | `/playlists/:id` | User | Get playlist detail with songs |
| PUT | `/playlists/:id` | Owner | Update playlist |
| DELETE | `/playlists/:id` | Owner | Delete playlist |
| POST | `/playlists/:id/tracks` | Owner | Add song to playlist |
| POST | `/playlists/:id/upload-track` | Owner | Upload + add track (Cloudinary) |
| DELETE | `/playlists/:id/tracks/:songId` | Owner | Remove song from playlist |
| PATCH | `/playlists/:id/tracks/reorder` | Owner | Reorder playlist songs |

### Follow

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/follow/following` | User | Get followed users/artists |
| GET | `/follow/status/:artistId` | User | Check follow status |
| POST | `/follow/:userId` | User | Follow/toggle follow |
| DELETE | `/follow/:userId` | User | Unfollow |

### Feed

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/feed` | User | Songs from followed artists (paginated) |

### Search

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/search?q=&limit=` | — | Realtime search (songs + artists) |

### Recently Played

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/recently-played` | Optional | Save recently played song |
| GET | `/recently-played` | User | Get my recently played songs |

### Listening History

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/history/me` | User | Get my listening history (paginated) |
| DELETE | `/history/me` | User | Clear my listening history |

### Upload

All uploads go directly to Cloudinary. Files are **not** stored on disk.

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/upload/audio` | Admin | Upload audio (MP3, max 20 MB) |
| POST | `/upload/cover` | Admin | Upload cover (JPG/PNG/WebP, max 5 MB) |

Cloudinary folders: `music-streaming/audio`, `music-streaming/covers`,
`music-streaming/avatars`.

### Admin

All admin endpoints require `role = 'admin'`.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/admin/dashboard` | Stats: totals, top songs, newest users |
| GET | `/admin/users` | List users (`?page=&limit=&q=&role=`) |
| GET | `/admin/playlists` | List all playlists (`?page=&limit=&q=`) |
| DELETE | `/admin/playlists/:id` | Delete any playlist |
| PATCH | `/admin/users/:id/role` | Change user role (`{ "role": "admin" }`) |
| PATCH | `/admin/users/:id/ban` | Ban user + revoke tokens |
| PATCH | `/admin/users/:id/unban` | Unban user |

To make an existing account an admin:

```sql
UPDATE users SET role = 'admin' WHERE email = 'your@email.com';
```

## Frontend Pages

### User-facing (`/`)

| Page | Route | Description |
|---|---|---|
| Home | `/` | Song grid, recently played, trending |
| Search | `/search` | Search songs and artists |
| Feed | `/feed` | Songs from followed artists |
| Liked Songs | `/liked` | User's liked songs |
| Playlists | `/playlists` | User's playlists |
| Playlist Detail | `/playlists/[id]` | Playlist with tracks |
| Artists | `/artists` | Browse artists |
| Artist Detail | `/artists/[id]` | Artist profile and songs |
| Albums | `/albums` | Browse albums |
| Album Detail | `/albums/[id]` | Album with tracks |
| Songs | `/songs` | Browse all songs |
| Upload | `/upload` | Upload a new track |
| Profile | `/profile` | Edit profile, avatar |

### Admin (`/admin`)

| Page | Route | Description |
|---|---|---|
| Dashboard | `/admin` | Overview stats |
| Users | `/admin/users` | Manage users, roles, bans |
| Songs | `/admin/songs` | Manage songs |
| Playlists | `/admin/playlists` | Manage playlists |
| Artists | `/admin/artists` | Manage artists |
| Albums | `/admin/albums` | Manage albums |
| Genres | `/admin/genres` | Manage genres |
| Upload | `/admin/upload` | Admin file upload |

## Key Architecture Decisions

- **Cloudinary for all file storage** — audio uploaded as `resource_type: video`,
  images as `image`. No local disk storage.
- **JWT + Refresh Token** — access tokens are short-lived (15 min), refresh
  tokens are hashed with bcrypt and stored in `refresh_tokens` table.
- **Zustand player store** — all player state (current song, queue, shuffle,
  repeat, seek) managed in a single Zustand store. Audio playback is handled by
  `PlayerProvider` which syncs HTML5 Audio with the store.
- **Soft delete for songs** — `DELETE /songs/:id` sets `is_active = false`
  instead of removing the row.
- **`api.ts` is the single HTTP client** — all frontend API calls go through
  `frontend/src/lib/api.ts`. No scattered `fetch()` calls.
