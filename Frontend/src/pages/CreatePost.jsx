import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "https://image-backend-v8mm.onrender.com";
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
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
  const [error, setError] = useState("");
  const [confetti, setConfetti] = useState([]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

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
      return warn("Image must be smaller than 5 MB.");
    }
    setError("");
    setFileName(file.name);
    setPreview(URL.createObjectURL(file));
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

    const data = new FormData(e.currentTarget);
    setStatus("loading");
    setError("");

    try {
      await axios.post(`${API_URL}/create-post`, data);
      setConfetti(makeConfetti());
      setStatus("success");
      timerRef.current = setTimeout(() => navigate("/feed"), 1300);
    } catch (err) {
      console.error(err);
      setStatus("idle");
      warn(err.response?.data?.message || "Could not create the post. Please try again.");
    }
  };

  const ratio = caption.length / MAX_CAPTION;
  const label = { idle: "Submit post", loading: "Posting", success: "Posted" }[status];

  return (
    <section className="create-post">
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
              <small>or click to browse · max 5 MB</small>
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
  
