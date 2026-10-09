import React, { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
const STORE_KEY = "liked-posts";

const readLiked = () => {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || [];
  } catch {
    return [];
  }
};

const HeartIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 21s-7-4.6-9.3-9A5.4 5.4 0 0 1 12 6a5.4 5.4 0 0 1 9.3 6c-2.3 4.4-9.3 9-9.3 9z" />
  </svg>
);

const Feed = () => {
  const [posts, setPosts] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [liked, setLiked] = useState(readLiked); // array of post ids
  const [activeIndex, setActiveIndex] = useState(null); // open post in viewer
  const [burstId, setBurstId] = useState(null); // double-tap heart animation
  const [tab, setTab] = useState("all"); // all | liked
  const [query, setQuery] = useState("");
  const dialogRef = useRef(null);

  /* ---------- load posts ---------- */
  useEffect(() => {
    const controller = new AbortController();
    axios
      .get(`${API_URL}/posts`, { signal: controller.signal })
      .then((res) => {
        setPosts(res.data.posts || []);
        setStatus("ready");
      })
      .catch((err) => {
        if (axios.isCancel(err)) return;
        console.error(err);
        setStatus("error");
      });
    return () => controller.abort();
  }, []);

  /* ---------- likes (saved in this browser) ---------- */
  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(liked));
    } catch {
      /* storage unavailable, likes just won't persist */
    }
  }, [liked]);

  const isLiked = (id) => liked.includes(id);

  const toggleLike = useCallback((id) => {
    setLiked((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    // To save on your server, call it here, e.g.:
    // axios.patch(`${API_URL}/posts/${id}/like`).catch(console.error);
  }, []);

  const likeCount = (post) => (post.likes ?? 0) + (isLiked(post._id) ? 1 : 0);

  const q = query.trim().toLowerCase();
  const visible = posts.filter(
    (p) =>
      (tab === "all" || isLiked(p._id)) &&
      (!q || (p.caption || "").toLowerCase().includes(q))
  );
  const likedTotal = posts.filter((p) => isLiked(p._id)).length;

  // close the viewer if the open post disappears (e.g. unliked in the Liked tab)
  useEffect(() => {
    if (activeIndex !== null && !visible[activeIndex]) setActiveIndex(null);
  }, [activeIndex, visible]);

  const doubleTapLike = (post) => {
    if (!isLiked(post._id)) toggleLike(post._id);
    setBurstId(post._id);
    setTimeout(() => setBurstId(null), 800);
  };

  /* ---------- viewer (native <dialog>: focus trap + Esc built in) ---------- */
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (activeIndex !== null && !dialog.open) dialog.showModal();
    if (activeIndex === null && dialog.open) dialog.close();
  }, [activeIndex]);

  const step = (dir) =>
    setActiveIndex((i) => (i + dir + visible.length) % visible.length);

  const onViewerKey = (e) => {
    if (e.key === "ArrowRight") step(1);
    if (e.key === "ArrowLeft") step(-1);
  };

  const active = activeIndex !== null ? visible[activeIndex] : null;
  const label = (n) => `${n} ${n === 1 ? "like" : "likes"}`;

  return (
    <>
      <section className="feed-section">
        <header className="feed-header">
          <div>
            <div className="brand">Feed</div>
            <p className="feed-title">
              {status === "ready"
                ? `${visible.length} ${visible.length === 1 ? "post" : "posts"}`
                : "Fresh posts from the community"}
            </p>
          </div>

          <div className="feed-tools">
            <div className="seg" style={{ "--i": tab === "liked" ? 1 : 0 }} role="group" aria-label="Filter posts">
              <button type="button" aria-pressed={tab === "all"} onClick={() => setTab("all")}>
                All
              </button>
              <button type="button" aria-pressed={tab === "liked"} onClick={() => setTab("liked")}>
                Liked{likedTotal > 0 ? ` (${likedTotal})` : ""}
              </button>
            </div>

            <label className="search">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search captions"
                aria-label="Search captions"
              />
              {query && (
                <button type="button" className="search-clear" onClick={() => setQuery("")} aria-label="Clear search">
                  ×
                </button>
              )}
            </label>

            <Link to="/" className="profile-btn primary hide-sm">
              <span aria-hidden="true">+</span> New post
            </Link>
          </div>
        </header>

        {status === "loading" &&
          [1, 2, 3, 4].map((n) => <div key={n} className="loading-card" />)}

        {status === "error" && <p>Couldn't load posts. Please try again later.</p>}

        {status === "ready" && visible.length === 0 && (
          <p>
            {posts.length === 0
              ? "No posts available"
              : tab === "liked" && !q
              ? "You haven't liked any posts yet. Tap the heart on a post."
              : "No posts match your search."}
          </p>
        )}

        {status === "ready" &&
          visible.map((post, i) => {
            const on = isLiked(post._id);
            return (
              <article key={post._id} className="post">
                <div
                  className="post-image-wrapper"
                  onDoubleClick={() => doubleTapLike(post)}
                >
                  <button
                    type="button"
                    className="post-open"
                    onClick={() => setActiveIndex(i)}
                    aria-label={`Open post: ${post.caption}`}
                  >
                    <img src={post.image} alt={post.caption} loading="lazy" />
                  </button>

                  <div className="post-actions">
                    <button
                      type="button"
                      className={`action-btn like-btn${on ? " liked" : ""}`}
                      aria-pressed={on}
                      aria-label={on ? "Unlike post" : "Like post"}
                      onClick={() => toggleLike(post._id)}
                    >
                      <HeartIcon />
                    </button>
                  </div>

                  {burstId === post._id && (
                    <span className="heart-burst" aria-hidden="true">
                      <HeartIcon />
                    </span>
                  )}
                </div>

                <p className="post-caption">{post.caption}</p>
                <div className="post-footer">
                  <span>{label(likeCount(post))}</span>
                </div>
              </article>
            );
          })}
      </section>

      <Link to="/" className="fab" aria-label="Create new post">
        +
      </Link>

      <dialog
        ref={dialogRef}
        className="lightbox"
        aria-label="Post viewer"
        onClose={() => setActiveIndex(null)}
        onKeyDown={onViewerKey}
        onClick={(e) => {
          if (e.target === dialogRef.current) setActiveIndex(null); // backdrop click
        }}
      >
        {active && (
          <div className="lightbox-card">
            <button
              type="button"
              className="lightbox-close"
              onClick={() => setActiveIndex(null)}
              aria-label="Close"
            >
              ×
            </button>

            <img className="lightbox-img" src={active.image} alt={active.caption} />

            <div className="lightbox-side">
              <p className="lightbox-caption">{active.caption}</p>

              <div className="lightbox-actions">
                <button
                  type="button"
                  className={`lightbox-like${isLiked(active._id) ? " liked" : ""}`}
                  aria-pressed={isLiked(active._id)}
                  onClick={() => toggleLike(active._id)}
                >
                  <HeartIcon />
                  {label(likeCount(active))}
                </button>
                <span className="lightbox-count">
                  {activeIndex + 1} / {visible.length}
                </span>
              </div>

              {visible.length > 1 && (
                <div className="lightbox-nav">
                  <button type="button" onClick={() => step(-1)}>
                    ← Previous
                  </button>
                  <button type="button" onClick={() => step(1)}>
                    Next →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </dialog>
    </>
  );
};

export default Feed;