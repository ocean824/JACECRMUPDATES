import type { ToolContext } from "./types";
import dns from "dns/promises";
import net from "net";

function isPrivateIP(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    if (parts[0] === 127) return true;
    if (parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 0) return true;
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
    if (parts[0] >= 224) return true;
  }
  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    if (normalized === "::1") return true;
    if (normalized.startsWith("fe80:")) return true;
    if (normalized.startsWith("fd")) return true;
    if (normalized.startsWith("fc")) return true;
    if (normalized === "::") return true;
    if (normalized.startsWith("::ffff:")) {
      const v4 = normalized.slice(7);
      if (net.isIPv4(v4)) return isPrivateIP(v4);
    }
  }
  return false;
}

async function validateHost(hostname: string): Promise<void> {
  if (net.isIP(hostname)) {
    if (isPrivateIP(hostname)) throw new Error("webFetch: blocked host (private IP)");
    return;
  }
  const blockedNames = [/localhost/i, /\.internal$/i, /\.local$/i];
  for (const pat of blockedNames) {
    if (pat.test(hostname)) throw new Error("webFetch: blocked host");
  }
  try {
    const addresses = await dns.resolve4(hostname).catch(() => [] as string[]);
    const addresses6 = await dns.resolve6(hostname).catch(() => [] as string[]);
    const allAddrs = [...addresses, ...addresses6];
    if (allAddrs.length === 0) throw new Error("webFetch: could not resolve hostname");
    for (const addr of allAddrs) {
      if (isPrivateIP(addr)) {
        throw new Error("webFetch: blocked host (resolves to private IP)");
      }
    }
  } catch (e: any) {
    if (e.message.includes("webFetch:")) throw e;
    throw new Error("webFetch: DNS resolution failed");
  }
}

type WebFetchArgs = { url: string; max_chars?: number };
export async function webFetch(args: WebFetchArgs, _ctx: ToolContext) {
  const url = args?.url;
  if (!url || typeof url !== "string") throw new Error("webFetch: url is required");

  if (!/^https?:\/\//i.test(url)) throw new Error("webFetch: only http/https URLs are allowed");

  const parsed = new URL(url);
  await validateHost(parsed.hostname);

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
    if (!location) throw new Error("webFetch: redirect with no location header");
    const redirectParsed = new URL(location, url);
    if (!/^https?:$/i.test(redirectParsed.protocol)) throw new Error("webFetch: only http/https URLs are allowed");
    await validateHost(redirectParsed.hostname);
    const redirectRes = await fetch(redirectParsed.href, {
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

  const linkRe = /<a[^>]+class="result-link"[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html)) && results.length < max) {
    const url = m[1];
    const title = m[2].replace(/<[^>]*>/g, "").trim();
    if (url && title) results.push({ title, url });
  }

  return { ok: true, q, results, source: searchUrl };
}
