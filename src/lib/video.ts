export type VideoProvider = "youtube" | "vimeo";

/** Extracts a provider + provider-native ID from a pasted YouTube/Vimeo URL. */
export function parseVideoUrl(input: string): { provider: VideoProvider; providerRef: string } | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "");

  if (host === "youtu.be") {
    const id = url.pathname.slice(1);
    return id ? { provider: "youtube", providerRef: id } : null;
  }
  if (host === "youtube.com" || host === "m.youtube.com") {
    if (url.pathname === "/watch") {
      const id = url.searchParams.get("v");
      return id ? { provider: "youtube", providerRef: id } : null;
    }
    const embedMatch = url.pathname.match(/^\/embed\/([^/]+)/);
    if (embedMatch) return { provider: "youtube", providerRef: embedMatch[1] };
    return null;
  }
  if (host === "vimeo.com") {
    const match = url.pathname.match(/^\/(\d+)/);
    return match ? { provider: "vimeo", providerRef: match[1] } : null;
  }
  if (host === "player.vimeo.com") {
    const match = url.pathname.match(/^\/video\/(\d+)/);
    return match ? { provider: "vimeo", providerRef: match[1] } : null;
  }
  return null;
}

/**
 * YouTube serves thumbnails from a fixed, unauthenticated URL keyed purely
 * by video ID — no API call needed. hqdefault always exists (unlike
 * maxresdefault, which 404s unless the uploader provided a high-res image).
 */
function youtubeThumbnailUrl(providerRef: string): string {
  return `https://img.youtube.com/vi/${providerRef}/hqdefault.jpg`;
}

/**
 * Vimeo has no equivalent fixed pattern — its thumbnail URLs are keyed by
 * an opaque hash, not the video ID, so retrieving one means a real network
 * call to their (unauthenticated, public) oEmbed endpoint. Failures degrade
 * to no thumbnail rather than blocking the save — a missing poster image
 * isn't worth failing the whole video block over.
 */
async function fetchVimeoThumbnail(providerRef: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(`https://vimeo.com/${providerRef}`)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { thumbnail_url?: string };
    return data.thumbnail_url ?? null;
  } catch {
    return null;
  }
}

/** Resolves a poster thumbnail URL for a video, provider-specific under the hood. */
export async function resolveThumbnailUrl(
  provider: VideoProvider,
  providerRef: string
): Promise<string | null> {
  return provider === "youtube" ? youtubeThumbnailUrl(providerRef) : fetchVimeoThumbnail(providerRef);
}
