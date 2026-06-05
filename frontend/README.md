# Music Streaming Frontend

Next.js + Tailwind CSS frontend for the Music Streaming Web App portfolio project.

---

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Library**: React 19
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **State Management**: Zustand
- **Audio Integration**: HTML5 Audio + WaveSurfer.js

---

## Environment Setup

Copy `.env.example` to `.env.local` to configure the backend API URL:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

---

## Run Locally

Navigate to the frontend directory and install dependencies:

```bash
cd frontend
npm install
```

Start the local development server:

```bash
npm run dev
```

Open `http://localhost:3000` in your web browser.

---

## Build and Lint

Verify code quality and build target:

```bash
# Run ESLint validation
npm run lint

# Generate production bundle
npm run build
```
