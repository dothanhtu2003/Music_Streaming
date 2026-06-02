# Music Streaming Web App - Backend

Backend setup for the Music Streaming Web App using Node.js, Express, and PostgreSQL.

## Tech Stack

- Node.js
- Express
- PostgreSQL
- pg
- dotenv
- cors
- helmet
- morgan
- express-rate-limit

Auth, Song API, and Upload are not implemented in this stage.

## Project Structure

```text
src/
  config/
  controllers/
  routes/
  services/
  middlewares/
  utils/
  db/
  app.js
  server.js
```

## Setup

Install dependencies:

```bash
npm install
```

Create a `.env` file from `.env.example`, then update the database values.

## PostgreSQL Database

Open PostgreSQL terminal or pgAdmin, then create the database:

```sql
CREATE DATABASE music_streaming;
```

Run the database schema:

```bash
psql -U postgres -d music_streaming -f src/db/schema.sql
```

Example `.env`:

```env
NODE_ENV=development
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=music_streaming
DB_USER=postgres
DB_PASSWORD=your_postgres_password
DB_SSL=false
FRONTEND_URL=http://localhost:3000
JWT_ACCESS_SECRET=replace_with_at_least_32_random_characters
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_TOKEN_EXPIRES_DAYS=7
```

## Run Backend

Development mode:

```bash
npm run dev
```

Production/simple start:

```bash
npm start
```

Server URL:

```text
http://localhost:5000
```

## Test Health API

Browser:

```text
http://localhost:5000/api/health
```

Postman:

- Method: `GET`
- URL: `http://localhost:5000/api/health`

Expected response:

```json
{
  "success": true,
  "message": "Music API is running"
}
```

## Auth API

Before testing Auth, make sure the database schema has been applied:

```bash
psql -U postgres -d music_streaming -f src/db/schema.sql
```

### Register

```http
POST http://localhost:5000/api/auth/register
Content-Type: application/json
```

```json
{
  "email": "user@example.com",
  "username": "user01",
  "password": "123456"
}
```

### Login

```http
POST http://localhost:5000/api/auth/login
Content-Type: application/json
```

```json
{
  "email": "user@example.com",
  "password": "123456"
}
```

Copy `accessToken` and `refreshToken` from the response.

### Get Current User

```http
GET http://localhost:5000/api/auth/me
Authorization: Bearer your_access_token
```

### Refresh Token

```http
POST http://localhost:5000/api/auth/refresh
Content-Type: application/json
```

```json
{
  "refreshToken": "your_refresh_token"
}
```

### Logout

```http
POST http://localhost:5000/api/auth/logout
Content-Type: application/json
```

```json
{
  "refreshToken": "your_refresh_token"
}
```

## Content APIs

Public users can read artists, genres, albums, and songs. Only admins can create,
update, or delete content.

To make an existing account an admin:

```sql
UPDATE users
SET role = 'admin'
WHERE email = 'user@example.com';
```

Then login again and use the new `accessToken` as:

```text
Authorization: Bearer your_admin_access_token
```

### Artists

- `GET /api/artists?page=1&limit=10&q=son`
- `GET /api/artists/:id`
- `POST /api/artists` admin
- `PUT /api/artists/:id` admin
- `DELETE /api/artists/:id` admin

```json
{
  "name": "Son Tung M-TP",
  "bio": "Vietnamese singer",
  "avatar_url": "/uploads/artists/sontung.jpg"
}
```

### Genres

- `GET /api/genres?page=1&limit=10&q=pop`
- `GET /api/genres/:id`
- `POST /api/genres` admin
- `PUT /api/genres/:id` admin
- `DELETE /api/genres/:id` admin

```json
{
  "name": "Pop",
  "slug": "pop"
}
```

### Albums

- `GET /api/albums?page=1&limit=10&q=demo`
- `GET /api/albums/:id`
- `POST /api/albums` admin
- `PUT /api/albums/:id` admin
- `DELETE /api/albums/:id` admin

```json
{
  "title": "Demo Album",
  "artist_id": "artist_uuid",
  "cover_url": "/uploads/covers/album.jpg",
  "release_date": "2026-01-01"
}
```

### Songs

- `GET /api/songs?page=1&limit=10`
- `GET /api/songs?genre_id=genre_uuid`
- `GET /api/songs?artist_id=artist_uuid`
- `GET /api/songs?album_id=album_uuid`
- `GET /api/songs/:id`
- `GET /api/songs/search?q=keyword`
- `POST /api/songs` admin
- `PUT /api/songs/:id` admin
- `DELETE /api/songs/:id` admin, soft deletes with `is_active = false`
- `PATCH /api/songs/:id/play`

```json
{
  "title": "Demo Song",
  "artist_id": "artist_uuid",
  "album_id": "album_uuid",
  "genre_id": "genre_uuid",
  "file_url": "/uploads/audio/demo.mp3",
  "cover_url": "/uploads/covers/demo.jpg",
  "duration_sec": 180,
  "is_active": true
}
```

### Sample Data SQL

```sql
WITH artist AS (
  INSERT INTO artists (name, bio, avatar_url)
  VALUES ('Son Tung M-TP', 'Vietnamese singer', '/uploads/artists/sontung.jpg')
  RETURNING id
),
genre AS (
  INSERT INTO genres (name, slug)
  VALUES ('Pop', 'pop')
  RETURNING id
),
album AS (
  INSERT INTO albums (title, artist_id, cover_url, release_date)
  SELECT 'Demo Album', artist.id, '/uploads/covers/album.jpg', '2026-01-01'
  FROM artist
  RETURNING id, artist_id
)
INSERT INTO songs (
  title,
  artist_id,
  album_id,
  genre_id,
  file_url,
  cover_url,
  duration_sec,
  is_active
)
SELECT
  'Demo Song',
  album.artist_id,
  album.id,
  genre.id,
  '/uploads/audio/demo.mp3',
  '/uploads/covers/demo.jpg',
  180,
  true
FROM album, genre;
```

## Upload API

Only admins can upload files. Uploads are stored locally and served publicly from
`/uploads`.

Use this header for both upload endpoints:

```text
Authorization: Bearer your_admin_access_token
```

### Upload Audio

```http
POST http://localhost:5000/api/upload/audio
Content-Type: multipart/form-data
```

Postman Body:

- Select `form-data`
- Key: `file`
- Type: `File`
- Value: choose an MP3 file

Rules:

- Allowed MIME types: `audio/mpeg`, `audio/mp3`
- Max size: `20MB`
- Stored in: `uploads/audio/`

Example response:

```json
{
  "success": true,
  "message": "Audio uploaded successfully",
  "data": {
    "url": "/uploads/audio/generated-file-name.mp3"
  }
}
```

Use `data.url` as `songs.file_url`.

### Upload Cover

```http
POST http://localhost:5000/api/upload/cover
Content-Type: multipart/form-data
```

Postman Body:

- Select `form-data`
- Key: `file`
- Type: `File`
- Value: choose a JPG, PNG, or WebP image

Rules:

- Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`
- Max size: `5MB`
- Stored in: `uploads/covers/`

Example response:

```json
{
  "success": true,
  "message": "Cover uploaded successfully",
  "data": {
    "url": "/uploads/covers/generated-file-name.jpg"
  }
}
```

Use `data.url` as `songs.cover_url`, `albums.cover_url`, or
`artists.avatar_url`.

### Changing To Cloudflare R2 Or AWS S3 Later

The current upload logic lives in `src/middlewares/upload.middleware.js`.
To switch to Cloudflare R2 or AWS S3 later, replace Multer `diskStorage` with a
storage service that uploads the file buffer to R2/S3, then return the cloud URL
from `src/controllers/upload.controller.js`. The routes can stay the same.

## Like API

Only logged-in users can like or unlike songs. Use the access token from login:

```text
Authorization: Bearer your_access_token
```

### Like A Song

```http
POST http://localhost:5000/api/likes/
Content-Type: application/json
```

```json
{
  "songId": "song_uuid"
}
```

You can also send `song_id`. If the user already liked the song, the API returns
a success response and does not create a duplicate row.

### Unlike A Song

```http
DELETE http://localhost:5000/api/likes/
Content-Type: application/json
```

```json
{
  "songId": "song_uuid"
}
```

If the user has not liked the song yet, the API returns a success response with
the message `Song was not liked`.

### Get My Liked Songs

```http
GET http://localhost:5000/api/likes/me?page=1&limit=10
```

The response includes liked active songs joined with artist, album, and genre
information.

## Playlist API

Only logged-in users can use playlist APIs.

```text
Authorization: Bearer your_access_token
```

Users can modify only their own playlists. Other logged-in users can view public
playlists. Admins can view playlist details, but playlist editing is still owner
only.

### Create Playlist

```http
POST http://localhost:5000/api/playlists
Content-Type: application/json
```

```json
{
  "name": "My Favorite Songs",
  "is_public": false
}
```

### Get My Playlists

```http
GET http://localhost:5000/api/playlists/me?page=1&limit=10
```

### Get Public Playlists

```http
GET http://localhost:5000/api/playlists?page=1&limit=10
```

### Get Playlist Detail

```http
GET http://localhost:5000/api/playlists/playlist_uuid
```

The response includes songs inside the playlist with artist, album, and genre
information.

### Update Playlist

```http
PUT http://localhost:5000/api/playlists/playlist_uuid
Content-Type: application/json
```

```json
{
  "name": "Updated Playlist Name",
  "is_public": true
}
```

### Delete Playlist

```http
DELETE http://localhost:5000/api/playlists/playlist_uuid
```

### Add Song To Playlist

```http
POST http://localhost:5000/api/playlists/playlist_uuid/songs
Content-Type: application/json
```

```json
{
  "songId": "song_uuid",
  "position": 0
}
```

`position` is optional. If omitted, the song is added to the end. The same song
cannot be added twice to one playlist, and inactive songs cannot be added.

### Remove Song From Playlist

```http
DELETE http://localhost:5000/api/playlists/playlist_uuid/songs/song_uuid
```

You can also send the song id in JSON body:

```http
DELETE http://localhost:5000/api/playlists/playlist_uuid/songs
Content-Type: application/json
```

```json
{
  "songId": "song_uuid"
}
```

### Reorder Playlist Songs

```http
PATCH http://localhost:5000/api/playlists/playlist_uuid/songs/reorder
Content-Type: application/json
```

```json
{
  "songs": [
    {
      "songId": "first_song_uuid",
      "position": 0
    },
    {
      "songId": "second_song_uuid",
      "position": 1
    }
  ]
}
```

## Listening History And Play Count

### Listen To Song

Guest and logged-in users can call the same endpoint:

```http
POST http://localhost:5000/api/songs/song_uuid/listen
```

Guest request:

- Do not send `Authorization`
- The API increases `songs.play_count`
- No listening history is saved

Logged-in request:

```text
Authorization: Bearer your_access_token
```

- The API increases `songs.play_count`
- A row is inserted into `listening_history`

Inactive songs cannot be listened to.

### Get My Listening History

```http
GET http://localhost:5000/api/history/me?page=1&limit=10
Authorization: Bearer your_access_token
```

The response includes recently listened active songs joined with artist, album,
and genre information.

### Clear My Listening History

```http
DELETE http://localhost:5000/api/history/me
Authorization: Bearer your_access_token
```

## Admin Dashboard API

Run this migration if your database was created before the admin ban feature:

```bash
psql -U postgres -d music_streaming -f src/db/migrations/001_add_is_banned_to_users.sql
```

Make an existing account an admin:

```sql
UPDATE users
SET role = 'admin'
WHERE email = 'admin@example.com';
```

Login again after changing the role, then use:

```text
Authorization: Bearer your_admin_access_token
```

### Dashboard

```http
GET http://localhost:5000/api/admin/dashboard
```

Returns:

- `total_users`
- `total_songs`
- `total_artists`
- `total_albums`
- `total_genres`
- `total_play_count`
- `top_songs`
- `newest_users`

### List Users

```http
GET http://localhost:5000/api/admin/users?page=1&limit=10
```

Optional filters:

```http
GET http://localhost:5000/api/admin/users?q=user&role=user
```

The response does not include `password_hash`.

### Change User Role

```http
PATCH http://localhost:5000/api/admin/users/user_uuid/role
Content-Type: application/json
```

```json
{
  "role": "admin"
}
```

Allowed roles: `user`, `admin`.

### Ban User

```http
PATCH http://localhost:5000/api/admin/users/user_uuid/ban
```

Admins cannot ban themselves. Banning a user also revokes their active refresh
tokens.

### Unban User

```http
PATCH http://localhost:5000/api/admin/users/user_uuid/unban
```
