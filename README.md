# 🎵 Music Streaming Web App

<div align="center">

A premium, full-stack, responsive music streaming application built as a portfolio showcase.

[![Next.js 16](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript 5](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![Zustand](https://img.shields.io/badge/Zustand-State-black?style=for-the-badge)](https://zustand-demo.pmnd.rs/)

[![Node.js 18](https://img.shields.io/badge/Node.js-18-339933?style=for-the-badge&logo=nodedotjs)](https://nodejs.org/)
[![Express 5](https://img.shields.io/badge/Express-5-000000?style=for-the-badge&logo=express)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-4169E1?style=for-the-badge&logo=postgresql)](https://www.postgresql.org/)
[![Cloudinary](https://img.shields.io/badge/Cloudinary-Media-F15A24?style=for-the-badge&logo=cloudinary)](https://cloudinary.com/)

[Key Features](#-key-features) • [System Architecture](#%EF%B8%8F-system-architecture) • [Database ERD](#%EF%B8%8F-database-erd) • [Setup Guide](#%EF%B8%8F-setup-guide) • [API Directory](#-api-endpoints) • [Manual Test Plan](#-testing-status)

</div>

---

## 🚀 Overview

This **Music Streaming Web App** is a portfolio-ready, full-stack streaming platform featuring a highly responsive, modern user interface alongside a secure, scalable API backend. The system integrates seamless media uploads directly to the cloud, caching of audio waveform data, stateful audio queuing, and a robust role-based admin dashboard.

---

## ✨ Key Features

### 🎧 User Experience & Core Engine

- **Stateful Audio Player**: Implements a Zustand-backed music player supporting continuous playback, queue management, volume controls, progression scrubbing, random shuffle, and various loop states (loop-track, loop-all, loop-off).
- **Cloudinary-backed Uploads**: New audio, cover, and avatar uploads are handled by **Multer** with **CloudinaryStorage**, then persisted as Cloudinary URLs in PostgreSQL. The backend still exposes `/uploads` as a static path for existing or legacy local media assets.
- **Waveform Visualization**: Generates, renders, and caches audio waveform peak data via **WaveSurfer.js** to deliver interactive audio player aesthetics.
- **Dynamic Content Discovery**:
  - **Personalized Feed**: A chronological pipeline displaying new releases specifically from artists the user is following.
  - **Realtime Search**: Multi-model backend search suggestions across songs and artists using PostgreSQL `ILIKE` queries backed by trigram indexes.
  - **Recent Activity**: Logged-in user activity tracking via deduplicated recently played items and full listening history.

### 🛡️ Platform Security & Session Management

- **Dual-Token Auth**: Secure user session cycles utilizing short-lived JWT Access Tokens and database-stored, bcrypt-hashed Refresh Tokens.
- **Access Control & Permissions**: Strict role-based middleware guarding user profiles, playlists, uploads, and administrative actions.
- **User Ban Control**: Administrative user ban immediately invalidates and purges all active refresh tokens, forcing an immediate session termination.

### 📊 Admin Panel Dashboard

- **System Analytics**: Real-time summary counts of users, tracks, playlists, genres, and aggregate play counts, plus a listing of top songs and newly registered profiles.
- **Administrative Utilities**: Dedicated panel views to manage system users (role elevation, banning), delete public/private playlists, soft-delete tracks (`is_active = false`), and perform administrative metadata curation.

---

## 🗺️ System Architecture

The project maintains a clean separation of concerns, connecting a serverless-ready Next.js application with a standard Node.js API service:

```mermaid
graph TD
    subgraph Frontend [Next.js App Client]
        UI[App Shell & Views]
        Zustand[Zustand Player Store]
        AudioEngine[HTML5 Audio Engine]
        APIClient[Fetch Wrapper: api.ts]
    end

    subgraph Backend [Express API Gateway]
        Express[Express Router]
        AuthMD[Auth Middleware]
        UploadMD[Multer & CloudinaryStorage]
        Controller[Controllers]
        Service[Business Logic Services]
    end

    subgraph Database & Media Services [Infrastructure]
        PG[(PostgreSQL Database)]
        Cloudinary[Cloudinary CDN]
        LocalUploads[/uploads static legacy assets]
    end

    UI --> Zustand
    Zustand --> AudioEngine
    UI --> APIClient
    APIClient -->|HTTP / JSON / FormData| Express
    Express --> AuthMD
    Express --> UploadMD
    AuthMD --> Controller
    UploadMD -->|Upload Streams| Cloudinary
    Controller --> Service
    Service -->|pg Pool Query| PG
    UploadMD -->|Return Cloudinary URL| Service
    Express -->|Serve existing files| LocalUploads
```

---

## 🗄️ Database ERD

The database runs on PostgreSQL, leveraging relations, cascading foreign keys, and indexes designed to support quick data retrieval:

```mermaid
erDiagram
    users {
        uuid id PK
        varchar email UK
        varchar username UK
        varchar display_name
        varchar bio
        text avatar_url
        text password_hash
        varchar role
        boolean is_verified
        boolean is_banned
        timestamptz created_at
    }

    artists {
        uuid id PK
        varchar name
        text bio
        text avatar_url
        uuid user_id FK
    }

    genres {
        uuid id PK
        varchar name
        varchar slug UK
    }

    albums {
        uuid id PK
        varchar title
        uuid artist_id FK
        text cover_url
        date release_date
    }

    songs {
        uuid id PK
        varchar title
        text description
        uuid artist_id FK
        uuid album_id FK
        uuid genre_id FK
        text file_url
        text cover_url
        integer duration_sec
        jsonb waveform_peaks
        numeric waveform_duration
        bigint play_count
        boolean is_active
    }

    playlists {
        uuid id PK
        uuid user_id FK
        varchar name
        text description
        text cover_url
        boolean is_public
    }

    playlist_songs {
        uuid id PK
        uuid playlist_id FK
        uuid song_id FK
        integer position
    }

    refresh_tokens {
        uuid id PK
        uuid user_id FK
        text token_hash UK
        timestamptz expires_at
        timestamptz revoked_at
    }

    listening_history {
        uuid id PK
        uuid user_id FK
        uuid song_id FK
        timestamptz listened_at
    }

    recently_played {
        uuid id PK
        uuid user_id FK
        uuid song_id FK
        timestamptz played_at
    }

    follows {
        uuid id PK
        uuid followerId FK
        uuid followingId FK
        timestamptz createdAt
    }

    users ||--o| artists : "manages"
    users ||--o{ playlists : "creates"
    users ||--o{ refresh_tokens : "owns"
    users ||--o{ listening_history : "records"
    users ||--o{ recently_played : "views"
    users ||--o{ follows : "engages"

    artists ||--o{ albums : "releases"
    artists ||--o{ songs : "composes"

    albums ||--o{ songs : "includes"
    genres ||--o{ songs : "classifies"

    playlists ||--o{ playlist_songs : "contains"
    songs ||--o{ playlist_songs : "references"
    songs ||--o{ listening_history : "tracks"
    songs ||--o{ recently_played : "logs"
```

---

## 📁 Project Structure

```text
.
├── src/                      # Backend Core (Node.js/Express)
│   ├── config/               # DB connections & Cloudinary settings
│   ├── controllers/          # Request routers & response formatters
│   ├── db/                   # Raw SQL schema & migrations
│   ├── middlewares/          # Security, error boundaries, uploads
│   ├── routes/               # Modular Express routing tree
│   ├── services/             # Transaction scopes & database queries
│   ├── utils/                # Base validation & generic helpers
│   ├── app.js                # Main express instance config
│   └── server.js             # Server startup script
│
├── frontend/                 # Frontend Interface (Next.js 16)
│   └── src/
│       ├── app/              # Page router, layout hierarchy
│       │   ├── (main)/       # Main landing, feed, library pages
│       │   └── admin/        # Dashboard & metadata management
│       ├── components/       # Component library (player, layout, admin UI)
│       ├── lib/              # Central API Wrapper client (api.ts)
│       ├── stores/           # Zustand audio player store
│       └── types/            # App-wide TypeScript definitions
```

---

## 🛠️ Setup Guide

### 📋 Prerequisites

- **Runtime**: Node.js v18.x or higher
- **Database**: PostgreSQL v14.x or higher
- **Cloud Accounts**: Cloudinary API credentials

---

### 💻 Local Installation

#### 1. Setup Backend Environment
Clone the repository, enter the root directory, and install backend packages:
```bash
npm install
```

Create a `.env` file in the root directory from `.env.example`:
```env
NODE_ENV=development
PORT=5000

DB_HOST=localhost
DB_PORT=5432
DB_NAME=music_streaming
DB_USER=postgres
DB_PASSWORD=your_postgres_password
DB_SSL=false
DB_POOL_MAX=5
DB_CONNECTION_TIMEOUT_MS=15000
DB_IDLE_TIMEOUT_MS=30000

# Supabase Shared Pooler for IPv4 networks:
# DB_HOST=aws-1-ap-southeast-1.pooler.supabase.com
# DB_PORT=6543
# DB_NAME=postgres
# DB_USER=postgres.your_project_ref
# DB_PASSWORD=your_supabase_database_password
# DB_SSL=true
#
# Or use DATABASE_URL. Percent-encode special characters in password:
# DATABASE_URL=postgresql://postgres.your_project_ref:your_encoded_password@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres

FRONTEND_URL=http://localhost:3000

JWT_ACCESS_SECRET=replace_with_at_least_32_random_characters
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_TOKEN_EXPIRES_DAYS=7

CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```

#### 2. Configure the Database
Create your local PostgreSQL database, then apply the SQL schema:
```bash
psql -U postgres -d music_streaming -f src/db/schema.sql
```

#### 3. Run Backend Server
```bash
npm run dev
```
The server starts on `http://localhost:5000`.

---

#### 4. Setup Frontend Environment
Navigate to the frontend directory:
```bash
cd frontend
npm install
```

Create a `frontend/.env.local` file from `frontend/.env.example`:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

#### 5. Launch Frontend App
```bash
npm run dev
```
Open `http://localhost:3000` to interact with the application.

---

## 🔌 API Endpoints

All routes are mounted under `/api`. Paths below are relative to each module base path.

| Module | Base Path | Authentication | Implemented Endpoints |
|---|---|---|---|
| **Health** | `/api/health` | Open | `GET /` |
| **Auth** | `/api/auth` | Mixed | `POST /register`, `POST /login`, `POST /refresh`, `POST /logout`, `GET /me`, `PATCH /me`, `POST /me/avatar` |
| **Songs** | `/api/songs` | Mixed | `GET /`, `GET /search`, `GET /me`, `GET /:id`, `GET /:id/waveform`, `POST /:id/waveform`, `POST /upload`, `POST /:id/listen`, `PATCH /:id/play`, admin `POST /`, `PUT /:id`, `DELETE /:id` |
| **Upload** | `/api/upload` | Admin Session | `POST /audio`, `POST /cover` |
| **Playlists** | `/api/playlists` | User Session | `POST /`, `GET /me`, `GET /`, `GET /:id`, `PUT /:id`, `DELETE /:id`, `POST /:id/songs`, `POST /:id/tracks`, `POST /:id/upload-track`, `DELETE /:id/songs/:songId`, `DELETE /:id/tracks/:songId`, `DELETE /:id/songs`, `DELETE /:id/tracks`, `PATCH /:id/songs/reorder`, `PATCH /:id/tracks/reorder` |
| **Likes** | `/api/likes` | User Session | `POST /`, `DELETE /`, `GET /me` |
| **Recently Played** | `/api/recently-played` | Mixed | `POST /` with optional auth, `GET /` with user session |
| **Follows** | `/api/follow` | User Session | `GET /following`, `GET /status/:artistId`, `POST /:userId`, `DELETE /:userId` |
| **Feed** | `/api/feed` | User Session | `GET /` |
| **Search** | `/api/search` | Open | `GET /` |
| **History** | `/api/history` | User Session | `GET /me`, `DELETE /me` |
| **Artists** | `/api/artists` | Mixed | `GET /`, `GET /:id/songs`, `GET /:id`, admin `POST /`, `PUT /:id`, `DELETE /:id` |
| **Albums** | `/api/albums` | Mixed | `GET /`, `GET /:id`, admin `POST /`, `PUT /:id`, `DELETE /:id` |
| **Genres** | `/api/genres` | Mixed | `GET /`, `GET /:id`, admin `POST /`, `PUT /:id`, `DELETE /:id` |
| **Admin** | `/api/admin` | Admin Session | `GET /dashboard`, `GET /users`, `GET /playlists`, `DELETE /playlists/:id`, `PATCH /users/:id/role`, `PATCH /users/:id/ban`, `PATCH /users/:id/unban` |

---

## 🧪 Testing Status

Automated end-to-end and unit tests are planned but not fully implemented yet. 

Manual validation is documented in [TEST_PLAN.md](file:///E:/music/TEST_PLAN.md), covering:
- [x] Session Cycles & JWT validation
- [x] Cloud uploads & database integrity checks
- [x] Real-time audio queue manipulation
- [x] Admin console user control tests (banning/role configuration)
- [x] Layout responsive checks across mobile viewports

---

## 🌐 Deployment Overview

- **Backend Node API**: Designed for hosting on Heroku, Railway, Render, or ECS.
- **Frontend App**: Serverless hosting optimized for Vercel or Netlify.
- **PostgreSQL**: Cloud hosting via Supabase, Neon, or RDS.
- **Media Assets**: New uploads are distributed through Cloudinary CDN. Existing `/uploads` local assets still require persistent server storage unless they are migrated to Cloudinary URLs.
