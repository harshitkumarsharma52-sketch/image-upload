import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import imageCompression from "browser-image-compression";
import { useNavigate, Link } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
const MAX_SIZE = 15 * 1024 * 1024; // 15 MB (compress hone ke baad chhoti ho jati hai)
const MAX_CAPTION = 200;
const COLORS = ["#79b4ff", "#4f8cff", "#ffd166", "#ff6b9a", "#7cffb2", "#c4a3ff"];

const makeConfetti = () =>
  Array.from({ length: 28 }, (_, i) => {
    const angle = (Math.PI * 2 * i) / 28 + Math.random() * 0.4;
    const dist = 70 + Math.random() * 90;
    return {
      id: i,
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist - 30,
      r: Math.random() * 720 - 360,
      c: COLORS[i % COLORS.length],
      d: Math.random() * 0.12,
    };
  });

// GIF/SVG ko compress mat karo (animation / vector toot jata hai) aur chhoti file ko bhi chhodo
const shouldCompress = (file) =>
  file.size > 300 * 1024 && !/image\/(gif|svg\+xml)/.test(file.type);

const compress = async (file) => {
  if (!shouldCompress(file)) return file;
  try {
    return await imageCompression(file, {
      maxSizeMB: 0.8,
      maxWidthOrHeight: 1600,
      useWebWorker: true,
    });
  } catch (err) {
    console.warn("Compression failed, uploading original", err);
    return file;
  }
};

const CreatePost = () => {
  const navigate = useNavigate();
  const formRef = useRef(null);
  const fileRef = useRef(null);
  const timerRef = useRef(null);

  const [preview, setPreview] = useState("");
  const [fileName, setFileName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [caption, setCaption] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | success
  const [stage, setStage] = useState(""); // compressing | uploading
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [confetti, setConfetti] = useState([]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  // backend (Render free plan) so jata hai: page khulte hi jaga do
  useEffect(() => {
    axios.get(`${API_URL}/health`, { timeout: 60000 }).catch(() => {});
  }, []);

  // free the preview URL when it changes or the page closes
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  /* ---------- helpers ---------- */
  const warn = (msg) => {
    setError(msg);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    formRef.current?.animate(
      [
        { translate: "0 0" },
        { translate: "-10px 0" },
        { translate: "9px 0" },
        { translate: "-6px 0" },
        { translate: "4px 0" },
        { translate: "0 0" },
      ],
      { duration: 420, easing: "ease-in-out" }
    );
  };

  const clearFile = () => {
    if (fileRef.current) fileRef.current.value = "";
    setPreview("");
    setFileName("");
  };

  const showFile = (file) => {
    if (!file) return clearFile();
    if (!file.type.startsWith("image/")) {
      clearFile();
      return warn("Please choose an image file.");
    }
    if (file.size > MAX_SIZE) {
      clearFile();
      return warn("Image must be smaller than 15 MB.");
    }
    setError("");
    setFileName(file.name);
    setPreview(URL.createObjectURL(file));
  };

  /* ---------- leaving to the feed ---------- */
  const guardLeave = (e) => {
    if (status === "loading") {
      e.preventDefault();
      return;
    }
    if (status === "idle" && (preview || caption.trim())) {
      if (!window.confirm("Discard this post and go to the feed?")) {
        e.preventDefault();
      }
    }
  };

  /* ---------- drag and drop ---------- */
  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (fileRef.current) {
      const dt = new DataTransfer();
      dt.items.add(file);
      fileRef.current.files = dt.files; // so FormData picks it up
    }
    showFile(file);
  };

  /* ---------- cursor spotlight ---------- */
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  /* ---------- submit ---------- */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (status !== "idle") return;
    if (!fileRef.current?.files?.length) return warn("Add a photo first.");

    setStatus("loading");
    setProgress(0);
    setError("");

    try {
      // 1. compress
      setStage("compressing");
      const original = fileRef.current.files[0];
      const file = await compress(original);

      // 2. upload (progress ke saath)
      setStage("uploading");
      const data = new FormData();
      data.append("image", file, original.name);
      data.append("caption", caption.trim());

      await axios.post(`${API_URL}/create-post`, data, {
        timeout: 120000, // cold start ke liye 2 minute tak ruko
        onUploadProgress: (ev) => {
          if (ev.total) setProgress(Math.round((ev.loaded / ev.total) * 100));
        },
      });

      setConfetti(makeConfetti());
      setStatus("success");
      timerRef.current = setTimeout(() => navigate("/feed"), 1300);
    } catch (err) {
      console.error(err);
      setStatus("idle");
      setStage("");
      warn(
        err.response?.data?.message ||
          (err.code === "ECONNABORTED"
            ? "Server is taking too long. Please try again."
            : "Could not create the post. Please try again.")
      );
    }
  };

  const ratio = caption.length / MAX_CAPTION;
  const loadingLabel =
    stage === "compressing"
      ? "Optimizing"
      : progress > 0 && progress < 100
      ? `Uploading ${progress}%`
      : "Posting";
  const label = { idle: "Submit post", loading: loadingLabel, success: "Posted" }[status];

  return (
    <section className="create-post">
      <nav className="create-nav" aria-label="Page navigation">
        <Link
          to="/feed"
          className="profile-btn primary"
          onClick={guardLeave}
          aria-disabled={status === "loading"}
        >
          View feed
          <svg className="nav-arrow" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12h14m0 0-6-6m6 6-6 6" />
          </svg>
        </Link>
      </nav>

      <form ref={formRef} onSubmit={handleSubmit} onMouseMove={onMove}>
        <span className="form-ring" aria-hidden="true" />
        <span className="form-glow" aria-hidden="true" />

        <label
          className={`dropzone${dragging ? " dragging" : ""}${preview ? " has-preview" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <input
            ref={fileRef}
            type="file"
            name="image"
            accept="image/*"
            aria-label="Post image"
            onChange={(e) => showFile(e.target.files[0])}
          />

          {preview ? (
            <>
              <img className="dropzone-img" src={preview} alt="Selected preview" />
              <span className="dropzone-change">Change photo · {fileName}</span>
            </>
          ) : (
            <span className="dropzone-empty">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 16.5V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1.5M12 15V4m0 0L8 8m4-4 4 4" />
              </svg>
              <strong>Drop a photo here</strong>
              <small>or click to browse · max 15 MB</small>
            </span>
          )}
        </label>

        <div className="caption-field">
          <input
            type="text"
            name="caption"
            required
            maxLength={MAX_CAPTION}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Write a caption..."
            autoComplete="off"
            aria-label="Caption"
          />
          <div className={`caption-meter${ratio > 0.85 ? " warn" : ""}`} style={{ "--p": ratio }}>
            <span />
          </div>
          <small>
            {caption.length}/{MAX_CAPTION}
          </small>
        </div>

        {error && <p role="alert">{error}</p>}

        <div className="submit-wrap">
          <button
            type="submit"
            disabled={status !== "idle"}
            data-state={status}
            aria-busy={status === "loading"}
          >
            {label}
            {status === "success" && (
              <svg className="check" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>

          {confetti.map((p) => (
            <i
              key={p.id}
              className="confetti"
              aria-hidden="true"
              style={{ "--x": `${p.x}px`, "--y": `${p.y}px`, "--r": `${p.r}deg`, "--c": p.c, "--d": `${p.d}s` }}
            />
          ))}
        </div>
      </form>
    </section>
  );
};

export default CreatePost;