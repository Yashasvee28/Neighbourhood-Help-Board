# Neighbourhood Help Board

A responsive community board built with HTML, CSS and browser JavaScript. The browser app uses Firebase Authentication and Realtime Database for accounts, posts, comments and votes.

## Run locally

Install Node.js 26 or newer, then run:

```bash
npm start
```

Open `http://127.0.0.1:3000`. The `server.js` file is retained for local development; the deployed Vercel site does not use its JSON-file backend.

## Deploy on Vercel

The Vercel deployment is a static site. `npm run build` copies only `index.html`, `style.css` and `script.js` into `dist/`, which keeps the local Node server out of the public deployment.

1. Import this repository into Vercel. Set **Root Directory** to the folder containing `package.json` and `index.html`.
2. Choose **Other** for Framework Preset, set Build Command to `npm run build`, and Output Directory to `dist`.
3. Deploy the site and add its `*.vercel.app` hostname under Firebase Console → Authentication → Settings → Authorized domains.
4. Enable Email/Password sign-in in Firebase Authentication and configure Realtime Database Security Rules for the intended users and operations.

The `vercel.json` file sets the static output directory. It removes the previous PHP runtime override and rewrite that caused `/` to invoke the Node server as a function.

## Firebase and security

Firebase client configuration is in `script.js`. Client configuration is visible in the browser; protect the database with Firebase Security Rules and do not put service-account credentials in the static site.

The current moderator password and moderator email allowlist are also in `script.js`, so they are visible to visitors and must not be treated as security controls. Enforce moderator-only database writes in Firebase Security Rules or move that check to a trusted server before using the board publicly.

## Static build

```bash
npm run build
```

This creates `dist/`, which is ignored by Git and served by Vercel.