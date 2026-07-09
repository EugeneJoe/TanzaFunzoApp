import { File as FileIcon, Link as LinkIcon } from "lucide-react";
import { db } from "@/db";
import type { BlockConfigMap } from "@/db/schema";
import { getSignedDownloadUrl } from "@/lib/blob-download-url";
import { Overline } from "@/components/ui/overline";
import { cn } from "@/lib/utils";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function ResourceListContent({ items }: { items: BlockConfigMap["resource_list"]["items"] }) {
  const fileIds = items.flatMap((item) => ("fileAssetId" in item ? [item.fileAssetId] : []));
  const files =
    fileIds.length === 0
      ? []
      : await db.query.fileAssets.findMany({ where: (f, { inArray }) => inArray(f.id, fileIds) });
  const fileById = new Map(files.map((f) => [f.id, f]));

  // The Blob store is private — storageKey holds the pathname, and reading
  // it back needs a freshly-signed URL each render, not a direct link.
  const signedUrlById = new Map(
    await Promise.all(
      files.map(async (f) => [f.id, await getSignedDownloadUrl(f.storageKey)] as const)
    )
  );

  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <Overline className="text-orange">Resources</Overline>
      {items.map((item, index) => {
        const isFile = "fileAssetId" in item;
        const file = isFile ? fileById.get(item.fileAssetId) : undefined;
        const href = isFile ? signedUrlById.get(item.fileAssetId) : item.url;
        return (
          <a
            key={index}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-md border border-border border-l-[3px] border-l-orange bg-card py-2.5 pr-4 pl-3 transition-colors hover:bg-card-alt/50"
          >
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-md",
                isFile ? "bg-card-alt text-navy-900" : "bg-orange-tint text-orange"
              )}
            >
              {isFile ? <FileIcon className="size-4" /> : <LinkIcon className="size-4" />}
            </span>
            <span className="font-heading text-[15px] font-semibold text-navy-900">{item.label}</span>
            <span className="ml-auto shrink-0 text-xs text-text-faint">
              {isFile && file ? `${file.mimeType.split("/")[1]?.toUpperCase() ?? "FILE"} · ${formatSize(file.sizeBytes)}` : "opens in browser"}
            </span>
          </a>
        );
      })}
    </div>
  );
}
