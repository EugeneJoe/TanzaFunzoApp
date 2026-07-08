"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { PlayCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateVideoAction } from "../actions";
import type { BlockConfigMap } from "@/db/schema";
import { cn } from "@/lib/utils";

const AUTOSAVE_DELAY_MS = 800;

function urlFor(provider: "youtube" | "vimeo", providerRef: string): string {
  return provider === "youtube"
    ? `https://www.youtube.com/watch?v=${providerRef}`
    : `https://vimeo.com/${providerRef}`;
}

export function VideoEditor({
  blockId,
  classId,
  initialConfig,
  existingAsset,
}: {
  blockId: string;
  classId: string;
  initialConfig: BlockConfigMap["video"];
  existingAsset: { provider: "youtube" | "vimeo"; providerRef: string; thumbnailUrl: string | null } | null;
}) {
  const [provider, setProvider] = useState<"youtube" | "vimeo">(existingAsset?.provider ?? "youtube");
  const [url, setUrl] = useState(existingAsset ? urlFor(existingAsset.provider, existingAsset.providerRef) : "");
  const [caption, setCaption] = useState(initialConfig.caption ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    initialConfig.mediaAssetId ? "saved" : "idle"
  );
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRun = useRef(true);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    if (!url.trim()) return;

    setStatus("saving");
    setError(null);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      try {
        await updateVideoAction(blockId, classId, provider, url, caption);
        setStatus("saved");
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Couldn't save that video.");
      }
    }, AUTOSAVE_DELAY_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, url, caption]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative flex aspect-video w-full max-w-sm items-center justify-center overflow-hidden rounded-md bg-muted">
        {existingAsset?.thumbnailUrl && (
          <Image
            src={existingAsset.thumbnailUrl}
            alt=""
            fill
            sizes="384px"
            className="object-cover"
          />
        )}
        <PlayCircle
          className={cn(
            "relative size-10",
            existingAsset?.thumbnailUrl ? "text-white drop-shadow-md" : "text-muted-foreground"
          )}
        />
      </div>
      <div className="flex gap-2">
        <div className="flex flex-col gap-1.5">
          <Label>Provider</Label>
          <Select value={provider} onValueChange={(v) => setProvider(v as "youtube" | "vimeo")}>
            <SelectTrigger size="sm" className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="youtube">YouTube</SelectItem>
              <SelectItem value="vimeo">Vimeo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <Label>Video URL</Label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={provider === "youtube" ? "https://youtube.com/watch?v=..." : "https://vimeo.com/..."}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Caption</Label>
        <Input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Optional caption" />
      </div>
      <p className="text-xs text-muted-foreground">
        {status === "saving" && "Saving…"}
        {status === "saved" && "Saved"}
        {status === "error" && <span className="text-destructive">{error}</span>}
      </p>
    </div>
  );
}
