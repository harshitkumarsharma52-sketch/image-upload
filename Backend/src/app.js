const express = require("express");
const multer = require("multer");
const cors = require("cors");
const {uploadFile} = require("./services/storage.service");
const { deleteFile } = require("./services/storage.service");
const postModel = require("./models/post.model");
const mongoose = require("mongoose");

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "https://note-application-frontend-2iqb.onrender.com",
  process.env.FRONTEND_URL,
  ...(process.env.CLIENT_ORIGINS || "").split(","),
]
  .map((origin) => origin?.trim())
  .filter(Boolean);

app.disable("x-powered-by");
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return cb(null, true);
      }
      cb(new Error("Not allowed by CORS"));
    },
  })
);

app.use(express.json({ limit: "100kb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (ACCEPTED_IMAGE_TYPES.has(file.mimetype)) {
      return cb(null, true);
    }
    cb(new Error("Use a JPG, PNG, WebP, GIF, or AVIF image"));
  },
});

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({ ok: true });
});

// Create Post API
app.post("/create-post", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Image is required" });
    }

    const caption = (req.body.caption || "").trim();

    if (!caption) {
      return res.status(400).json({ message: "Caption is required" });
    }

    if (caption.length > 200) {
      return res.status(400).json({ message: "Caption must be 200 characters or fewer" });
    }

    const result = await uploadFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    const post = await postModel.create({
      image: result.url,
      imageId: result.fileId,
      caption,
    });

    return res.status(201).json({
      message: "Post created successfully",
      post,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Could not create the post",
    });
  }
});

// Get All Posts API
app.get("/posts", async (req, res) => {
  try {
    const posts = await postModel
      .find()
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return res.status(200).json({
      message: "Posts fetched successfully",
      posts,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Could not load posts",
    });
  }
});

// DELETE Post API
app.delete("/posts/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid post ID",
      });
    }

    // Find post
    const post = await postModel.findById(id);

    if (!post) {
      return res.status(404).json({
        message: "Post not found",
      });
    }

    // Delete image from ImageKit
    if (post.imageId) {
      try {
        await deleteFile(post.imageId);
      } catch (imageError) {
        console.error("ImageKit delete error:", imageError);
        // Continue even if image deletion fails? 
        // Or fail the whole request? 
        // Usually, it's better to log and continue if the DB record is going to be deleted.
      }
    }

    // Delete post from MongoDB
    await postModel.findByIdAndDelete(id);

    return res.status(200).json({
      message: "Post deleted successfully",
      postId: id,
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Could not delete post",
    });
  }
});

// Error handling
app.use((err, req, res, next) => {
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      message: "Image is too large (max 10 MB)",
    });
  }

  return res.status(400).json({
    message: err.message || "Bad request",
  });
});

module.exports = app;
