(() => {
  const config = window.SIH_COMMUNITY_CONFIG;

  if (!config || !config.SUPABASE_URL || !config.SUPABASE_KEY) {
    showStatus("Missing Supabase config. Check /assets/js/community-config.js");
    return;
  }

  const client = supabase.createClient(config.SUPABASE_URL, config.SUPABASE_KEY);

  const state = {
    posts: [],
    commentsByPost: {},
    activeCategory: "All",
    search: "",
    sort: "newest"
  };

  const categories = [
    "All",
    "AI Implementation",
    "Etsy Seller AI",
    "AI Automation",
    "AI Marketing",
    "Small Business Systems"
  ];

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    bindModal();
    bindToolbar();
    renderCategoryFilters();
    await loadPosts();
  }

  function bindModal() {
    const modal = document.getElementById("postModal");
    const openBtn = document.getElementById("openPostForm");
    const closeBtn = document.getElementById("closePostForm");
    const form = document.getElementById("newPostForm");

    if (openBtn) openBtn.addEventListener("click", () => modal.classList.add("open"));
    if (closeBtn) closeBtn.addEventListener("click", () => modal.classList.remove("open"));

    if (modal) {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) modal.classList.remove("open");
      });
    }

    if (form) form.addEventListener("submit", handleCreatePost);
  }

  function bindToolbar() {
    const search = document.getElementById("searchInput");
    const sort = document.getElementById("sortSelect");

    if (search) {
      search.addEventListener("input", (e) => {
        state.search = e.target.value.toLowerCase().trim();
        renderPosts();
      });
    }

    if (sort) {
      sort.addEventListener("change", (e) => {
        state.sort = e.target.value;
        renderPosts();
      });
    }
  }

  function renderCategoryFilters() {
    const el = document.getElementById("categoryFilters");
    if (!el) return;

    el.innerHTML = categories.map(category => `
      <button class="filter-pill ${category === state.activeCategory ? "active" : ""}" data-category="${escapeHtml(category)}">
        <span>${escapeHtml(category)}</span>
      </button>
    `).join("");

    el.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", () => {
        state.activeCategory = btn.dataset.category;
        renderCategoryFilters();
        renderPosts();
      });
    });
  }

  async function loadPosts() {
    showStatus("Loading community discussions...");

    const { data: posts, error } = await client
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      showStatus("Could not load posts. Check Supabase URL, key, and table permissions.");
      return;
    }

    state.posts = posts || [];

    const commentsByPost = {};
    for (const post of state.posts) {
      const { data: comments, error: commentsError } = await client
        .from("comments")
        .select("*")
        .eq("post_id", post.id)
        .order("created_at", { ascending: true });

      if (!commentsError) commentsByPost[post.id] = comments || [];
    }

    state.commentsByPost = commentsByPost;
    showStatus("");
    renderPosts();
  }

  function renderPosts() {
    const container = document.getElementById("posts");
    if (!container) return;

    let posts = [...state.posts];

    if (state.activeCategory !== "All") {
      posts = posts.filter(p => p.category === state.activeCategory);
    }

    if (state.search) {
      posts = posts.filter(p => {
        const searchable = `${p.title || ""} ${p.content || ""} ${p.category || ""} ${p.ai_summary || ""}`.toLowerCase();
        return searchable.includes(state.search);
      });
    }

    if (state.sort === "popular") {
      posts.sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));
    }

    if (state.sort === "comments") {
      posts.sort((a, b) => (state.commentsByPost[b.id]?.length || 0) - (state.commentsByPost[a.id]?.length || 0));
    }

    if (!posts.length) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No discussions found yet.</h3>
          <p>Try another search or start the first discussion in this category.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = posts.map(post => renderPost(post)).join("");

    container.querySelectorAll(".comment-form").forEach(form => {
      form.addEventListener("submit", handleCreateComment);
    });
  }

  function renderPost(post) {
    const comments = state.commentsByPost[post.id] || [];
    const summary = post.ai_summary || generateLocalSummary(post.content);

    return `
      <article class="post-card" data-post-id="${post.id}">
        <div class="post-meta">
          <span class="category-tag">${escapeHtml(post.category || "Community")}</span>
          <span>Posted by ${escapeHtml(post.author_name || "Community Member")}</span>
          <span>•</span>
          <span>${formatDate(post.created_at)}</span>
        </div>

        <h2>${escapeHtml(post.title)}</h2>

        <div class="post-content">
          ${formatText(post.content)}
        </div>

        <div class="ai-summary">
          <strong>AI implementation summary</strong>
          <span>${escapeHtml(summary)}</span>
        </div>

        <div class="comment-list">
          ${comments.map(renderComment).join("")}
        </div>

        <form class="comment-form" data-post-id="${post.id}">
          <input name="author_name" placeholder="Your name">
          <textarea name="content" rows="3" required placeholder="Add an implementation suggestion, tool stack, or troubleshooting idea..."></textarea>
          <button class="btn secondary" type="submit">Reply</button>
        </form>
      </article>
    `;
  }

  function renderComment(comment) {
    return `
      <div class="comment">
        <strong>${escapeHtml(comment.author_name || "Community Member")}</strong>
        <div>${formatText(comment.content)}</div>
      </div>
    `;
  }

  async function handleCreatePost(e) {
    e.preventDefault();

    const form = e.currentTarget;
    const modal = document.getElementById("postModal");
    const formData = new FormData(form);

    const post = {
      title: formData.get("title").trim(),
      content: formData.get("content").trim(),
      category: formData.get("category"),
      author_name: formData.get("author_name").trim() || "Community Member",
      ai_summary: generateLocalSummary(formData.get("content").trim()),
      status: "published"
    };

    if (!post.title || !post.content) return;

    showStatus("Publishing discussion...");

    if (config.USE_AI_MODERATION && config.AI_MODERATION_ENDPOINT) {
      try {
        const mod = await moderatePost(post);
        if (mod.status === "hold") {
          post.status = "pending";
          post.ai_summary = mod.summary || post.ai_summary;
        } else if (mod.summary) {
          post.ai_summary = mod.summary;
        }
      } catch (err) {
        console.warn("AI moderation skipped:", err);
      }
    }

    const { error } = await client.from("posts").insert(post);

    if (error) {
      console.error(error);
      showStatus("Post failed. Check table columns and permissions.");
      return;
    }

    form.reset();
    if (modal) modal.classList.remove("open");
    await loadPosts();
    showStatus("Discussion published.");
    setTimeout(() => showStatus(""), 2500);
  }

  async function handleCreateComment(e) {
    e.preventDefault();

    const form = e.currentTarget;
    const postId = form.dataset.postId;
    const formData = new FormData(form);

    const comment = {
      post_id: Number(postId),
      content: formData.get("content").trim(),
      author_name: formData.get("author_name").trim() || "Community Member"
    };

    if (!comment.content) return;

    const { error } = await client.from("comments").insert(comment);

    if (error) {
      console.error(error);
      showStatus("Reply failed. Check comment table permissions.");
      return;
    }

    form.reset();
    await loadPosts();
  }

  async function moderatePost(post) {
    const response = await fetch(config.AI_MODERATION_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.SUPABASE_KEY}`
      },
      body: JSON.stringify(post)
    });

    if (!response.ok) throw new Error("Moderation endpoint failed");
    return response.json();
  }

  function generateLocalSummary(text) {
    const clean = (text || "").replace(/\s+/g, " ").trim();
    if (!clean) return "This discussion is collecting practical implementation advice from the community.";
    return clean.length > 190 ? `${clean.slice(0, 190)}...` : clean;
  }

  function formatDate(value) {
    if (!value) return "Just now";
    return new Date(value).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  }

  function formatText(value) {
    return escapeHtml(value || "").replace(/\n/g, "<br>");
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function showStatus(message) {
    const el = document.getElementById("statusMessage");
    if (el) el.textContent = message || "";
  }
})();
