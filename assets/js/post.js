(() => {
  const SIH = window.SIH;
  let client;

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    try { client = SIH.getClient(); } catch (err) { showStatus("Missing Supabase config. Check /assets/js/community-config.js"); return; }
    await loadPost();
  }

  async function loadPost() {
    const id = Number(SIH.getQueryParam("id"));
    if (!id) { showStatus("No discussion ID was provided."); return; }

    const { data: post, error } = await client.from("posts").select("*").eq("id", id).single();
    if (error || !post) { console.error(error); showStatus("Discussion not found."); return; }

    document.title = `${post.title} | Seller Insider Hub Community`;
    const metaDescription = document.querySelector("meta[name='description']");
    if (metaDescription) metaDescription.setAttribute("content", post.seo_description || SIH.generateLocalSummary(post.content));

    const { data: comments } = await client.from("comments").select("*").eq("post_id", post.id).order("created_at", { ascending: true });
    renderPost(post, comments || []);
    await renderRelated(post);
  }

  function renderPost(post, comments) {
    const el = document.getElementById("postDetail");
    const summary = post.ai_summary || SIH.generateLocalSummary(post.content);
    const tools = SIH.extractTools(`${post.content || ""} ${post.current_tools || ""}`);

    el.innerHTML = `<div class="post-meta">
        <span class="category-tag">${SIH.escapeHtml(post.category || "Community")}</span>
        ${post.business_outcome ? `<span class="outcome-tag">${SIH.escapeHtml(post.business_outcome)}</span>` : ""}
        <span>Posted by ${SIH.escapeHtml(post.author_name || "Community Member")}</span><span>•</span><span>${SIH.formatDate(post.created_at)}</span>
      </div>
      <h1>${SIH.escapeHtml(post.title)}</h1>
      <div class="post-content">${SIH.formatText(post.content)}</div>
      <div class="ai-summary"><strong>AI implementation summary</strong><span>${SIH.escapeHtml(summary)}</span></div>
      ${tools.length ? `<div class="tool-stack-box"><strong>Tools mentioned</strong><div class="tool-list">${tools.map(tool => `<span class="tool-pill">${SIH.escapeHtml(tool)}</span>`).join("")}</div></div>` : ""}
      <section class="comment-list">
        <h2>Replies</h2>
        ${comments.length ? comments.map(renderComment).join("") : "<p>No replies yet. Be the first to add an implementation idea.</p>"}
      </section>
      <form class="comment-form" id="commentForm" data-post-id="${post.id}">
        <input name="author_name" placeholder="Your name">
        <textarea name="content" rows="4" required placeholder="Add an implementation suggestion, tool stack, or troubleshooting idea..."></textarea>
        <button class="btn secondary" type="submit">Reply</button>
      </form>`;

    document.getElementById("commentForm").addEventListener("submit", handleCreateComment);
  }

  function renderComment(comment) {
    return `<div class="comment"><strong>${SIH.escapeHtml(comment.author_name || "Community Member")}</strong><div>${SIH.formatText(comment.content)}</div></div>`;
  }

  async function renderRelated(post) {
    const el = document.getElementById("relatedPosts");
    const { data: related } = await client.from("posts").select("*").eq("status", "published").eq("category", post.category).neq("id", post.id).limit(4);

    if (!related || !related.length) {
      el.innerHTML = `<div class="empty-state"><p>Related discussions will appear here as this category grows.</p></div>`;
      return;
    }

    el.innerHTML = related.map(item => `<a class="related-card" href="/community/post/?id=${item.id}"><h3>${SIH.escapeHtml(item.title)}</h3><p>${SIH.escapeHtml(item.ai_summary || SIH.generateLocalSummary(item.content))}</p></a>`).join("");
  }

  async function handleCreateComment(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const comment = {
      post_id: Number(form.dataset.postId),
      content: formData.get("content").trim(),
      author_name: formData.get("author_name").trim() || "Community Member"
    };
    if (!comment.content) return;
    const { error } = await client.from("comments").insert(comment);
    if (error) { console.error(error); showStatus("Reply failed. Check permissions."); return; }
    window.location.reload();
  }

  function showStatus(message) {
    const el = document.getElementById("statusMessage");
    if (el) el.textContent = message || "";
  }
})();
