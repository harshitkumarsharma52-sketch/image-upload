
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import axios from "axios";
import { Link } from "react-router-dom";

// Deployed Backend URL
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

const STORE_KEY = "liked-posts";

// Read liked posts from localStorage
const readLiked = () => {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || [];
  } catch {
    return [];
  }
};

// Optimize ImageKit images
const optimize = (url, width = 700) => {
  if (!url || !url.includes("ik.imagekit.io")) return url;

  return `${url}${url.includes("?") ? "&" : "?"}tr=w-${width},q-75,f-auto`;
};

// Heart Icon
const HeartIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 21s-7-4.6-9.3-9A5.4 5.4 0 0 1 12 6a5.4 5.4 0 0 1 9.3 6c-2.3 4.4-9.3 9-9.3 9z" />
  </svg>
);

// Delete Icon
const DeleteIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v7m6-7v7"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const Feed = () => {
  const [posts, setPosts] = useState([]);

  const [status, setStatus] = useState("loading");
  const [slow, setSlow] = useState(false);

  const [liked, setLiked] = useState(readLiked);

  const [activeIndex, setActiveIndex] = useState(null);
  const [burstId, setBurstId] = useState(null);

  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");

  // Delete loading state
  const [deletingId, setDeletingId] = useState(null);

  const dialogRef = useRef(null);
  const burstTimer = useRef(null);
  const slowTimerRef = useRef(null);

  /* ---------- Load Posts ---------- */

  const loadPosts = useCallback((signal) => {
    setStatus("loading");
    setSlow(false);

    clearTimeout(slowTimerRef.current);
    slowTimerRef.current = setTimeout(() => setSlow(true), 4000);

    axios
      .get(`${API_URL}/posts`, {
        signal,
        timeout: 60000,
      })
      .then((res) => {
        setPosts(res.data.posts || []);
        setStatus("ready");
      })
      .catch((err) => {
        if (axios.isCancel(err)) return;

        console.error("Load posts error:", err);
        setStatus("error");
      })
      .finally(() => {
        clearTimeout(slowTimerRef.current);
      });

    return () => clearTimeout(slowTimerRef.current);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    // Start after the effect commits so React does not receive a synchronous state update on mount.
    const requestTimer = setTimeout(() => loadPosts(controller.signal), 0);

    return () => {
      controller.abort();
      clearTimeout(requestTimer);
      clearTimeout(slowTimerRef.current);
    };
  }, [loadPosts]);

  useEffect(() => {
    return () => clearTimeout(burstTimer.current);
  }, []);

  /* ---------- Save Likes ---------- */

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(liked));
    } catch {
      // Storage unavailable
    }
  }, [liked]);

  const isLiked = (id) => liked.includes(id);

  const toggleLike = useCallback((id) => {
    setLiked((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id]
    );
  }, []);

  const likeCount = (post) =>
    (post.likes ?? 0) + (isLiked(post._id) ? 1 : 0);

  /* ---------- Delete Post API ---------- */

  const deletePost = async (id) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this post? This action cannot be undone."
    );

    if (!confirmDelete) return;

    if (deletingId) return;

    try {
      setDeletingId(id);

      const response = await axios.delete(
        `${API_URL}/posts/${id}`,
        { timeout: 60000 }
      );

      // Remove post from React state
      setPosts((prev) =>
        prev.filter((post) => post._id !== id)
      );

      // Remove like from localStorage state
      setLiked((prev) =>
        prev.filter((postId) => postId !== id)
      );

      // Close image viewer
      setActiveIndex(null);

      console.log(response.data.message);

    } catch (error) {
      console.error("Delete post error:", error);

      alert(
        error.response?.data?.message ||
        "Failed to delete post. Please try again."
      );

    } finally {
      setDeletingId(null);
    }
  };

  /* ---------- Search and Filter ---------- */

  const q = query.trim().toLowerCase();

  const visible = useMemo(
    () =>
      posts.filter(
        (p) =>
          (tab === "all" || liked.includes(p._id)) &&
          (!q || (p.caption || "").toLowerCase().includes(q))
      ),
    [posts, tab, liked, q]
  );

  const likedTotal = posts.filter((p) =>
    liked.includes(p._id)
  ).length;

  /* ---------- Viewer ---------- */

  const doubleTapLike = (post) => {
    if (!isLiked(post._id)) {
      toggleLike(post._id);
    }

    setBurstId(post._id);

    clearTimeout(burstTimer.current);

    burstTimer.current = setTimeout(() => {
      setBurstId(null);
    }, 800);
  };

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) return;

    if (activeIndex !== null && !dialog.open) {
      dialog.showModal();
    }

    if (activeIndex === null && dialog.open) {
      dialog.close();
    }
  }, [activeIndex]);

  const step = (dir) => {
    if (!visible.length) return;
    setActiveIndex((i) =>
      i === null ? 0 : (i + dir + visible.length) % visible.length
    );
  };

  const onViewerKey = (e) => {
    if (e.key === "ArrowRight") step(1);
    if (e.key === "ArrowLeft") step(-1);
  };

  const active =
    activeIndex !== null ? visible[activeIndex] : null;

  const label = (n) =>
    `${n} ${n === 1 ? "like" : "likes"}`;

  /* ---------- UI ---------- */

  return (
    <>
      <section className="feed-section">

        {/* Header */}

        <header className="feed-header">
          <div>
            <div className="brand">Feed</div>

            <p className="feed-title">
              {status === "ready"
                ? `${visible.length} ${
                    visible.length === 1 ? "post" : "posts"
                  }`
                : "Fresh posts from the community"}
            </p>
          </div>

          <div className="feed-tools">

            {/* Tabs */}

            <div
              className="seg"
              style={{ "--i": tab === "liked" ? 1 : 0 }}
              role="group"
              aria-label="Filter posts"
            >
              <button
                type="button"
                aria-pressed={tab === "all"}
                onClick={() => setTab("all")}
              >
                All
              </button>

              <button
                type="button"
                aria-pressed={tab === "liked"}
                onClick={() => setTab("liked")}
              >
                Liked{likedTotal > 0 ? ` (${likedTotal})` : ""}
              </button>
            </div>

            {/* Search */}

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
                <button
                  type="button"
                  className="search-clear"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </label>

            <Link
              to="/"
              className="profile-btn primary hide-sm"
            >
              <span aria-hidden="true">+</span> New post
            </Link>

          </div>
        </header>

        {/* Loading */}

        {status === "loading" && (
          <>
            {slow && (
              <p role="status">
                Server is waking up, this can take up to a minute...
              </p>
            )}

            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="loading-card" />
            ))}
          </>
        )}

        {/* Error */}

        {status === "error" && (
          <p role="alert">
            Couldn't load posts.{" "}

            <button
              type="button"
              onClick={() => loadPosts()}
            >
              Try again
            </button>
          </p>
        )}

        {/* Empty State */}

        {status === "ready" && visible.length === 0 && (
          <p>
            {posts.length === 0
              ? "No posts available"
              : tab === "liked" && !q
              ? "You haven't liked any posts yet. Tap the heart on a post."
              : "No posts match your search."}
          </p>
        )}

        {/* Posts */}

        {status === "ready" &&
          visible.map((post, i) => {
            const on = isLiked(post._id);
            const isDeleting = deletingId === post._id;

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
                    <img
                      src={optimize(post.image, 700)}
                      alt={post.caption}
                      loading="lazy"
                      decoding="async"
                    />
                  </button>

                  <div className="post-actions">

                    {/* Like Button */}

                    <button
                      type="button"
                      className={`action-btn like-btn${
                        on ? " liked" : ""
                      }`}
                      aria-pressed={on}
                      aria-label={
                        on ? "Unlike post" : "Like post"
                      }
                      onClick={() => toggleLike(post._id)}
                    >
                      <HeartIcon />
                    </button>

                    {/* Delete Button */}

                    <button
                      type="button"
                      className="action-btn delete-btn"
                      onClick={() => deletePost(post._id)}
                      disabled={isDeleting || deletingId !== null}
                      aria-label="Delete post"
                      title="Delete post"
                    >
                      {isDeleting ? "..." : <DeleteIcon />}
                    </button>

                  </div>

                  {/* Double Tap Animation */}

                  {burstId === post._id && (
                    <span
                      className="heart-burst"
                      aria-hidden="true"
                    >
                      <HeartIcon />
                    </span>
                  )}

                </div>

                <p className="post-caption">
                  {post.caption}
                </p>

                <div className="post-footer">
                  <span>{label(likeCount(post))}</span>
                </div>

              </article>
            );
          })}

      </section>

      {/* Create Post Button */}

      <Link
        to="/"
        className="fab"
        aria-label="Create new post"
      >
        +
      </Link>

      {/* Image Viewer */}

      <dialog
        ref={dialogRef}
        className="lightbox"
        aria-label="Post viewer"
        onClose={() => setActiveIndex(null)}
        onKeyDown={onViewerKey}
        onClick={(e) => {
          if (e.target === dialogRef.current) {
            setActiveIndex(null);
          }
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

            <img
              className="lightbox-img"
              src={optimize(active.image, 1600)}
              alt={active.caption}
            />

            <div className="lightbox-side">

              <p className="lightbox-caption">
                {active.caption}
              </p>

              <div className="lightbox-actions">

                {/* Like */}

                <button
                  type="button"
                  className={`lightbox-like${
                    isLiked(active._id) ? " liked" : ""
                  }`}
                  aria-pressed={isLiked(active._id)}
                  onClick={() => toggleLike(active._id)}
                >
                  <HeartIcon />
                  {label(likeCount(active))}
                </button>

                {/* Delete */}

                <button
                  type="button"
                  className="delete-btn"
                  onClick={() => deletePost(active._id)}
                  disabled={deletingId !== null}
                >
                  {deletingId === active._id
                    ? "Deleting..."
                    : "Delete Post"}
                </button>

                <span className="lightbox-count">
                  {activeIndex + 1} / {visible.length}
                </span>

              </div>

              {/* Navigation */}

              {visible.length > 1 && (
                <div className="lightbox-nav">
                  <button
                    type="button"
                    onClick={() => step(-1)}
                  >
                    ← Previous
                  </button>

                  <button
                    type="button"
                    onClick={() => step(1)}
                  >
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
