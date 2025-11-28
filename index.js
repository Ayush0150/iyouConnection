const express = require("express");
const app = express();
const port = 8080;
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const methodOverride = require("method-override");

const APP_NAME = "iyouConnect";
const ADMIN_HANDLE = "ayush";
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
  {
    key: "pods",
    label: "Active pods",
    detail: "Focused rooms",
    base: 32,
    variance: 18,
    format: "number",
  },
  {
    key: "briefs",
    label: "New briefs",
    detail: "Past 24h",
    base: 22,
    variance: 8,
    format: "number",
  },
  {
    key: "response",
    label: "Avg. response",
    detail: "Across threads",
    base: 115,
    variance: 25,
    format: "duration",
  },
];

app.use(express.urlencoded({ extended: true }));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(methodOverride("_method"));

app.locals.appName = APP_NAME;

let userGeneratedPosts = [];
let developerPost = null;

const randomShift = (variance) =>
  Math.floor(Math.random() * (variance * 2 + 1)) - variance;

const getLiveOnlineCount = () =>
  Math.max(0, LIVE_ONLINE_BASE + randomShift(LIVE_ONLINE_VARIANCE));

const formatDuration = (seconds) => {
  const safe = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safe / 60);
  const rem = safe % 60;
  if (minutes <= 0) {
    return `${rem}s`;
  }
  return `${minutes}m ${rem.toString().padStart(2, "0")}s`;
};

const formatMetricValue = (value, format) => {
  if (format === "duration") {
    return formatDuration(value);
  }
  return value.toLocaleString("en-US");
};

const createMetricSnapshots = () =>
  METRIC_DEFINITIONS.map((metric) => {
    const rawValue = Math.max(0, metric.base + randomShift(metric.variance));
    return {
      ...metric,
      rawValue,
      displayValue: formatMetricValue(rawValue, metric.format),
    };
  });

app.use((req, res, next) => {
  const liveCount = getLiveOnlineCount();
  res.locals.liveOnlineCount = liveCount;
  res.locals.liveOnlineCountLabel = liveCount.toLocaleString("en-US");
  res.locals.liveOnlineBase = LIVE_ONLINE_BASE;
  res.locals.liveOnlineVariance = LIVE_ONLINE_VARIANCE;
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

const formatNumber = (value) => value.toLocaleString("en-US");

const formatRelativeTime = (value) => {
  const date = new Date(value);
  const diffSeconds = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 1000)
  );
  const intervals = [
    { label: "s", seconds: 1 },
    { label: "m", seconds: 60 },
    { label: "h", seconds: 60 * 60 },
    { label: "d", seconds: 60 * 60 * 24 },
  ];
  if (diffSeconds < 10) return "Just now";
  for (let i = intervals.length - 1; i >= 0; i -= 1) {
    const { label, seconds } = intervals[i];
    if (diffSeconds >= seconds) {
      const count = Math.floor(diffSeconds / seconds);
      return `${count}${label} ago`;
    }
  }
  return "Just now";
};

const estimateReadMinutes = (text) => {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 42));
};

const formatPostForView = (post) => {
  const created = new Date(post.createdAt);
  const autoLikeTarget = ensureAutoLikeTarget(post);
  const autoLikeProfile = ensureAutoLikePersona(post);
  const canManage = !post.isDeveloper;
  return {
    ...post,
    displayDate: new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
    }).format(created),
    relativeTime: formatRelativeTime(created),
    likesDisplay: formatNumber(post.likes),
    commentsDisplay: formatNumber(post.comments),
    readingMinutes: estimateReadMinutes(post.content),
    displayLabel: post.displayName || `@${post.username}`,
    autoLikeTarget,
    autoLikeProfile,
    canManage,
  };
};

const randomInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const ensureAutoLikeTarget = (post) => {
  if (!post || post.isDeveloper) {
    post.autoLikeTarget = null;
    return null;
  }
  if (typeof post.autoLikeTarget !== "number") {
    post.autoLikeTarget = randomInt(12, 48);
  }
  return post.autoLikeTarget;
};

const ensureAutoLikePersona = (post) => {
  if (!post || post.isDeveloper) {
    post.autoLikeProfile = null;
    return null;
  }
  if (post.autoLikeProfile) {
    return post.autoLikeProfile;
  }
  const baseMinSeconds = randomInt(90, 240);
  const baseMaxSeconds = baseMinSeconds + randomInt(120, 360);
  post.autoLikeProfile = {
    intervalMin: baseMinSeconds * 1000,
    intervalMax: baseMaxSeconds * 1000,
    stepMin: 1,
    stepMax: randomInt(2, 3),
    idleChance: randomInt(15, 40),
  };
  return post.autoLikeProfile;
};

const getDeveloperPost = () => {
  if (developerPost) {
    return developerPost;
  }

  developerPost = createPost({
    username: ADMIN_HANDLE,
    displayName: ADMIN_DISPLAY_NAME,
    content: "1st rule of programming: if it works don't touch it.",
    createdAt: new Date().toISOString(),
    response:
      "Dev infra verified. Monitoring queue depth hourly; ping ops if latency exceeds 220ms.",
    responseAuthor: "@ops.admin",
    likes: 152,
    comments: 312,
    tags: ["product", "roadmap", "ops"],
    autoLikeTarget: null,
  });

  return developerPost;
};

const seedSamplePosts = () => {
  const seeded = [];
  seeded.push(getDeveloperPost());

  userGeneratedPosts = userGeneratedPosts.map((post) => {
    ensureAutoLikeTarget(post);
    ensureAutoLikePersona(post);
    return post;
  });

  seeded.push(...userGeneratedPosts);

  return seeded.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
};

let posts = seedSamplePosts();

const rebuildFeed = () => {
  posts = seedSamplePosts();
};

app.get("/posts/new", (req, res) => {
  res.render("new.ejs", {
    pageTitle: `Create a Post | ${APP_NAME}`,
    pageDescription: "Compose something new for the iyouConnect community.",
    activePage: "create",
  });
});

app.post("/posts", (req, res) => {
  const username = (req.body.username || "").trim();
  const content = (req.body.content || "").trim();

  if (!username || !content) {
    return res.status(400).send("Username and content are required.");
  }

  const safeHandle = normalizeHandle(username);
  const isAdminAuthor = isAdminHandle(safeHandle);

  const newPost = createPost({
    username: safeHandle,
    displayName: username,
    content: content.slice(0, 320),
    likes: 0,
    comments: 0,
    tags: [isAdminAuthor ? "admin" : "community"],
    autoLikeTarget: isAdminAuthor ? null : undefined,
  });

  if (!isAdminAuthor) {
    ensureAutoLikeTarget(newPost);
    ensureAutoLikePersona(newPost);
  }

  userGeneratedPosts = [newPost, ...userGeneratedPosts];
  rebuildFeed();
  res.redirect("/posts");
});

app.get("/posts", (req, res) => {
  rebuildFeed();
  const requestedPage = parseInt(req.query.page, 10);
  const totalPages = Math.max(1, Math.ceil(posts.length / PAGE_SIZE));
  const currentPage = Number.isNaN(requestedPage)
    ? 1
    : Math.min(Math.max(requestedPage, 1), totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const viewPosts = posts
    .slice(startIndex, startIndex + PAGE_SIZE)
    .map(formatPostForView);
  const metrics = createMetricSnapshots();

  res.render("index.ejs", {
    posts: viewPosts,
    metrics,
    pagination: {
      currentPage,
      totalPages,
      hasPrev: currentPage > 1,
      hasNext: currentPage < totalPages,
    },
    pageTitle: `${APP_NAME} Feed`,
    pageDescription:
      "Stay close to your people, share updates, and discover fresh voices on a calm, modern feed.",
    activePage: "feed",
  });
});

app.get("/posts/:id", (req, res) => {
  const { id } = req.params;
  const post = posts.find((p) => id === p.id);
  const viewPost = post ? formatPostForView(post) : null;

  res.render("show.ejs", {
    post: viewPost,
    pageTitle: `${APP_NAME} | Post by @${post?.username || "user"}`,
    pageDescription: post?.content || "See what your connections are sharing.",
    activePage: "feed",
  });
});

app.patch("/posts/:id", (req, res) => {
  let { id } = req.params;
  let newContent = req.body.content;
  let post = posts.find((p) => id === p.id);
  if (!post) {
    return res.status(404).send("Post not found.");
  }
  if (post.isDeveloper) {
    return res
      .status(403)
      .send("Developer posts are locked and cannot be edited.");
  }
  post.content = newContent;
  const idx = userGeneratedPosts.findIndex((p) => p.id === id);
  if (idx >= 0) {
    userGeneratedPosts[idx] = {
      ...userGeneratedPosts[idx],
      content: newContent,
    };
  }
  rebuildFeed();
  res.redirect("/posts");
});

app.get("/posts/:id/edit", (req, res) => {
  let { id } = req.params;
  let post = posts.find((p) => id === p.id);
  const viewPost = post ? formatPostForView(post) : null;
  res.render("edit.ejs", {
    post: viewPost,
    pageTitle: `Edit Post | ${APP_NAME}`,
    pageDescription: "Update your thoughts so they stay fresh and relevant.",
    activePage: "create",
  });
});

app.delete("/posts/:id", (req, res) => {
  let { id } = req.params;
  const targetPost = posts.find((p) => p.id === id);
  if (targetPost?.isDeveloper) {
    return res
      .status(403)
      .send("Developer posts are locked and cannot be deleted.");
  }
  userGeneratedPosts = userGeneratedPosts.filter((p) => p.id !== id);
  rebuildFeed();
  res.redirect("/posts");
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Server running on all interfaces at port ${port}`);
});
