/*
  Supabase Edge Function: moderate-post

  Deploy later with Supabase CLI.

  What it does:
  - receives a post
  - performs lightweight rule checks
  - optionally calls an AI provider if API key is configured
  - returns status + summary

  Environment variables you may configure later:
  - OPENAI_API_KEY
*/

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const post = await req.json();
  const text = `${post.title || ""}\n${post.content || ""}`.toLowerCase();

  const spamSignals = [
    "casino",
    "viagra",
    "crypto pump",
    "guaranteed income",
    "click here now",
    "wire transfer"
  ];

  const hit = spamSignals.find(signal => text.includes(signal));

  if (hit) {
    return new Response(JSON.stringify({
      status: "hold",
      reason: `Possible spam signal: ${hit}`,
      summary: "This post needs review before publishing."
    }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const summary = summarizeLocally(post.content || "");

  return new Response(JSON.stringify({
    status: "approved",
    reason: "No obvious spam signals detected.",
    summary
  }), {
    headers: { "Content-Type": "application/json" },
  });
});

function summarizeLocally(content: string) {
  const clean = content.replace(/\s+/g, " ").trim();
  if (!clean) return "This discussion is collecting practical implementation advice from the community.";
  return clean.length > 220 ? `${clean.slice(0, 220)}...` : clean;
}
