"use client";

import { useState } from "react";
import type { ChannelVideo } from "@/lib/youtube-channel";

export function ChannelVideoCard({ video }: { video: ChannelVideo }) {
  const [playing, setPlaying] = useState(false);

  return (
    <li className="overflow-hidden rounded-2xl border border-[#c9a227] bg-black/70">
      <div className="aspect-video w-full bg-black">
        {playing ? (
          <iframe
            className="h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="group relative block h-full w-full"
            aria-label={`Play ${video.title}`}
          >
            <img
              src={`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`}
              alt=""
              className="h-full w-full object-cover"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition group-hover:bg-black/40">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#e0b422] text-black shadow-lg">
                <svg viewBox="0 0 24 24" className="ml-1 h-7 w-7 fill-current" aria-hidden>
                  <path d="M8 5v14l11-7Z" />
                </svg>
              </span>
            </span>
          </button>
        )}
      </div>
      <div className="px-4 py-4 sm:px-5 sm:py-4">
        <h3 className="text-base font-semibold text-[#f3d56a] sm:text-lg">{video.title}</h3>
      </div>
    </li>
  );
}
