import { ChannelVideoCard } from "@/components/ChannelVideoCard";
import { listChannelVideos, YOUTUBE_CHANNEL_URL } from "@/lib/youtube-channel";

export async function InformationResources() {
  const videos = await listChannelVideos();

  return (
    <div className="mx-auto max-w-5xl px-4 pb-8 sm:px-6 sm:pb-16">
      <div className="mx-auto mt-8 max-w-3xl text-center">
        <h2 className="text-xl font-semibold text-[#e0b422] sm:text-2xl">Information resources</h2>
        <p className="mt-3 text-sm leading-relaxed text-[#d4b84a]">
          The four latest videos from our YouTube channel. A new upload replaces the oldest one here.
        </p>
        <a
          href={YOUTUBE_CHANNEL_URL}
          className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-[#FFD700] underline underline-offset-4 hover:text-white"
          target="_blank"
          rel="noopener noreferrer"
        >
          @ForexTradingConsultants
        </a>
      </div>

      {videos.length === 0 ? (
        <p className="mx-auto mt-10 max-w-xl text-center text-sm text-[#d4b84a]">
          The latest videos could not be loaded just now. Open the channel to watch them.
        </p>
      ) : (
        <ul className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
          {videos.map((video) => (
            <ChannelVideoCard key={video.id} video={video} />
          ))}
        </ul>
      )}
    </div>
  );
}
