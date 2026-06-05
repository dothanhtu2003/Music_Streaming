# Music Streaming Web App

A full-stack music streaming application built as a portfolio project.

This application allows users to register, listen to music, upload tracks, manage playlists, like songs, follow artists, and discover tracks from followed artists through a personalized feed. It also features a comprehensive admin panel for content and user management.

---

## Tech Stack

### Backend

- **Runtime**: Node.js 18
- **Framework**: Express 5
- **Database**: PostgreSQL (with GIN indexes and trigram search)
- **Authentication**: JWT access tokens + hashed refresh tokens stored in database
- **Storage**: Cloudinary (for audio and image storage via Multer and Cloudinary Storage)
- **Security & Utilities**: bcrypt, cors, helmet, morgan, express-rate-limit

### Frontend

- **Framework**: Next.js 16 (App Router, TypeScript)
- **Library**: React 19
- **Styling**: Tailwind CSS v4
- **State Management**: Zustand (for audio player state)
- **Audio Integration**: HTML5 Audio + WaveSurfer.js (for waveform visualization)
- **API Client**: Single HTTP client wrapper using native `fetch()` in `frontend/src/lib/api.ts`

---

## Features

### User Features

- **Authentication**: Register, login, logout, and token refresh mechanisms
- **Profile Management**: Update display name, bio, and upload avatar
- **Audio Player**: Interactive bottom player with queue management, play/pause, volume control, seek, repeat modes (off, one, all), and shuffle
- **Social Features**: Follow/unfollow other users or artists
- **Playlists**: Create, update, delete playlists; add, remove, and reorder songs within playlists
- **Favorites**: Like/unlike songs, with a dedicated page for liked tracks
- **History & Activity**: Recently played tracks (deduplicated) and full listening history
- **Personalized Feed**: Chronological list of new releases from followed artists
- **Search**: Realtime search suggestions and full search results for songs and artists
- **Upload**: Upload songs directly to Cloudinary (audio track and cover image)

### Admin Features

- **Dashboard**: High-level statistics including user count, track count, play counts, top songs, and newest users
- **User Management**: List users with filters, change user roles (user/admin), and ban/unban users (which revokes their active sessions)
- **Playlist Management**: View and delete any playlist in the system
- **Track Management**: Create, update, and soft-delete (`is_active = false`) tracks
- **Metadata Management**: Create, update, and delete artists, albums, and genres
- **Admin Upload**: Dedicated upload interface for administrative tasks

---

## Storage Architecture

- **Main Storage**: All uploaded audio files, covers, and user avatars are stored on Cloudinary.
- **Database**: PostgreSQL stores application metadata and secure Cloudinary URLs.
- **Legacy Path**: The backend static route `/uploads` remains for backward compatibility and serving legacy local files, but is not used for new uploads.

---

## Project Structure

```text
.
├── src/                      # Backend source code (CommonJS)
│   ├── config/               # Database pool and Cloudinary configurations
│   ├── controllers/          # Request handlers
│   ├── db/                   # schema.sql, migrations, and database client
│   ├── middlewares/          # Authentication, error handling, and upload middlewares
│   ├── routes/               # Express routing tables
│   ├── services/             # Business logic and database query execution
│   ├── utils/                # Helper utilities (API responses, validation)
│   ├── app.js                # Express application definition
│   └── server.js             # Web server initialization
│
├── frontend/                 # Frontend source code (Next.js)
│   ├── public/               # Static public assets
│   └── src/
│       ├── app/              # Next.js App Router (pages and layouts)
│       │   ├── (main)/       # User application pages
│       │   ├── admin/        # Admin panel pages
│       │   ├── login/        # Login page
│       │   └── register/     # Registration page
│       ├── components/       # Reusable UI components (layout, player, admin, etc.)
│       ├── hooks/            # Custom React hooks
│       ├── lib/              # Client API wrapper (api.ts) and storage utilities
│       ├── stores/           # Zustand state stores (player-store.ts)
│       └── types/            # TypeScript type declarations
│
├── .env.example              # Template for backend environment variables
└── package.json              # Backend dependencies and scripts
```

---

## Database

The PostgreSQL database (`music_streaming`) consists of the following 12 tables defined in `src/db/schema.sql`:

- `users`: Account identities, profile details, roles, and ban status
- `artists`: Music artists profiles (optionally linked to a registered user)
- `genres`: Song genres with slugs
- `albums`: Albums associated with artists
- `songs`: Playable tracks with title, Cloudinary file URL, cover URL, duration, play counts, is_active flag, and waveform cache
- `likes`: Many-to-many relationship mapping user likes to songs
- `playlists`: User-created playlists
- `playlist_songs`: Many-to-many playlist-to-song mappings with sequence positioning
- `refresh_tokens`: Revocable hashed refresh tokens associated with active user sessions
- `listening_history`: Granular stream events log for user statistics
- `recently_played`: Deduplicated list of recently played tracks per user
- `follows`: Social follow relationships between users

---

## API Endpoints

All endpoints are prefixed with `/api`.

- `/api/auth`: Register, login, refresh tokens, profile management, and avatar upload
- `/api/songs`: List all active songs, get song detail, fetch/cache waveforms, listen tracking, song search, and song uploads
- `/api/playlists`: CRUD operations for user playlists, track insertion, removal, reordering, and direct upload-to-playlist
- `/api/likes`: Like, unlike, and fetch user liked songs
- `/api/follow`: Follow users/artists, unfollow, and retrieve follow status/list
- `/api/history`: Retrieve or clear listening history
- `/api/recently-played`: Save or retrieve recently played songs
- `/api/feed`: Retrieve release feed of followed artists
- `/api/search`: Realtime search suggestions for songs and artists
- `/api/artists`: List, get, create, update, and delete artists
- `/api/albums`: List, get, create, update, and delete albums
- `/api/genres`: List, get, create, update, and delete genres
- `/api/admin`: Dashboard overview, user list, user ban/unban, role update, and playlist deletion

---

## Key Feature Logic

### Feed
The `/api/feed` endpoint queries songs uploaded by artists the user follows. It orders results chronologically (`s.created_at DESC`) with standard pagination. No complex or AI recommendation logic is implemented.

### Search
Realtime search suggestion queries are processed via `/api/search`, returning matched songs and artists in one request. Full song search queries `/api/songs/search`, which sorts results by popularity (`play_count DESC`) and creation date (`created_at DESC`). Client-side Fuse.js is configured but the application relies primarily on backend-side PostgreSQL trigram search GIN indexes for fuzzy matching.

---

## Run Locally

### Prerequisites
- Node.js 18
- PostgreSQL (local or cloud instance)
- Cloudinary credentials

### Backend Setup

1. Install backend dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file in the root directory based on `.env.example`. Fill in your database configuration, JWT secret, and Cloudinary keys:
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

   # JWT Config
   JWT_ACCESS_SECRET=your_32_character_secret_string
   JWT_ACCESS_EXPIRES_IN=15m
   JWT_REFRESH_TOKEN_EXPIRES_DAYS=7

   # Cloudinary Config
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```

3. Initialize the database schema:
   ```bash
   psql -U postgres -d music_streaming -f src/db/schema.sql
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

### Frontend Setup

1. Navigate to the frontend directory and install dependencies:
   ```bash
   cd frontend
   npm install
   ```

2. Create a `frontend/.env.local` file with the backend API URL:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:5000/api
   ```

3. Start the Next.js development server:
   ```bash
   npm run dev
   ```

---

## Testing

Automated tests are planned but not fully implemented yet. Refer to [TEST_PLAN.md](file:///E:/music/TEST_PLAN.md) for details on the manual verification script, scenarios, and status trackers for API/UI features.

---

## Deployment

- **Backend**: Can be hosted on Railway, Render, or any Node.js compatible environment.
- **Frontend**: Can be hosted on Vercel or similar platforms.
- **Database**: PostgreSQL can be hosted on Supabase, Neon, or cloud database providers.
- **Media**: Audio tracks, cover images, and user avatars are hosted securely on Cloudinary.
