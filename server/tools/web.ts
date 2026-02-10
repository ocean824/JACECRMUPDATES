import type { ToolContext } from "./types";

type WebFetchArgs = { url: string; max_chars?: number };
export async function webFetch(args: WebFetchArgs, _ctx: ToolContext) {
  const url = args?.url;
  if (!url || typeof url !== "string") throw new Error("webFetch: url is required");

  if (!/^https?:\/\//i.test(url)) throw new Error("webFetch: only http/https URLs are allowed");

  const blockedPatterns = [
    /localhost/i,
    /127\.\d+\.\d+\.\d+/,
    /0\.0\.0\.0/,
    /\[::1\]/,
    /10\.\d+\.\d+\.\d+/,
    /172\.(1[6-9]|2\d|3[01])\.\d+\.\d+/,
    /192\.168\.\d+\.\d+/,
    /169\.254\.\d+\.\d+/,
    /\[fd[0-9a-f]{2}:/i,
    /\[fe80:/i,
    /\.internal\b/i,
    /\.local\b/i,
  ];
  for (const pat of blockedPatterns) {
    if (pat.test(url)) throw new Error("webFetch: blocked host");
  }

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 10_000);

  const res = await fetch(url, {
    method: "GET",
    redirect: "manual",
    signal: controller.signal,
    headers: { "User-Agent": "JACE-Agent/1.0" },
  }).finally(() => clearTimeout(t));

  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get("location") || "";
    for (const pat of blockedPatterns) {
      if (pat.test(location)) throw new Error("webFetch: redirect to blocked host");
    }
    const redirectRes = await fetch(location, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: { "User-Agent": "JACE-Agent/1.0" },
    });
    if (!redirectRes.ok) throw new Error(`webFetch: HTTP ${redirectRes.status}`);
    const text = await redirectRes.text();
    const maxChars = Math.min(Math.max(args.max_chars ?? 20_000, 1_000), 60_000);
    return { ok: true, url, status: redirectRes.status, text: text.slice(0, maxChars) };
  }

  if (!res.ok) throw new Error(`webFetch: HTTP ${res.status}`);

  const text = await res.text();
  const maxChars = Math.min(Math.max(args.max_chars ?? 20_000, 1_000), 60_000);
  return { ok: true, url, status: res.status, text: text.slice(0, maxChars) };
}

type WebSearchArgs = { q: string; max_results?: number };
export async function webSearch(args: WebSearchArgs, _ctx: ToolContext) {
  const q = args?.q;
  if (!q || typeof q !== "string") throw new Error("webSearch: q is required");

  // DuckDuckGo lite HTML is reasonably stable for basic parsing (best-effort).
  const max = Math.min(Math.max(args.max_results ?? 5, 1), 10);
  const searchUrl = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(q)}`;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 10_000);

  const res = await fetch(searchUrl, {
    method: "GET",
    signal: controller.signal,
    headers: { "User-Agent": "JACE-Agent/1.0" },
  }).finally(() => clearTimeout(t));

  if (!res.ok) throw new Error(`webSearch: HTTP ${res.status}`);

  const html = await res.text();
  const results: { title: string; url: string }[] = [];

  // Very light parsing: look for result links
  const linkRe = /<a[^>]+class="result-link"[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html)) && results.length < max) {
    const url = m[1];
    const title = m[2].replace(/<[^>]*>/g, "").trim();
    if (url && title) results.push({ title, url });
  }

  return { ok: true, q, results, source: searchUrl };
}
