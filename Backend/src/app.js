const express = require("express");
const multer = require("multer");
const cors = require("cors");
const uploadFile = require("./services/storage.service");
const postModel = require("./models/post.model");

const app = express();

// sirf apna frontend allow karo (local + deployed)
const allowedOrigins = [
  "https://image-frontend-1ahp.onrender.com",
  "http://localhost:5173",
  process.env.FRONTEND_URL, // optional: .env se extra origin
].filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      // origin undefined = Postman / server-to-server request
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error("Not allowed by CORS"));
    },
  })
);
app.use(express.json({ limit: "100kb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 }, // 10 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) return cb(null, true);
    cb(new Error("Only image files are allowed"));
  },
});

// UptimeRobot / frontend wake-up ke liye halka route
app.get("/health", (req, res) => res.status(200).json({ ok: true }));

app.post("/create-post", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Image is required" });

    const caption = (req.body.caption || "").trim();
    if (!caption) return res.status(400).json({ message: "Caption is required" });

    const result = await uploadFile(req.file.buffer, req.file.originalname);

    const post = await postModel.create({
      image: result.url,
      caption: caption.slice(0, 200),
    });

    return res.status(201).json({ message: "Post created successfully", post });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Could not create the post" });
  }
});

app.get("/posts", async (req, res) => {
  try {
    const posts = await postModel.find().sort({ createdAt: -1 }).limit(50).lean();
    return res.status(200).json({ message: "Posts fetched successfully", posts });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Could not load posts" });
  }
});

// multer / CORS ke errors ko clean message mein badlo
app.use((err, req, res, next) => {
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ message: "Image is too large (max 10 MB)" });
  }
  return res.status(400).json({ message: err.message || "Bad request" });
});

module.exports = app;