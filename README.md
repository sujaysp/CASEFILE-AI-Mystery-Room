# CASEFILE — The Mystery Room

An AI-powered mystery investigation platform where players create unique cases, investigate suspects, uncover clues, and solve mysteries.

## Overview

CASEFILE lets users become investigators in AI-generated mystery stories. Players provide a premise, choose a difficulty level, examine evidence, request hints, and submit their final accusation.

Each investigation is saved to the user's account, allowing them to return to their cases and continue where they left off.

## Features

- AI-generated mysteries using Google Gemini.
- Three difficulty levels: Easy, Medium, and Hard.
- Unique suspects, clues, hints, and hidden solutions.
- Interactive clue discovery and investigation.
- Final suspect accusation and scoring.
- Persistent case history backed by MongoDB.
- Email/password authentication.
- Google sign-in using Google Identity Services.
- User-specific case ownership and access control.
- Responsive, dark-themed investigation workspace.

## Technology Stack

**Frontend**
- React
- Vite
- JavaScript
- Tailwind CSS
- Axios
- Lucide React

**Backend**
- Node.js
- Express.js
- MongoDB Atlas
- Mongoose
- Google Gemini API
- Zod
- JSON Web Tokens
- bcryptjs
- Google Identity Services

## Project Structure

```text
AI-Mystery-Room/
├── client/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── services/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── Investigation.css
│   ├── .env.example
│   └── package.json
│
├── server/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── scripts/
│   ├── services/
│   ├── validators/
│   ├── .env.example
│   └── package.json
│
├── .gitignore
└── README.md
```

## Getting Started

### Prerequisites

- Node.js
- npm
- MongoDB Atlas account
- Google Gemini API key
- Google OAuth Web Client ID

### 1. Clone the repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd AI-Mystery-Room
```

### 2. Install backend dependencies

```bash
cd server
npm install
```

### 3. Configure backend environment variables

Create a private `.env` file using `.env.example` as a reference.

Configure MongoDB, JWT, Gemini, and Google Client ID values.

### 4. Start the backend

```bash
npm run dev
```

The backend runs on `http://localhost:5000`.

### 5. Install frontend dependencies

Open another terminal:

```bash
cd client
npm install
```

Create `.env.local` using `client/.env.example` as a reference.

Configure the API base URL and Google Client ID.

### 6. Start the frontend

```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

## Environment Variables

### Backend

| Variable | Description |
|---|---|
| PORT | Backend server port |
| CLIENT_URL | Allowed frontend origin |
| MONGODB_URI | MongoDB connection string |
| JWT_SECRET | Private JWT signing secret |
| GEMINI_API_KEY | Google Gemini API key |
| GEMINI_MODEL | Primary generation model |
| GEMINI_FALLBACK_MODEL | Fallback generation model |
| GEMINI_MAX_RETRIES | Maximum generation attempts |
| GOOGLE_CLIENT_ID | Google OAuth Web Client ID |

### Frontend

| Variable | Description |
|---|---|
| VITE_API_BASE_URL | Backend API URL |
| VITE_GOOGLE_CLIENT_ID | Google OAuth Web Client ID |

Never commit actual environment files or private credentials.

## Security

- Passwords are hashed using bcrypt.
- Backend endpoints enforce authentication.
- Case operations are scoped to the authenticated account.
- Google ID tokens are verified on the backend.
- Mystery solutions remain private until the investigation is completed.
- Environment files and secrets are excluded from version control.

## Testing

Backend mystery generation:

```bash
npm run test:gemini
```

Frontend lint:

```bash
npm run lint
```

Frontend production build:

```bash
npm run build
```

## Future Improvements

- Production deployment and custom domain.
- Additional mystery themes and story settings.
- Improved generation reliability and monitoring.
- Enhanced investigation statistics.
- More advanced mystery consistency checks.

---

**CASEFILE — Every mystery leaves a trace.**