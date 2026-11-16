/** Public uploads for https://www.youtube.com/@ForexTradingConsultants */
const CHANNEL_ID = "UCpioecK2RuuoGHEO_D4uJJg";
const RSS_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;

export const YOUTUBE_CHANNEL_URL = "https://www.youtube.com/@ForexTradingConsultants";
export const LATEST_VIDEO_COUNT = 4;

export type ChannelVideo = {
  id: string;
  title: string;
  /** ISO time from the channel RSS feed. */
  publishedAt?: string;
};

const REFRESH_MS = 10 * 60 * 1000;

let memory: { at: number; videos: ChannelVideo[] } | null = null;

/**
 * The four newest uploads, newest first.
 * YouTube's channel RSS feed is already newest-first and updates when a video is published.
 * A failed refresh keeps the last good list. The route revalidates every 10 minutes.
 */
export async function listChannelVideos(): Promise<ChannelVideo[]> {
  if (memory && Date.now() - memory.at < REFRESH_MS) return memory.videos;
  try {
    const videos = parseRss(await fetchText(RSS_URL)).slice(0, LATEST_VIDEO_COUNT);
    if (videos.length === 0) throw new Error("YouTube channel returned no videos");
    memory = { at: Date.now(), videos };
    return videos;
  } catch {
    if (memory) return memory.videos;
    return [];
  }
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(20000),
    next: { revalidate: 600 },
  });
  if (!response.ok) throw new Error(`YouTube ${response.status} for ${url}`);
  return response.text();
}

function parseRss(xml: string): ChannelVideo[] {
  const videos: ChannelVideo[] = [];
  for (const entry of xml.split("<entry>").slice(1)) {
    const id = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
    const rawTitle = entry.match(/<title>([^<]*)<\/title>/)?.[1];
    const publishedAt = entry.match(/<published>([^<]+)<\/published>/)?.[1];
    if (!id || !rawTitle) continue;
    videos.push({
      id,
      title: decodeXml(rawTitle).replace(/\s+/g, " ").trim(),
      publishedAt,
    });
  }
  return videos;
}

function decodeXml(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
