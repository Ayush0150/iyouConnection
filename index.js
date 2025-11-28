const express = require("express");
const app = express();

/* ================= PORT (RENDER SAFE) ================= */
const port = process.env.PORT || 8080;

const path = require("path");
const { v4: uuidv4 } = require("uuid");
const methodOverride = require("method-override");

/* ================= APP CONFIG ================= */
const APP_NAME = "iyouConnect";
const ADMIN_HANDLE = "ayush rai";
const ADMIN_DISPLAY_NAME = "Ayush Rai";
const PROTECTED_USERS = new Set([ADMIN_HANDLE]);

const LIVE_ONLINE_BASE = 125;
const LIVE_ONLINE_VARIANCE = 25;
const PAGE_SIZE = 12;

/* ================= HELPERS ================= */
const normalizeHandle = (value = "") =>
  value.toString().trim().replace(/^@+/, "").toLowerCase();

const randomShift = (v) =>
  Math.floor(Math.random() * (v * 2 + 1)) - v;

const getLiveOnlineCount = () =>
  Math.max(0, LIVE_ONLINE_BASE + randomShift(LIVE_ONLINE_VARIANCE));

/* ================= MIDDLEWARE ================= */
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(methodOverride("_method"));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.locals.appName = APP_NAME;

/* ✅ GLOBAL EJS-SAFE LOCALS (CRITICAL FIX) */
app.use((req, res, next) => {
  // SEO defaults
  res.locals.pageTitle = `${APP_NAME} | Connect Freely`;
  res.locals.pageDescription =
    "Stay close to your people, share updates, and discover fresh voices.";

  // Navbar / header
  res.locals.activePage = "";

  // Live indicator (USED BY header.ejs)
  const live = getLiveOnlineCount();
  res.locals.liveOnlineCount = live;
  res.locals.liveOnlineCountLabel = live.toLocaleString("en-US");
  res.locals.liveOnlineBase = LIVE_ONLINE_BASE;
  res.locals.liveOnlineVariance = LIVE_ONLINE_VARIANCE;

  next();
});

/* ================= DATA ================= */
let userGeneratedPosts = [];
let developerPost = null;

/* ================= MODELS ================= */
const createPost = ({
  username,
  displayName = null,
  content,
  createdAt = new Date().toISOString(),
  response = null,
  responseAuthor = null,
  likes = 0,
  comments = 0,
  tags = [],
}) => ({
  id: uuidv4(),
  username,
  displayName,
  content,
  createdAt,
  isDeveloper: PROTECTED_USERS.has(username),
  response,
  responseAuthor,
  likes,
  comments,
  tags,
});

/* ================= SEED DATA ================= */
const getDeveloperPost = () => {
  if (developerPost) return developerPost;

  developerPost = createPost({
    username: ADMIN_HANDLE,
    displayName: ADMIN_DISPLAY_NAME,
    content: "1st rule of programming: if it works don't touch it.",
    response:
      "Dev infra verified. Monitoring queue depth hourly; ping ops if latency exceeds 220ms.",
    responseAuthor: "@ops.admin",
    likes: 152,
    comments: 312,
    tags: ["product", "roadmap", "ops"],
  });

  return developerPost;
};

const seedSamplePosts = () =>
  [getDeveloperPost(), ...userGeneratedPosts].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

let posts = seedSamplePosts();
const rebuildFeed = () => (posts = seedSamplePosts());

/* ================= ROUTES ================= */

/* ✅ ROOT */
app.get("/", (req, res) => {
  res.redirect("/posts");
});

/* ✅ FEED */
app.get("/posts", (req, res) => {
  res.locals.activePage = "feed";

  rebuildFeed();
  const page = Number(req.query.page || 1);
  const totalPages = Math.max(1, Math.ceil(posts.length / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;

  res.render("index.ejs", {
    posts: posts.slice(start, start + PAGE_SIZE),
    pagination: { currentPage: page, totalPages },
    pageTitle: `${APP_NAME} Feed`,
  });
});

/* ✅ NEW POST */
app.get("/posts/new", (req, res) => {
  res.locals.activePage = "create";

  res.render("new.ejs", {
    pageTitle: `Create a Post | ${APP_NAME}`,
  });
});

/* ✅ CREATE POST */
app.post("/posts", (req, res) => {
  const username = req.body.username?.trim();
  const content = req.body.content?.trim();

  if (!username || !content) {
    return res.status(400).send("Username and content are required.");
  }

  const newPost = createPost({
    username: normalizeHandle(username),
    displayName: username,
    content: content.slice(0, 320),
  });

  userGeneratedPosts.unshift(newPost);
  rebuildFeed();
  res.redirect("/posts");
});

/* ✅ SHOW POST */
app.get("/posts/:id", (req, res) => {
  res.locals.activePage = "feed";

  const post = posts.find((p) => p.id === req.params.id);
  if (!post) return res.status(404).send("Post not found");

  res.render("show.ejs", {
    post,
    pageTitle: `${APP_NAME} | Post`,
  });
});

/* ✅ EDIT POST */
app.get("/posts/:id/edit", (req, res) => {
  res.locals.activePage = "create";

  const post = posts.find((p) => p.id === req.params.id);
  if (!post) return res.status(404).send("Post not found");

  res.render("edit.ejs", {
    post,
    pageTitle: `Edit Post | ${APP_NAME}`,
  });
});

/* ✅ UPDATE POST */
app.patch("/posts/:id", (req, res) => {
  const post = posts.find((p) => p.id === req.params.id);
  if (!post) return res.status(404).send("Post not found");
  if (post.isDeveloper)
    return res.status(403).send("Developer posts are locked");

  post.content = req.body.content;
  rebuildFeed();
  res.redirect("/posts");
});

/* ✅ DELETE POST */
app.delete("/posts/:id", (req, res) => {
  userGeneratedPosts = userGeneratedPosts.filter(
    (p) => p.id !== req.params.id
  );
  rebuildFeed();
  res.redirect("/posts");
});

/* ================= SERVER ================= */
app.listen(port, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${port}`);
});
