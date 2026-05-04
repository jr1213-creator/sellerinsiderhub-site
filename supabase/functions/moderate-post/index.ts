/*
  Supabase Edge Function: moderate-post

  Optional AI moderation scaffold.
*/

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async (req) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const post = await req.json();
  const text = `${post.title || ""}\n${post.content || ""}`.toLowerCase();

  const spamSignals = [
    "casino",
    "viagra",
    "crypto pump",
    "guaranteed income",
    "click here now",
    "wire transfer",
    "forex",
    "loan approval"
  ];

  const hit = spamSignals.find(signal => text.includes(signal));

  if (hit) {
    return json({
      status: "hold",
      reason: `Possible spam signal: ${hit}`,
      summary: "This post needs review before publishing."
    });
  }

  return json({
    status: "approved",
    reason: "No obvious spam signals detected.",
    summary: summarizeLocally(post.content || "")
  });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function summarizeLocally(content: string) {
  const clean = content.replace(/\s+/g, " ").trim();
  if (!clean) return "This discussion is collecting practical implementation advice from the community.";
  return clean.length > 220 ? `${clean.slice(0, 220)}...` : clean;
}
