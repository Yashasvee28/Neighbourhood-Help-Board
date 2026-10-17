// Neighbourhood Help Board backend — Node.js built-in modules only.
// No paid services and no third-party packages are required.

"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const MODERATOR_KEY = process.env.MODERATOR_KEY || "change-this-local-moderator-key";
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const MAX_BODY_BYTES = 20 * 1024;
const sessions = new Map();
const SESSION_COOKIE = "nhb_session";

// In-memory fallback for read-only filesystems (e.g. Vercel serverless).
let memoryDB = null;

function initDB() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify({ posts: [], votes: {}, users: [] }, null, 2));
    }
  } catch (_) {
    // Filesystem is read-only — use in-memory store.
    if (!memoryDB) memoryDB = { posts: [], votes: {}, users: [] };
  }
}
initDB();

function readDB() {
  if (memoryDB) return memoryDB;
  try {
    const data = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    if (!Array.isArray(data.posts)) data.posts = [];
    if (!data.votes || typeof data.votes !== "object") data.votes = {};
    if (!Array.isArray(data.users)) data.users = [];
    return data;
  } catch (error) {
    console.error("Database file could not be read:", error.message);
    // Fall back to in-memory store.
    if (!memoryDB) memoryDB = { posts: [], votes: {}, users: [] };
    return memoryDB;
  }
}

function writeDB(db) {
  if (memoryDB) {
    // Keep the in-memory reference in sync.
    memoryDB = db;
    return;
  }
  try {
    const temporary = DB_FILE + ".tmp";
    fs.writeFileSync(temporary, JSON.stringify(db, null, 2));
    fs.renameSync(temporary, DB_FILE);
  } catch (_) {
    // Filesystem is read-only — switch to in-memory mode.
    memoryDB = db;
  }
}

function sendJSON(res, status, data) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  };
  // Preserve a visitor cookie added earlier in this request.
  if (res.hasHeader("Set-Cookie")) headers["Set-Cookie"] = res.getHeader("Set-Cookie");
  res.writeHead(status, headers);
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    let bytes = 0;
    req.on("data", chunk => {
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) {
        reject(Object.assign(new Error("Request body is too large."), { status: 413 }));
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(Object.assign(new Error("Request body must be valid JSON."), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

function cleanString(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function moderatorAuthorized(req) {
  const provided = req.headers["x-moderator-key"];
  if (typeof provided !== "string") return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(MODERATOR_KEY);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function getSessionToken(req) {
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/(?:^|;\s*)nhb_session=([a-f0-9-]{20,80})/);
  return match ? match[1] : "";
}

function currentUser(req) {
  const token = getSessionToken(req);
  const userId = token ? sessions.get(token) : null;
  if (!userId) return null;
  const db = readDB();
  const user = db.users.find(item => item.id === userId);
  return user ? { id: user.id, name: user.name, email: user.email } : null;
}

function requireUser(req, res) {
  const user = currentUser(req);
  if (!user) {
    sendJSON(res, 401, { error: "Please sign in or create an account before participating." });
    return null;
  }
  return user;
}

function setSessionCookie(res, token) {
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800`);
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 210000, 32, "sha256").toString("hex");
}

function publicPost(post, req) {
  const user = currentUser(req);
  const voterToken = user ? user.id : getVoterToken(req);
  const db = readDB();
  const voted = Array.isArray(db.votes[post.id]) && db.votes[post.id].includes(voterToken);
  return { ...post, userVoted: voted };
}

function getVoterToken(req) {
  // Local demo uses a browser-generated visitor token cookie when available.
  // This is a convenience mechanism, not strong identity verification.
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/(?:^|;\s*)cg_visitor=([a-f0-9-]{10,80})/);
  if (match) return match[1];
  return "";
}

function ensureVisitorCookie(req, res) {
  if (!getVoterToken(req)) {
    const token = crypto.randomUUID();
    res.setHeader("Set-Cookie", `cg_visitor=${token}; Path=/; SameSite=Lax; HttpOnly`);
    req.headers.cookie = `cg_visitor=${token}`;
  }
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ({
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".ico": "image/x-icon"
  })[ext] || "application/octet-stream";
}

function serveStatic(req, res, pathname) {
  const requested = pathname === "/" ? "/index.html" : decodeURIComponent(pathname);
  const resolved = path.resolve(ROOT, "." + requested);

  if (!resolved.startsWith(ROOT + path.sep) || resolved === DB_FILE) {
    return sendJSON(res, 403, { error: "Forbidden." });
  }

  fs.readFile(resolved, (error, content) => {
    if (error) {
      return sendJSON(res, error.code === "ENOENT" ? 404 : 500, {
        error: error.code === "ENOENT" ? "File not found." : "Could not read file."
      });
    }
    res.writeHead(200, {
      "Content-Type": contentType(resolved),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": path.extname(resolved) === ".html" ? "no-cache" : "public, max-age=300"
    });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  } catch {
    return sendJSON(res, 400, { error: "Invalid URL." });
  }

  const pathname = url.pathname;
  const method = req.method.toUpperCase();

  if (method === "GET" && pathname === "/api/health") {
    return sendJSON(res, 200, { status: "ok", service: "Neighbourhood Help Board API" });
  }

  if (pathname.startsWith("/api/")) {
    try {
      if (method === "GET" && pathname === "/api/me") {
        return sendJSON(res, 200, { user: currentUser(req) });
      }

      if (method === "POST" && pathname === "/api/auth/signup") {
        const body = await readBody(req);
        const name = cleanString(body.name, 40);
        const email = cleanString(body.email, 254).toLowerCase();
        const password = typeof body.password === "string" ? body.password : "";
        if (name.length < 2) return sendJSON(res, 400, { error: "Please enter a name with at least 2 characters." });
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sendJSON(res, 400, { error: "Enter a valid email address." });
        if (password.length < 10 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return sendJSON(res, 400, { error: "Use at least 10 characters with both letters and numbers." });
        const db = readDB();
        if (db.users.some(user => user.email === email)) return sendJSON(res, 409, { error: "An account with this email already exists. Please sign in." });
        const salt = crypto.randomBytes(16).toString("hex");
        const user = { id: crypto.randomUUID(), name, email, salt, passwordHash: hashPassword(password, salt), createdAt: new Date().toISOString() };
        db.users.push(user);
        writeDB(db);
        const token = crypto.randomUUID() + crypto.randomUUID();
        sessions.set(token, user.id);
        setSessionCookie(res, token);
        return sendJSON(res, 201, { user: { id: user.id, name: user.name, email: user.email } });
      }

      if (method === "POST" && pathname === "/api/auth/login") {
        const body = await readBody(req);
        const email = cleanString(body.email, 254).toLowerCase();
        const password = typeof body.password === "string" ? body.password : "";
        const db = readDB();
        const user = db.users.find(item => item.email === email);
        if (!user || !crypto.timingSafeEqual(Buffer.from(hashPassword(password, user.salt)), Buffer.from(user.passwordHash))) {
          return sendJSON(res, 401, { error: "Email or password is incorrect." });
        }
        const token = crypto.randomUUID() + crypto.randomUUID();
        sessions.set(token, user.id);
        setSessionCookie(res, token);
        return sendJSON(res, 200, { user: { id: user.id, name: user.name, email: user.email } });
      }

      if (method === "POST" && pathname === "/api/auth/logout") {
        const token = getSessionToken(req);
        if (token) sessions.delete(token);
        res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
        return sendJSON(res, 200, { ok: true });
      }

      if (method === "GET" && pathname === "/api/posts") {
        ensureVisitorCookie(req, res);
        const db = readDB();
        const result = db.posts
          .map(post => publicPost(post, req))
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        return sendJSON(res, 200, { posts: result });
      }

      if (method === "POST" && pathname === "/api/moderator/verify") {
        if (!moderatorAuthorized(req)) {
          return sendJSON(res, 401, { error: "That moderator key is not correct." });
        }
        return sendJSON(res, 200, { ok: true });
      }

      if (method === "POST" && pathname === "/api/posts") {
        const user = requireUser(req, res);
        if (!user) return;
        const body = await readBody(req);
        const author = user.name;
        const title = cleanString(body.title, 100);
        const content = cleanString(body.content, 1000);
        const category = cleanString(body.category, 30);
        const allowed = ["General", "Help Needed", "Announcement", "Lost & Found", "Event"];

        if (!author || !title || !content) {
          return sendJSON(res, 400, { error: "Name, title and description are required." });
        }
        if (!allowed.includes(category)) {
          return sendJSON(res, 400, { error: "Choose a valid post category." });
        }

        const db = readDB();
        const post = {
          id: crypto.randomUUID(),
          author,
          title,
          content,
          category,
          createdAt: new Date().toISOString(),
          votes: 0,
          comments: []
        };
        db.posts.push(post);
        writeDB(db);
        return sendJSON(res, 201, { post });
      }

      const commentMatch = pathname.match(/^\/api\/posts\/([^/]+)\/comments$/);
      if (method === "POST" && commentMatch) {
        const user = requireUser(req, res);
        if (!user) return;
        const postId = decodeURIComponent(commentMatch[1]);
        const body = await readBody(req);
        const author = user.name;
        const text = cleanString(body.text, 300);
        if (!author || !text) return sendJSON(res, 400, { error: "Name and comment are required." });

        const db = readDB();
        const post = db.posts.find(item => item.id === postId);
        if (!post) return sendJSON(res, 404, { error: "Post not found." });
        post.comments.push({ id: crypto.randomUUID(), author, text, createdAt: new Date().toISOString() });
        writeDB(db);
        return sendJSON(res, 201, { comment: post.comments[post.comments.length - 1] });
      }

      const voteMatch = pathname.match(/^\/api\/posts\/([^/]+)\/vote$/);
      if (method === "POST" && voteMatch) {
        const user = requireUser(req, res);
        if (!user) return;
        const voterToken = user.id;
        if (!voterToken) return sendJSON(res, 400, { error: "Could not identify this browser. Refresh and try again." });

        const postId = decodeURIComponent(voteMatch[1]);
        const db = readDB();
        const post = db.posts.find(item => item.id === postId);
        if (!post) return sendJSON(res, 404, { error: "Post not found." });

        if (!Array.isArray(db.votes[postId])) db.votes[postId] = [];
        const voters = db.votes[postId];
        const existingIndex = voters.indexOf(voterToken);
        if (existingIndex >= 0) {
          voters.splice(existingIndex, 1);
          post.votes = Math.max(0, post.votes - 1);
        } else {
          voters.push(voterToken);
          post.votes += 1;
        }
        writeDB(db);
        return sendJSON(res, 200, { votes: post.votes, userVoted: existingIndex < 0 });
      }

      const deleteMatch = pathname.match(/^\/api\/posts\/([^/]+)$/);
      if (method === "DELETE" && deleteMatch) {
        if (!moderatorAuthorized(req)) {
          return sendJSON(res, 401, { error: "Moderator access is required to remove posts." });
        }
        const postId = decodeURIComponent(deleteMatch[1]);
        const db = readDB();
        const before = db.posts.length;
        db.posts = db.posts.filter(post => post.id !== postId);
        delete db.votes[postId];
        if (db.posts.length === before) return sendJSON(res, 404, { error: "Post not found." });
        writeDB(db);
        return sendJSON(res, 200, { ok: true, message: "Post removed." });
      }

      return sendJSON(res, 404, { error: "API route not found." });
    } catch (error) {
      console.error("API error:", error);
      return sendJSON(res, error.status || 500, {
        error: error.status ? error.message : "The server could not complete that request."
      });
    }
  }

  if (method !== "GET" && method !== "HEAD") {
    return sendJSON(res, 405, { error: "Method not allowed." });
  }
  return serveStatic(req, res, pathname);
});

server.listen(PORT, HOST, () => {
  console.log(`Neighbourhood Help Board is running at http://${HOST}:${PORT}`);
  console.log(`Health check: http://${HOST}:${PORT}/api/health`);
  if (MODERATOR_KEY === "change-this-local-moderator-key") {
    console.warn("SECURITY NOTE: Using the default local moderator key.");
    console.warn("Set MODERATOR_KEY before exposing this server to other users.");
  }
});

function shutdown() {
  server.close(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Export for Vercel serverless runtime.
module.exports = server;
