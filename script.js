"use strict";

const API = "/api";
const THEME_KEY = "nhb-theme";
const postForm = document.getElementById("postForm");
const postsContainer = document.getElementById("postsContainer");
const categoryFilter = { value: "All" };
const searchInput = document.getElementById("searchInput");
const sortSelect = document.getElementById("sortSelect");
const emptyState = document.getElementById("emptyState");
const toast = document.getElementById("toast");
const moderatorDialog = document.getElementById("moderatorDialog");
const moderatorForm = document.getElementById("moderatorForm");
const moderatorPanel = document.getElementById("moderatorPanel");

let posts = [];
let selectedTopic = "All";
let moderatorKey = "";
let moderatorMode = false;
let currentAccount = null;
let authMode = "login";
const authDialog = document.getElementById("authDialog");
let toastTimer;

function showToast(message) {
  toast.textContent = message;
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

async function apiRequest(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (moderatorKey) headers["X-Moderator-Key"] = moderatorKey;
  const response = await fetch(API + path, { ...options, headers });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);
  return result;
}

function openAuth(mode = "login") {
  setAuthMode(mode);
  document.getElementById("authError").classList.add("hidden");
  if (!authDialog.open) authDialog.showModal();
}

function setAuthMode(mode) {
  authMode = mode;
  const signup = mode === "signup";
  document.getElementById("authTitle").textContent = signup ? "Join your neighbourhood" : "Welcome back";
  document.getElementById("authIntro").textContent = signup ? "Create an account to share updates and join conversations." : "Log in to post updates, comment and upvote.";
  document.getElementById("authNameWrap").classList.toggle("hidden", !signup);
  document.getElementById("authName").required = signup;
  document.getElementById("authPassword").autocomplete = signup ? "new-password" : "current-password";
  document.getElementById("authSubmit").textContent = signup ? "Create account ↗" : "Log in ↗";
  document.getElementById("showLogin").classList.toggle("active", !signup);
  document.getElementById("showSignup").classList.toggle("active", signup);
}

function updateAccountUI() {
  const button = document.getElementById("accountButton");
  button.textContent = currentAccount ? `Log out · ${currentAccount.name}` : "Sign in / Create account";
  document.getElementById("author").value = currentAccount ? currentAccount.name : "";
  document.getElementById("author").placeholder = currentAccount ? "Signed-in account" : "Sign in to post";
  document.getElementById("author").classList.toggle("signed-in-field", Boolean(currentAccount));
  postForm.querySelector("button[type='submit']").disabled = !currentAccount;
  postForm.querySelector("button[type='submit']").title = currentAccount ? "Publish your post" : "Sign in before publishing";
}

async function loadAccount() {
  try {
    const data = await apiRequest("/me");
    currentAccount = data.user || null;
  } catch (_) { currentAccount = null; }
  updateAccountUI();
}

function setConnection(connected) {
  document.getElementById("connectionText").textContent = connected ? "Backend connected" : "Backend offline";
  const dot = document.querySelector(".status-dot");
  dot.style.background = connected ? "#47a77b" : "#ef8068";
}

function initials(name) {
  return String(name || "N").trim().split(/\s+/).slice(0, 2).map(s => s[0] || "").join("").toUpperCase();
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function categoryLabel(category) {
  return category === "General" ? "General update" :
    category === "Help Needed" ? "Help needed" :
    category === "Announcement" ? "Announcement" :
    category === "Lost & Found" ? "Lost & found" :
    category === "Event" ? "Local event" : category;
}

function updateMetrics() {
  document.getElementById("postCount").textContent = posts.length;
  document.getElementById("voteCount").textContent = posts.reduce((sum, post) => sum + (Number(post.votes) || 0), 0);
  document.getElementById("commentCount").textContent = posts.reduce((sum, post) => sum + (post.comments || []).length, 0);
}

function renderPost(post) {
  const card = element("article", "post-card");
  card.dataset.postId = post.id;

  const top = element("div", "post-top");
  const authorInfo = element("div", "author-info");
  authorInfo.append(element("span", "post-avatar", initials(post.author)));
  const authorDetails = element("div");
  authorDetails.append(element("div", "author-name", post.author), element("div", "post-time", formatDate(post.createdAt)));
  authorInfo.append(authorDetails);

  const badge = element("span", "category-badge", categoryLabel(post.category));
  badge.dataset.category = post.category;
  top.append(authorInfo, badge);

  const title = element("h3", "post-title", post.title);
  const content = element("p", "post-content", post.content);
  const divider = element("div", "post-divider");
  const actions = element("div", "post-actions");

  const voted = Boolean(post.userVoted);
  const voteButton = element("button", `action-button${voted ? " voted" : ""}`, `${voted ? "♥" : "♡"} Upvote (${post.votes || 0})`);
  voteButton.type = "button";
  voteButton.dataset.action = "vote";
  voteButton.setAttribute("aria-pressed", String(voted));

  const commentButton = element("button", "action-button", `↳ Comments (${(post.comments || []).length})`);
  commentButton.type = "button";
  commentButton.dataset.action = "comments";
  actions.append(voteButton, commentButton);

  if (moderatorMode) {
    const removeButton = element("button", "action-button delete-button", "Remove");
    removeButton.type = "button";
    removeButton.dataset.action = "delete";
    actions.append(removeButton);
  }

  const commentArea = element("section", "comment-area");
  commentArea.setAttribute("aria-label", "Comments");
  commentArea.append(element("h4", "", "Conversation"));
  const commentList = element("div", "comment-list");

  if (!post.comments || post.comments.length === 0) {
    commentList.append(element("p", "post-time", "No comments yet. Be the first to reply."));
  } else {
    post.comments.forEach(comment => {
      const item = element("div", "comment-item");
      item.append(element("strong", "", comment.author), element("p", "", comment.text));
      commentList.append(item);
    });
  }

  const commentForm = element("form", "comment-form");
  const nameInput = element("input");
  nameInput.name = "commentAuthor";
  nameInput.value = currentAccount ? currentAccount.name : "";
  nameInput.placeholder = currentAccount ? `Replying as ${currentAccount.name}` : "Sign in to reply";
  nameInput.maxLength = 40;
  nameInput.readOnly = true;
  nameInput.setAttribute("aria-label", "Signed-in account name");

  const textInput = element("input");
  textInput.name = "commentText";
  textInput.placeholder = "Add a reply…";
  textInput.maxLength = 300;
  textInput.required = true;
  textInput.setAttribute("aria-label", "Add a reply");

  const send = element("button", "", "Reply");
  send.type = "submit";
  commentForm.append(nameInput, textInput, send);
  commentArea.append(commentList, commentForm);
  card.append(top, title, content, divider, actions, commentArea);

  commentForm.addEventListener("submit", async event => {
    event.preventDefault();
    const author = currentAccount?.name || "";
    const text = textInput.value.trim();
    if (!currentAccount) { openAuth("login"); return showToast("Please sign in before replying."); }
    if (!text) return showToast("Write a comment before sending.");
    try {
      await apiRequest(`/posts/${encodeURIComponent(post.id)}/comments`, {
        method: "POST", body: JSON.stringify({ author, text })
      });
      await loadPosts();
      showToast("Your reply has been added.");
    } catch (error) {
      showToast(error.message);
    }
  });

  commentButton.addEventListener("click", () => textInput.focus());
  return card;
}

function renderPosts() {
  const query = searchInput.value.trim().toLowerCase();
  let visible = posts.filter(post => {
    const categoryMatches = selectedTopic === "All" || post.category === selectedTopic;
    const searchMatches = `${post.title} ${post.content} ${post.author} ${post.category}`.toLowerCase().includes(query);
    return categoryMatches && searchMatches;
  });

  if (sortSelect.value === "popular") visible.sort((a, b) => b.votes - a.votes);
  else if (sortSelect.value === "oldest") visible.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  else visible.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  postsContainer.replaceChildren(...visible.map(renderPost));
  emptyState.classList.toggle("hidden", visible.length !== 0);
  document.getElementById("feedCount").textContent = `Showing ${visible.length} of ${posts.length} posts`;
  updateMetrics();
}

async function loadPosts() {
  try {
    const data = await apiRequest("/posts");
    posts = data.posts || [];
    setConnection(true);
    renderPosts();
  } catch (error) {
    setConnection(false);
    postsContainer.replaceChildren();
    emptyState.classList.remove("hidden");
    emptyState.querySelector("h3").textContent = "Can't reach the backend yet.";
    emptyState.querySelector("p").textContent = "Start the Node.js server using the instructions in README.md, then refresh this page.";
    document.getElementById("feedCount").textContent = "Backend connection required";
    updateMetrics();
  }
}

postForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!currentAccount) { openAuth("login"); return showToast("Please sign in before publishing a post."); }
  const author = currentAccount.name;
  const category = document.getElementById("category").value;
  const title = document.getElementById("postTitle").value.trim();
  const content = document.getElementById("postContent").value.trim();

  if (!author || !title || !content) return showToast("Please complete all fields.");

  try {
    await apiRequest("/posts", {
      method: "POST",
      body: JSON.stringify({ author, category, title, content })
    });
    postForm.reset();
    await loadPosts();
    showToast("Your post is live on the community board.");
    console.log("Neighbourhood Help Board: authenticated post created through backend.");
  } catch (error) {
    showToast(error.message);
  }
});

postsContainer.addEventListener("click", async event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const card = button.closest("[data-post-id]");
  if (!card) return;
  const id = encodeURIComponent(card.dataset.postId);

  if (button.dataset.action === "comments") {
    card.querySelector(".comment-form input[name='commentText']")?.focus();
    return;
  }

  if (button.dataset.action === "vote") {
    if (!currentAccount) { openAuth("login"); return showToast("Please sign in before upvoting."); }
    try {
      await apiRequest(`/posts/${id}/vote`, { method: "POST", body: "{}" });
      await loadPosts();
    } catch (error) { showToast(error.message); }
  }

  if (button.dataset.action === "delete") {
    if (!moderatorMode) return showToast("Sign in as a moderator first.");
    if (!window.confirm("Remove this post and its comments?")) return;
    try {
      await apiRequest(`/posts/${id}`, { method: "DELETE" });
      await loadPosts();
      showToast("Post removed.");
    } catch (error) { showToast(error.message); }
  }
});

function setTopic(topic) {
  selectedTopic = topic;
  document.querySelectorAll("[data-topic]").forEach(button => {
    button.classList.toggle("active", button.dataset.topic === topic);
  });
  renderPosts();
}

document.querySelectorAll("[data-topic]").forEach(button => {
  button.addEventListener("click", () => setTopic(button.dataset.topic));
});
searchInput.addEventListener("input", renderPosts);
sortSelect.addEventListener("change", renderPosts);

function setModeratorMode(enabled) {
  moderatorMode = enabled;
  moderatorPanel.classList.toggle("hidden", !enabled);
  document.getElementById("moderatorButton").classList.toggle("moderator-active", enabled);
  renderPosts();
}

document.getElementById("showLogin").addEventListener("click", () => setAuthMode("login"));
document.getElementById("showSignup").addEventListener("click", () => setAuthMode("signup"));
document.getElementById("accountButton").addEventListener("click", async () => {
  if (!currentAccount) return openAuth("login");
  try {
    await apiRequest("/auth/logout", { method: "POST", body: "{}" });
    currentAccount = null;
    updateAccountUI();
    await loadPosts();
    showToast("You have been logged out.");
  } catch (error) { showToast(error.message); }
});

document.getElementById("authForm").addEventListener("submit", async event => {
  event.preventDefault();
  const errorText = document.getElementById("authError");
  errorText.classList.add("hidden");
  const body = {
    name: document.getElementById("authName").value.trim(),
    email: document.getElementById("authEmail").value.trim(),
    password: document.getElementById("authPassword").value
  };
  try {
    const data = await apiRequest(authMode === "signup" ? "/auth/signup" : "/auth/login", {
      method: "POST", body: JSON.stringify(body)
    });
    currentAccount = data.user;
    updateAccountUI();
    authDialog.close();
    document.getElementById("authForm").reset();
    await loadPosts();
    showToast(authMode === "signup" ? "Account created. Welcome to the neighbourhood!" : "You are now signed in.");
  } catch (error) {
    errorText.textContent = error.message || "Could not sign you in.";
    errorText.classList.remove("hidden");
  }
});

document.getElementById("moderatorButton").addEventListener("click", () => {
  if (moderatorMode) {
    moderatorKey = "";
    setModeratorMode(false);
    showToast("Moderator mode ended.");
  } else {
    document.getElementById("moderatorError").classList.add("hidden");
    document.getElementById("moderatorKey").value = "";
    moderatorDialog.showModal();
  }
});

document.getElementById("exitModerator").addEventListener("click", () => {
  moderatorKey = "";
  setModeratorMode(false);
  showToast("Moderator mode ended.");
});

moderatorForm.addEventListener("submit", async event => {
  event.preventDefault();
  const key = document.getElementById("moderatorKey").value;
  const errorText = document.getElementById("moderatorError");
  try {
    await apiRequest("/moderator/verify", {
      method: "POST",
      headers: { "X-Moderator-Key": key },
      body: "{}"
    });
    moderatorKey = key;
    setModeratorMode(true);
    moderatorDialog.close();
    showToast("Moderator access verified.");
  } catch (error) {
    errorText.textContent = error.message || "Access denied.";
    errorText.classList.remove("hidden");
  }
});

document.getElementById("themeButton").addEventListener("click", () => {
  const dark = !document.body.classList.contains("dark-mode");
  document.body.classList.toggle("dark-mode", dark);
  document.getElementById("themeButton").textContent = dark ? "☾" : "☼";
  try { localStorage.setItem(THEME_KEY, dark ? "dark" : "light"); } catch (_) {}
});

try {
  // Dark mode is the default on first visit; a user's later theme choice is remembered.
  const savedTheme = localStorage.getItem(THEME_KEY);
  const dark = savedTheme === null ? true : savedTheme === "dark";
  document.body.classList.toggle("dark-mode", dark);
  document.getElementById("themeButton").textContent = dark ? "☾" : "☼";
} catch (_) {
  document.body.classList.add("dark-mode");
  document.getElementById("themeButton").textContent = "☾";
}

loadAccount().then(loadPosts);
console.log("Neighbourhood Help Board frontend loaded. API endpoint:", API);
