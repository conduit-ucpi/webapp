import { useState } from 'react';
import { VIDEO_ID } from './content';
import { lt } from './theme';

interface Props {
  className?: string;
}

/**
 * The walkthrough video as a small click-to-play window. Shows YouTube's thumbnail until
 * clicked, then swaps in the player (no-cookie domain, autoplaying), so nothing from
 * YouTube loads for visitors who never press play.
 */
export default function VideoEmbed({ className = '' }: Props) {
  const [playing, setPlaying] = useState(false);
  return (
    <div className={`relative aspect-video w-full max-w-sm overflow-hidden border ${lt.border} ${lt.radius} bg-black ${className}`}>
      {playing ? (
        <iframe
          className="absolute inset-0 h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${VIDEO_ID}?autoplay=1&rel=0`}
          title="Walkthrough video"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      ) : (
        <button type="button" onClick={() => setPlaying(true)} className="group absolute inset-0 h-full w-full" aria-label="Play the walkthrough video">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`https://i.ytimg.com/vi/${VIDEO_ID}/hqdefault.jpg`} alt="" loading="lazy" className="h-full w-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
          <span className="absolute inset-0 grid place-items-center">
            <span className="grid h-12 w-16 place-items-center rounded-xl bg-[#ff0000] shadow-lg group-hover:scale-105 transition-transform">
              <svg viewBox="0 0 24 24" className="h-6 w-6 fill-white" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
            </span>
          </span>
        </button>
      )}
    </div>
  );
}
