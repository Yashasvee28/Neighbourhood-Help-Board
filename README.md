# Neighbourhood Help Board — Neighbourhood Help Board

A complete beginner-friendly project built with HTML, CSS, vanilla JavaScript, and a Node.js backend. It uses only Node.js built-in modules, so there are no paid APIs, subscriptions, or npm packages to install.

## Features

- Create community posts with a name, category, title, and description
- Comment on posts
- Upvote and remove your own upvote (per browser cookie)
- Moderator sign-in using a server-side key
- Moderator-only post removal
- Search, category filters, and sort options
- Light/dark theme preference
- Responsive design and reduced-motion support
- Persistent posts, comments, and votes stored in `data/db.json`
- Health-check endpoint at `/api/health`

## Requirements

Install Node.js 18 or newer. Check in Terminal:

```bash
node --version
npm --version
```

If `node` is not found, install the current LTS release from https://nodejs.org/ and reopen Terminal/VS Code.

## Run locally on macOS

1. Extract this folder.
2. Open the folder in Visual Studio Code.
3. Open **Terminal → New Terminal**.
4. Start the server:

```bash
npm start
```

5. Open this URL in your browser:

```text
http://127.0.0.1:3000
```

Do not open `index.html` directly or use Live Server for this version. The backend serves the website and API together.

## Set a moderator key

The local development default is `change-this-local-moderator-key`. Change it before you use the app beyond your own computer.

In the same terminal, stop the server with `Control + C`, then run:

```bash
MODERATOR_KEY="your-own-long-random-key" npm start
```

Now use that exact key when you click the `M` button in the website. Keep the key private. The key is checked on the server; the browser does not get it automatically.

On macOS, the command above sets the variable for that run only. If you close Terminal and restart, run the command again.

## API overview

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Check whether the backend is running |
| GET | `/api/posts` | List posts and comments |
| POST | `/api/posts` | Create a post |
| POST | `/api/posts/:id/comments` | Add a comment |
| POST | `/api/posts/:id/vote` | Toggle a vote for the current browser |
| POST | `/api/moderator/verify` | Verify moderator key |
| DELETE | `/api/posts/:id` | Delete a post (moderator key required) |

## Data storage

The server writes to `data/db.json`. Back up this file if you want to preserve your local data. The database file is intentionally excluded from Git by `.gitignore`.

This JSON-file database is suitable for a small learning/demo project. For a larger public application, use a proper database such as PostgreSQL or SQLite, add rate limits and stronger identity/authentication, and deploy behind HTTPS.

## Important security and deployment notes

- The default moderator key is only for local practice. Set your own key before sharing the app.
- A browser cookie prevents repeat votes in that browser, but it is not proof of a real person's identity. Clearing cookies or using another browser can allow another vote.
- The project includes local account registration and login with salted password hashes. It does not include password recovery, email verification, or production-grade spam prevention.
- `127.0.0.1` means the app is accessible only from your own computer. A public submission requires deploying the Node.js server to a host that supports persistent storage, and setting `MODERATOR_KEY` in that host's environment settings.
- Some free hosting services do not preserve local files between restarts. If deploying publicly, check the host's storage policy and use a persistent database where necessary.


## Accounts and participation

Visitors can create an account with a display name, email address and password, then log in or log out from the top bar. Passwords are salted and hashed on the server; the browser never stores the password. Posting, commenting and upvoting require a signed-in account, and the server uses the account display name rather than trusting a name typed into the form. Each account can upvote a post once at a time. Sessions are held in server memory, so users will need to log in again after a server restart.

**Important limitation:** this starter project does not send email verification messages, so an email address is not proven to belong to the person registering it. For a public production deployment, add email verification, rate limiting, HTTPS, secure secret management and a proper database before relying on it to prevent impersonation or spam.

## Deploying online (free demo)

This project can be deployed as a Node.js Web Service on Render.

1. Upload the contents of this folder to a GitHub repository.
2. In Render, choose **New + → Web Service**, connect that repository, and choose the Free instance for a demo.
3. Use **Build Command** `npm install` and **Start Command** `npm start`.
4. Add an environment variable named `MODERATOR_KEY` with a long, unique secret value. Do not use the default local key for a public deployment.
5. Deploy and open the `onrender.com` URL Render provides.

The server binds to `0.0.0.0` and reads Render's `PORT` environment variable.

**Important demo limitations:** the app stores users, posts, votes, and comments in `data/db.json`. Render Free web services have an ephemeral filesystem, so data can be lost after a restart, spin-down, or redeploy. Do not use this setup for important real-world community data. Use a persistent database before a production launch. Login sessions also reset whenever the server restarts.
