"use client";

import { useRef, useState, useTransition } from "react";
import { upload } from "@vercel/blob/client";
import { File as FileIcon, Link as LinkIcon, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BlockConfigMap } from "@/db/schema";
import {
  addResourceLinkAction,
  recordUploadedFileAction,
  removeResourceItemAction,
} from "../actions";

// The browser uploads straight to Blob storage (via /api/blob-upload, which
// mints a short-lived token) rather than through a server action — that's
// what lets this exceed Vercel's ~4.5MB server-upload request body cap.
// This mirrors the real limit set server-side in /api/blob-upload/route.ts;
// it's checked here too so an oversized file fails instantly instead of
// after a partial upload.
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ResourceListEditor({
  blockId,
  classId,
  items,
  fileMeta,
}: {
  blockId: string;
  classId: string;
  items: BlockConfigMap["resource_list"]["items"];
  /** filename/size for any file-backed items, keyed by fileAssetId (resolved server-side). */
  fileMeta: Record<string, { filename: string; sizeBytes: number }>;
}) {
  const [isRemoving, startRemoving] = useTransition();

  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [isAddingLink, startAddingLink] = useTransition();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileLabel, setFileLabel] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const [isUploading, startUploading] = useTransition();
  const [uploadPct, setUploadPct] = useState(0);

  function handleFileChosen(file: File | null) {
    setSelectedFile(file);
    setFileError(null);
    // Default the label to the filename so there's less to type — admins
    // can still overwrite it before adding.
    if (file && !fileLabel.trim()) {
      setFileLabel(file.name.replace(/\.[^./]+$/, ""));
    }
  }

  function handleAddLink() {
    setLinkError(null);
    startAddingLink(async () => {
      try {
        await addResourceLinkAction(blockId, classId, linkUrl, linkLabel);
        setLinkUrl("");
        setLinkLabel("");
      } catch (err) {
        setLinkError(err instanceof Error ? err.message : "Couldn't add that link.");
      }
    });
  }

  function handleUploadFile() {
    if (!selectedFile) {
      setFileError("Choose a file first.");
      return;
    }
    if (!fileLabel.trim()) {
      setFileError("Give it a label.");
      return;
    }
    if (selectedFile.size > MAX_UPLOAD_BYTES) {
      setFileError(`That file is ${formatSize(selectedFile.size)} — the limit is ${formatSize(MAX_UPLOAD_BYTES)}.`);
      return;
    }
    setFileError(null);
    const file = selectedFile;
    const label = fileLabel;
    startUploading(async () => {
      try {
        setUploadPct(0);
        const blob = await upload(file.name, file, {
          access: "private",
          handleUploadUrl: "/api/blob-upload",
          onUploadProgress: ({ percentage }) => setUploadPct(percentage),
        });
        await recordUploadedFileAction(blockId, classId, {
          pathname: blob.pathname,
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          label,
        });
        setFileLabel("");
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } catch (err) {
        setFileError(err instanceof Error ? err.message : "Upload failed.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {items.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {items.map((item, index) => {
            const isFile = "fileAssetId" in item;
            const meta = isFile ? fileMeta[item.fileAssetId] : undefined;
            return (
              <div
                key={index}
                className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
              >
                {isFile ? <FileIcon className="size-4 shrink-0" /> : <LinkIcon className="size-4 shrink-0" />}
                <span className="font-medium">{item.label}</span>
                <span className="text-muted-foreground">
                  {isFile && meta ? `${meta.filename} · ${formatSize(meta.sizeBytes)}` : "opens in browser"}
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="ml-auto size-6"
                  disabled={isRemoving}
                  onClick={() => startRemoving(() => removeResourceItemAction(blockId, classId, index))}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-2 border-t pt-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">Link URL</label>
            <Input
              value={linkUrl}
              onChange={(e) => {
                setLinkUrl(e.target.value);
                setLinkError(null);
              }}
              placeholder="https://…"
              className="w-48"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">Label</label>
            <Input
              value={linkLabel}
              onChange={(e) => {
                setLinkLabel(e.target.value);
                setLinkError(null);
              }}
              placeholder="PO-RALG structure overview"
              className="w-48"
            />
          </div>
          <Button type="button" size="sm" variant="outline" disabled={isAddingLink} onClick={handleAddLink}>
            {isAddingLink ? "Adding…" : "Add link"}
          </Button>
        </div>
        {linkError && <p className="text-sm text-destructive">{linkError}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">File</label>
            <input
              ref={fileInputRef}
              type="file"
              className="sr-only"
              onChange={(e) => handleFileChosen(e.target.files?.[0] ?? null)}
            />
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="size-3.5" />
                Choose file
              </Button>
              <span className="max-w-40 truncate text-sm text-muted-foreground">
                {selectedFile ? `${selectedFile.name} · ${formatSize(selectedFile.size)}` : "No file chosen"}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">Label</label>
            <Input
              value={fileLabel}
              onChange={(e) => {
                setFileLabel(e.target.value);
                setFileError(null);
              }}
              placeholder="Stakeholder mapping template"
              className="w-48"
            />
          </div>
          <Button type="button" size="sm" variant="outline" disabled={isUploading} onClick={handleUploadFile}>
            {isUploading ? `Uploading… ${uploadPct}%` : "Add resource"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Up to {formatSize(MAX_UPLOAD_BYTES)} per file.</p>
        {fileError && <p className="text-sm text-destructive">{fileError}</p>}
      </div>
    </div>
  );
}
