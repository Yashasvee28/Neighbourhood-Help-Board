"use strict";

// ── Firebase configuration ────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyBD_OKZRjbfVQnY9mlKglETCSy6ffMTISg",
  authDomain: "ghbourhood-9b2af.firebaseapp.com",
  databaseURL: "https://ghbourhood-9b2af-default-rtdb.firebaseio.com",
  projectId: "ghbourhood-9b2af",
  storageBucket: "ghbourhood-9b2af.firebasestorage.app",
  messagingSenderId: "658853437009",
  appId: "1:658853437009:web:ac7a13e5d8b2b2b419e270",
  measurementId: "G-BLXTRPM2JF"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.database();

// ── Moderator password (client-side only — change before going public) ─────────
const MODERATOR_PASSWORD = "neighbourhood2026";

// ── DOM refs ──────────────────────────────────────────────────────────────────
const THEME_KEY       = "nhb-theme";
const postForm        = document.getElementById("postForm");
const postsContainer  = document.getElementById("postsContainer");
const searchInput     = document.getElementById("searchInput");
const sortSelect      = document.getElementById("sortSelect");
const emptyState      = document.getElementById("emptyState");
const toast           = document.getElementById("toast");
const moderatorDialog = document.getElementById("moderatorDialog");
const moderatorForm   = document.getElementById("moderatorForm");
const moderatorPanel  = document.getElementById("moderatorPanel");
const authDialog      = document.getElementById("authDialog");

// Auth Gate (Greeting Screen) refs
const authGate        = document.getElementById("authGate");
const gateCloseBtn    = document.getElementById("gateCloseBtn");
const gateTabLogin    = document.getElementById("gateTabLogin");
const gateTabSignup   = document.getElementById("gateTabSignup");
const gateForm        = document.getElementById("gateForm");
const gateNameField   = document.getElementById("gateNameField");
const gateName        = document.getElementById("gateName");
const gateEmail       = document.getElementById("gateEmail");
const gatePassword    = document.getElementById("gatePassword");
const gateError       = document.getElementById("gateError");
const gateSubmitBtn   = document.getElementById("gateSubmitBtn");
const gateSubmitText  = document.getElementById("gateSubmitText");
const gateGuestBtn    = document.getElementById("gateGuestBtn");
const gateThemeBtn    = document.getElementById("gateThemeBtn");
const gateTitle       = document.getElementById("gateTitle");
const gateSubtitle    = document.getElementById("gateSubtitle");

// ── App state ─────────────────────────────────────────────────────────────────
let posts         = [];
let postsSnapshot = {};   // raw RTDB posts object
let commentsSnap  = {};   // raw RTDB comments object
let selectedTopic = "All";
let moderatorMode = false;
let currentAccount = null; // { uid, name, email }
let authMode      = "login";
let gateMode      = "login";
let toastTimer;

// ── Utilities ─────────────────────────────────────────────────────────────────

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function initials(name) {
  return String(name || "N").trim().split(/\s+/).slice(0, 2).map(s => s[0] || "").join("").toUpperCase();
}

function formatDate(value) {
  const date = new Date(typeof value === "number" ? value : value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function categoryLabel(cat) {
  return ({ General: "General update", "Help Needed": "Help needed", Announcement: "Announcement",
            "Lost & Found": "Lost & found", Event: "Local event" })[cat] || cat;
}

function setConnection(connected) {
  document.getElementById("connectionText").textContent = connected ? "Firebase connected" : "Firebase offline";
  document.querySelector(".status-dot").style.background = connected ? "#47a77b" : "#ef8068";
}

// ── Merge raw RTDB data into posts array ──────────────────────────────────────

function buildPosts() {
  posts = Object.entries(postsSnapshot).map(([id, post]) => {
    const rawComments = commentsSnap[id] || {};
    const comments = Object.values(rawComments)
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const userVoted = currentAccount && post.voterIds
      ? Boolean(post.voterIds[currentAccount.uid])
      : false;
    return { id, ...post, comments, userVoted };
  });
}

// ── Auth UI & Gate ────────────────────────────────────────────────────────────

function showAuthGate(canClose = false) {
  if (!authGate) return;
  authGate.classList.remove("hidden");
  if (gateCloseBtn) {
    gateCloseBtn.classList.toggle("hidden", !canClose);
  }
  if (gateError) gateError.classList.add("hidden");
}

function hideAuthGate() {
  if (authGate) authGate.classList.add("hidden");
}

function setGateAuthMode(mode) {
  gateMode = mode;
  const isSignup = mode === "signup";
  if (gateTitle) {
    gateTitle.textContent = isSignup ? "Join your neighbourhood" : "Welcome to the neighbourhood";
  }
  if (gateSubtitle) {
    gateSubtitle.textContent = isSignup
      ? "Create an account to share updates and join conversations."
      : "Sign in or create an account to start sharing and connecting.";
  }
  if (gateNameField) {
    gateNameField.classList.toggle("hidden", !isSignup);
  }
  if (gateName) {
    gateName.required = isSignup;
  }
  if (gatePassword) {
    gatePassword.autocomplete = isSignup ? "new-password" : "current-password";
  }
  if (gateSubmitText) {
    gateSubmitText.textContent = isSignup ? "Create account" : "Log in";
  }
  if (gateTabLogin) gateTabLogin.classList.toggle("active", !isSignup);
  if (gateTabSignup) gateTabSignup.classList.toggle("active", isSignup);
  if (gateError) gateError.classList.add("hidden");
}

function openAuth(mode = "login") {
  setGateAuthMode(mode);
  showAuthGate(true); // Allow closing since user is already exploring
}

function setAuthMode(mode) {
  authMode = mode;
  const signup = mode === "signup";
  document.getElementById("authTitle").textContent    = signup ? "Join your neighbourhood" : "Welcome back";
  document.getElementById("authIntro").textContent    = signup ? "Create an account to share updates and join conversations." : "Log in to post updates, comment and upvote.";
  document.getElementById("authNameWrap").classList.toggle("hidden", !signup);
  document.getElementById("authName").required        = signup;
  document.getElementById("authPassword").autocomplete = signup ? "new-password" : "current-password";
  document.getElementById("authSubmit").textContent   = signup ? "Create account ↗" : "Log in ↗";
  document.getElementById("showLogin").classList.toggle("active", !signup);
  document.getElementById("showSignup").classList.toggle("active", signup);
}

function updateAccountUI() {
  const btn = document.getElementById("accountButton");
  btn.textContent = currentAccount ? `Log out · ${currentAccount.name}` : "Sign in / Create account";
  document.getElementById("author").value = currentAccount ? currentAccount.name : "";
  document.getElementById("author").placeholder = currentAccount ? "Signed-in account" : "Sign in to post";
  document.getElementById("author").classList.toggle("signed-in-field", Boolean(currentAccount));
  const submit = postForm.querySelector("button[type='submit']");
  submit.disabled = !currentAccount;
  submit.title    = currentAccount ? "Publish your post" : "Sign in before publishing";
}

// ── Metrics ───────────────────────────────────────────────────────────────────

function updateMetrics() {
  document.getElementById("postCount").textContent    = posts.length;
  document.getElementById("voteCount").textContent    = posts.reduce((s, p) => s + (Number(p.votes) || 0), 0);
  document.getElementById("commentCount").textContent = posts.reduce((s, p) => s + (p.comments || []).length, 0);
}

// ── Render a single post card ─────────────────────────────────────────────────

function renderPost(post) {
  const card = element("article", "post-card");
  card.dataset.postId = post.id;

  // Top row — author + badge
  const top        = element("div", "post-top");
  const authorInfo = element("div", "author-info");
  authorInfo.append(element("span", "post-avatar", initials(post.author)));
  const authorDetails = element("div");
  authorDetails.append(
    element("div", "author-name", post.author),
    element("div", "post-time", formatDate(post.createdAt))
  );
  authorInfo.append(authorDetails);
  const badge = element("span", "category-badge", categoryLabel(post.category));
  badge.dataset.category = post.category;
  top.append(authorInfo, badge);

  // Actions
  const actions     = element("div", "post-actions");
  const voted       = Boolean(post.userVoted);
  const voteButton  = element("button", `action-button${voted ? " voted" : ""}`,
    `${voted ? "♥" : "♡"} Upvote (${post.votes || 0})`);
  voteButton.type = "button"; voteButton.dataset.action = "vote";
  voteButton.setAttribute("aria-pressed", String(voted));

  const commentButton = element("button", "action-button", `↳ Comments (${(post.comments || []).length})`);
  commentButton.type = "button"; commentButton.dataset.action = "comments";
  actions.append(voteButton, commentButton);

  if (moderatorMode) {
    const del = element("button", "action-button delete-button", "Remove");
    del.type = "button"; del.dataset.action = "delete";
    actions.append(del);
  }

  // Comments section
  const commentArea = element("section", "comment-area");
  commentArea.setAttribute("aria-label", "Comments");
  commentArea.append(element("h4", "", "Conversation"));
  const commentList = element("div", "comment-list");

  if (!post.comments || post.comments.length === 0) {
    commentList.append(element("p", "post-time", "No comments yet. Be the first to reply."));
  } else {
    post.comments.forEach(c => {
      const item = element("div", "comment-item");
      item.append(element("strong", "", c.author), element("p", "", c.text));
      commentList.append(item);
    });
  }

  // Comment form
  const commentForm = element("form", "comment-form");
  const nameInput   = element("input");
  nameInput.name = "commentAuthor";
  nameInput.value = currentAccount ? currentAccount.name : "";
  nameInput.placeholder = currentAccount ? `Replying as ${currentAccount.name}` : "Sign in to reply";
  nameInput.maxLength = 40; nameInput.readOnly = true;
  nameInput.setAttribute("aria-label", "Signed-in account name");

  const textInput = element("input");
  textInput.name = "commentText"; textInput.placeholder = "Add a reply…";
  textInput.maxLength = 300; textInput.required = true;
  textInput.setAttribute("aria-label", "Add a reply");

  const send = element("button", "", "Reply");
  send.type = "submit";
  commentForm.append(nameInput, textInput, send);
  commentArea.append(commentList, commentForm);
  card.append(top, element("h3", "post-title", post.title),
              element("p", "post-content", post.content),
              element("div", "post-divider"), actions, commentArea);

  commentForm.addEventListener("submit", async ev => {
    ev.preventDefault();
    if (!currentAccount) { openAuth("login"); return showToast("Please sign in before replying."); }
    const text = textInput.value.trim();
    if (!text) return showToast("Write a comment before sending.");
    try {
      await db.ref(`comments/${post.id}`).push({
        author: currentAccount.name,
        text,
        createdAt: Date.now()
      });
      textInput.value = "";
      showToast("Your reply has been added.");
    } catch (e) { showToast(e.message); }
  });

  commentButton.addEventListener("click", () => textInput.focus());
  return card;
}

// ── Render feed ───────────────────────────────────────────────────────────────

function renderPosts() {
  const query = searchInput.value.trim().toLowerCase();
  let visible = posts.filter(p => {
    const catOk    = selectedTopic === "All" || p.category === selectedTopic;
    const searchOk = `${p.title} ${p.content} ${p.author} ${p.category}`.toLowerCase().includes(query);
    return catOk && searchOk;
  });

  if (sortSelect.value === "popular") visible.sort((a, b) => (b.votes || 0) - (a.votes || 0));
  else if (sortSelect.value === "oldest") visible.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  else visible.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  postsContainer.replaceChildren(...visible.map(renderPost));
  emptyState.classList.toggle("hidden", visible.length !== 0);
  document.getElementById("feedCount").textContent = `Showing ${visible.length} of ${posts.length} posts`;
  updateMetrics();
}

// ── Firebase real-time listeners ──────────────────────────────────────────────

db.ref("posts").on("value", snap => {
  postsSnapshot = snap.val() || {};
  buildPosts();
  setConnection(true);
  renderPosts();
}, () => {
  setConnection(false);
  emptyState.classList.remove("hidden");
  emptyState.querySelector("h3").textContent = "Can't reach Firebase.";
  emptyState.querySelector("p").textContent  = "Check your Firebase Realtime Database rules and try again.";
  document.getElementById("feedCount").textContent = "Connection required";
  updateMetrics();
});

db.ref("comments").on("value", snap => {
  commentsSnap = snap.val() || {};
  buildPosts();
  renderPosts();
});

// ── Post form ─────────────────────────────────────────────────────────────────

postForm.addEventListener("submit", async ev => {
  ev.preventDefault();
  if (!currentAccount) { openAuth("login"); return showToast("Please sign in before publishing a post."); }
  const title   = document.getElementById("postTitle").value.trim();
  const content = document.getElementById("postContent").value.trim();
  const category = document.getElementById("category").value;
  if (!title || !content) return showToast("Please complete all fields.");
  try {
    await db.ref("posts").push({
      author:    currentAccount.name,
      authorId:  currentAccount.uid,
      title, content, category,
      createdAt: Date.now(),
      votes: 0,
      voterIds: {}
    });
    postForm.reset();
    showToast("Your post is live on the community board.");
  } catch (e) { showToast(e.message); }
});

// ── Post actions (vote / comments / delete) ───────────────────────────────────

postsContainer.addEventListener("click", async ev => {
  const btn  = ev.target.closest("button[data-action]");
  if (!btn) return;
  const card = btn.closest("[data-post-id]");
  if (!card) return;
  const postId = card.dataset.postId;

  if (btn.dataset.action === "comments") {
    card.querySelector(".comment-form input[name='commentText']")?.focus();
    return;
  }

  if (btn.dataset.action === "vote") {
    if (!currentAccount) { openAuth("login"); return showToast("Please sign in before upvoting."); }
    const post    = posts.find(p => p.id === postId);
    if (!post) return;
    const hasVoted = post.voterIds && post.voterIds[currentAccount.uid];
    try {
      if (hasVoted) {
        await db.ref(`posts/${postId}/voterIds/${currentAccount.uid}`).remove();
        await db.ref(`posts/${postId}/votes`).transaction(v => Math.max(0, (v || 0) - 1));
      } else {
        await db.ref(`posts/${postId}/voterIds/${currentAccount.uid}`).set(true);
        await db.ref(`posts/${postId}/votes`).transaction(v => (v || 0) + 1);
      }
    } catch (e) { showToast(e.message); }
  }

  if (btn.dataset.action === "delete") {
    if (!moderatorMode) return showToast("Sign in as a moderator first.");
    if (!window.confirm("Remove this post and its comments?")) return;
    try {
      await db.ref(`posts/${postId}`).remove();
      await db.ref(`comments/${postId}`).remove();
      showToast("Post removed.");
    } catch (e) { showToast(e.message); }
  }
});

// ── Topic filters ─────────────────────────────────────────────────────────────

function setTopic(topic) {
  selectedTopic = topic;
  document.querySelectorAll("[data-topic]").forEach(b =>
    b.classList.toggle("active", b.dataset.topic === topic)
  );
  renderPosts();
}
document.querySelectorAll("[data-topic]").forEach(b =>
  b.addEventListener("click", () => setTopic(b.dataset.topic))
);
searchInput.addEventListener("input", renderPosts);
sortSelect.addEventListener("change", renderPosts);

// ── Moderator ─────────────────────────────────────────────────────────────────

function setModeratorMode(enabled) {
  moderatorMode = enabled;
  moderatorPanel.classList.toggle("hidden", !enabled);
  document.getElementById("moderatorButton").classList.toggle("moderator-active", enabled);
  renderPosts();
}

document.getElementById("moderatorButton").addEventListener("click", () => {
  if (moderatorMode) {
    setModeratorMode(false);
    showToast("Moderator mode ended.");
  } else {
    document.getElementById("moderatorError").classList.add("hidden");
    document.getElementById("moderatorKey").value = "";
    moderatorDialog.showModal();
  }
});
document.getElementById("exitModerator").addEventListener("click", () => {
  setModeratorMode(false);
  showToast("Moderator mode ended.");
});
moderatorForm.addEventListener("submit", ev => {
  ev.preventDefault();
  const key       = document.getElementById("moderatorKey").value;
  const errorText = document.getElementById("moderatorError");
  if (key === MODERATOR_PASSWORD) {
    setModeratorMode(true);
    moderatorDialog.close();
    showToast("Moderator access verified.");
  } else {
    errorText.textContent = "That moderator key is not correct.";
    errorText.classList.remove("hidden");
  }
});

// ── Firebase Auth & Gate Event Listeners ─────────────────────────────────────

// Gate tabs
if (gateTabLogin)  gateTabLogin.addEventListener("click",  () => setGateAuthMode("login"));
if (gateTabSignup) gateTabSignup.addEventListener("click", () => setGateAuthMode("signup"));

// Continue as guest
if (gateGuestBtn) {
  gateGuestBtn.addEventListener("click", () => {
    try { sessionStorage.setItem("nhb_guest", "true"); } catch (_) {}
    hideAuthGate();
    showToast("Browsing as guest. Sign in anytime to post or upvote.");
  });
}

// Gate manual dismiss
if (gateCloseBtn) {
  gateCloseBtn.addEventListener("click", () => {
    hideAuthGate();
  });
}

// Gate form submit
if (gateForm) {
  gateForm.addEventListener("submit", async ev => {
    ev.preventDefault();
    if (gateError) gateError.classList.add("hidden");
    const name     = gateName ? gateName.value.trim() : "";
    const email    = gateEmail ? gateEmail.value.trim() : "";
    const password = gatePassword ? gatePassword.value : "";

    if (gateSubmitBtn) {
      gateSubmitBtn.disabled = true;
      gateSubmitBtn.style.opacity = "0.7";
    }

    try {
      if (gateMode === "signup") {
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        if (name) {
          await cred.user.updateProfile({ displayName: name });
        }
      } else {
        await auth.signInWithEmailAndPassword(email, password);
      }
      try { sessionStorage.removeItem("nhb_guest"); } catch (_) {}
      hideAuthGate();
      gateForm.reset();
      showToast(gateMode === "signup" ? "Account created! Welcome to the neighbourhood." : "You are now signed in.");
    } catch (e) {
      const msg =
        e.code === "auth/email-already-in-use"    ? "An account with this email already exists." :
        e.code === "auth/wrong-password" || e.code === "auth/user-not-found" || e.code === "auth/invalid-credential"
                                                  ? "Email or password is incorrect." :
        e.code === "auth/weak-password"          ? "Use at least 6 characters for your password." :
        e.code === "auth/invalid-email"          ? "Please enter a valid email address." :
        e.code === "auth/operation-not-allowed"  ? "Email/Password sign-in is disabled in your Firebase Console. Please enable it under Authentication > Sign-in method." :
        e.message || "Could not sign you in.";
      if (gateError) {
        gateError.textContent = msg;
        gateError.classList.remove("hidden");
      }
    } finally {
      if (gateSubmitBtn) {
        gateSubmitBtn.disabled = false;
        gateSubmitBtn.style.opacity = "";
      }
    }
  });
}

// Modal dialog tabs (kept for backward compatibility)
document.getElementById("showLogin")?.addEventListener("click",  () => setAuthMode("login"));
document.getElementById("showSignup")?.addEventListener("click", () => setAuthMode("signup"));

// Account button in topbar
document.getElementById("accountButton").addEventListener("click", async () => {
  if (!currentAccount) return openAuth("login");
  try {
    await auth.signOut();
    try { sessionStorage.removeItem("nhb_guest"); } catch (_) {}
    showToast("You have been logged out.");
    showAuthGate(false); // Greet the user again with the sign-in screen
  } catch (e) {
    showToast(e.message);
  }
});

// Modal dialog form submit (kept for fallback)
document.getElementById("authForm")?.addEventListener("submit", async ev => {
  ev.preventDefault();
  const errorText = document.getElementById("authError");
  errorText.classList.add("hidden");
  const name     = document.getElementById("authName").value.trim();
  const email    = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;
  try {
    if (authMode === "signup") {
      const cred = await auth.createUserWithEmailAndPassword(email, password);
      await cred.user.updateProfile({ displayName: name });
    } else {
      await auth.signInWithEmailAndPassword(email, password);
    }
    authDialog.close();
    document.getElementById("authForm").reset();
    showToast(authMode === "signup" ? "Account created. Welcome to the neighbourhood!" : "You are now signed in.");
  } catch (e) {
    const msg =
      e.code === "auth/email-already-in-use"                       ? "An account with this email already exists." :
      e.code === "auth/wrong-password" || e.code === "auth/user-not-found"
        || e.code === "auth/invalid-credential"                    ? "Email or password is incorrect." :
      e.code === "auth/weak-password"                              ? "Use at least 6 characters for your password." :
      e.code === "auth/operation-not-allowed"                      ? "Email/Password sign-in is disabled in your Firebase Console. Please enable it under Authentication > Sign-in method." :
      e.message || "Could not sign you in.";
    errorText.textContent = msg;
    errorText.classList.remove("hidden");
  }
});

// Update UI whenever auth state changes (login, logout, page refresh)
auth.onAuthStateChanged(user => {
  if (user) {
    currentAccount = { uid: user.uid, name: user.displayName || user.email, email: user.email };
    hideAuthGate();
  } else {
    currentAccount = null;
    let isGuest = false;
    try { isGuest = sessionStorage.getItem("nhb_guest") === "true"; } catch (_) {}
    if (isGuest) {
      hideAuthGate();
    } else {
      showAuthGate(false); // First arrival greeting gate
    }
  }
  updateAccountUI();
  buildPosts();   // recalculate userVoted with new identity
  renderPosts();
});

// ── Theme ─────────────────────────────────────────────────────────────────────

function applyTheme(dark) {
  document.body.classList.toggle("dark-mode", dark);
  const icon = dark ? "☾" : "☼";
  const btn1 = document.getElementById("themeButton");
  const btn2 = document.getElementById("gateThemeBtn");
  if (btn1) btn1.textContent = icon;
  if (btn2) btn2.textContent = icon;
  try { localStorage.setItem(THEME_KEY, dark ? "dark" : "light"); } catch (_) {}
}

document.getElementById("themeButton")?.addEventListener("click", () => {
  applyTheme(!document.body.classList.contains("dark-mode"));
});

if (gateThemeBtn) {
  gateThemeBtn.addEventListener("click", () => {
    applyTheme(!document.body.classList.contains("dark-mode"));
  });
}

try {
  const savedTheme = localStorage.getItem(THEME_KEY);
  const dark = savedTheme === null ? true : savedTheme === "dark";
  applyTheme(dark);
} catch (_) {
  applyTheme(true);
}

console.log("Neighbourhood Help Board loaded — powered by Firebase Realtime Database.");
