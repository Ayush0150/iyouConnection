const express = require("express");
const app = express();

/* ✅ FIX 1: render-safe port */
const port = process.env.PORT || 8080;

const path = require("path");
const { v4: uuidv4 } = require("uuid");
const methodOverride = require("method-override");

const APP_NAME = "iyouConnect";
const ADMIN_HANDLE = "Ayush Rai";
const ADMIN_DISPLAY_NAME = "Ayush Rai";
const PROTECTED_USERS = new Set([ADMIN_HANDLE]);

const normalizeHandle = (value = "") =>
  (value || "").toString().trim().replace(/^@+/, "").toLowerCase();

const isAdminHandle = (value = "") => normalizeHandle(value) === ADMIN_HANDLE;

const LIVE_ONLINE_BASE = 125;
const LIVE_ONLINE_VARIANCE = 25;
const PAGE_SIZE = 12;

const ADMIN_STATIC_POSTS = [];

const METRIC_DEFINITIONS = [
  { key: "pods", label: "Active pods", detail: "Focused rooms", base: 32, variance: 18, format: "number" },
  { key: "briefs", label: "New briefs", detail: "Past 24h", base: 22, variance: 8, format: "number" },
  { key: "response", label: "Avg. response", detail: "Across threads", base: 115, variance: 25, format: "duration" },
];

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(methodOverride("_method"));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.locals.appName = APP_NAME;

let userGeneratedPosts = [];
let developerPost = null;

const randomShift = (v) => Math.floor(Math.random() * (v * 2 + 1)) - v;

const getLiveOnlineCount = () =>
  Math.max(0, LIVE_ONLINE_BASE + randomShift(LIVE_ONLINE_VARIANCE));

app.use((req, res, next) => {
  const live = getLiveOnlineCount();
  res.locals.liveOnlineCount = live;
  res.locals.liveOnlineCountLabel = live.toLocaleString("en-US");
  next();
});

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
  autoLikeTarget = null,
  autoLikeProfile = null,
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
  autoLikeTarget,
  autoLikeProfile,
});

const getDeveloperPost = () => {
  if (developerPost) return developerPost;

  developerPost = createPost({
    username: ADMIN_HANDLE,
    displayName: ADMIN_DISPLAY_NAME,
    content: "1st rule of programming: if it works don't touch it.",
    response: "Dev infra verified. Monitoring queue depth hourly.",
    responseAuthor: "@ops.admin",
    likes: 152,
    comments: 312,
    tags: ["product", "ops"],
  });

  return developerPost;
};

const seedSamplePosts = () => {
  return [getDeveloperPost(), ...userGeneratedPosts].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
};

let posts = seedSamplePosts();
const rebuildFeed = () => (posts = seedSamplePosts());

/* ✅ FIX 2: ROOT ROUTE */
app.get("/", (req, res) => {
  res.redirect("/posts");
});

/* ROUTES */
app.get("/posts/new", (req, res) => {
  res.render("new.ejs", { pageTitle: `Create Post | ${APP_NAME}` });
});

app.post("/posts", (req, res) => {
  const username = req.body.username?.trim();
  const content = req.body.content?.trim();
  if (!username || !content) return res.status(400).send("Required");

  const newPost = createPost({
    username: normalizeHandle(username),
    displayName: username,
    content: content.slice(0, 320),
  });

  userGeneratedPosts.unshift(newPost);
  rebuildFeed();
  res.redirect("/posts");
});

app.get("/posts", (req, res) => {
  rebuildFeed();
  const page = Number(req.query.page || 1);
  const totalPages = Math.ceil(posts.length / PAGE_SIZE);
  const start = (page - 1) * PAGE_SIZE;

  res.render("index.ejs", {
    posts: posts.slice(start, start + PAGE_SIZE),
    metrics: METRIC_DEFINITIONS,
    pagination: { currentPage: page, totalPages },
  });
});

app.get("/posts/:id", (req, res) => {
  const post = posts.find((p) => p.id === req.params.id);
  res.render("show.ejs", { post });
});

app.get("/posts/:id/edit", (req, res) => {
  const post = posts.find((p) => p.id === req.params.id);
  res.render("edit.ejs", { post });
});

app.patch("/posts/:id", (req, res) => {
  const post = posts.find((p) => p.id === req.params.id);
  if (post?.isDeveloper) return res.status(403).send("Locked");
  post.content = req.body.content;
  rebuildFeed();
  res.redirect("/posts");
});

app.delete("/posts/:id", (req, res) => {
  userGeneratedPosts = userGeneratedPosts.filter((p) => p.id !== req.params.id);
  rebuildFeed();
  res.redirect("/posts");
});

/* SERVER */
app.listen(port, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${port}`);
});
