"use client";

import { useState } from "react";
import Image from "next/image";
import { PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";

function embedUrl(provider: string, providerRef: string): string {
  return provider === "vimeo"
    ? `https://player.vimeo.com/video/${providerRef}?autoplay=1`
    : `https://www.youtube.com/embed/${providerRef}?autoplay=1`;
}

export function VideoPlayer({
  provider,
  providerRef,
  durationS,
  thumbnailUrl,
}: {
  provider: string;
  providerRef: string;
  durationS?: number | null;
  thumbnailUrl?: string | null;
}) {
  const [loaded, setLoaded] = useState(false);

  if (loaded) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
        <iframe
          src={embedUrl(provider, providerRef)}
          className="size-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setLoaded(true)}
      className="group relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg bg-muted"
    >
      {thumbnailUrl && (
        <>
          <Image
            src={thumbnailUrl}
            alt=""
            fill
            sizes="(max-width: 560px) 100vw, 560px"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-black/35 transition-colors group-hover:bg-black/45" />
        </>
      )}
      <PlayCircle
        className={cn(
          "relative size-14 transition-transform group-hover:scale-105",
          thumbnailUrl ? "text-white drop-shadow-md" : "text-foreground/70"
        )}
      />
      <span
        className={cn(
          "absolute bottom-3 left-3 text-sm",
          thumbnailUrl ? "text-white drop-shadow" : "text-muted-foreground"
        )}
      >
        Tap to stream · adapts to your connection
      </span>
      {durationS != null && (
        <span className="absolute right-3 top-3 rounded bg-background/80 px-2 py-0.5 text-xs">
          {Math.floor(durationS / 60)}:{String(durationS % 60).padStart(2, "0")}
        </span>
      )}
    </button>
  );
}
