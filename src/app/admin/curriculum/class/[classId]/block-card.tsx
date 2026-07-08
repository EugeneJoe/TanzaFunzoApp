import { ArrowDown, ArrowUp, ClipboardList, FileStack, Trash2, Type, Video } from "lucide-react";
import { db } from "@/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { BlockConfigMap, BlockType } from "@/db/schema";
import { removeBlockAction, reorderBlockAction } from "./actions";
import { RichTextEditor } from "./editors/rich-text-editor";
import { VideoEditor } from "./editors/video-editor";
import { ResourceListEditor } from "./editors/resource-list-editor";
import { AssessmentSummary } from "./editors/assessment-summary";

const TYPE_META: Record<BlockType, { label: string; icon: typeof Type }> = {
  rich_text: { label: "Rich text", icon: Type },
  video: { label: "Video", icon: Video },
  resource_list: { label: "Resources", icon: FileStack },
  assessment: { label: "Assessment", icon: ClipboardList },
  link_list: { label: "Links", icon: FileStack },
  case_study: { label: "Case study", icon: ClipboardList },
  transcript: { label: "Transcript", icon: Type },
};

export async function BlockCard({
  block,
  classId,
  pageVersionId,
  index,
  count,
}: {
  block: { id: string; type: BlockType; config: unknown };
  classId: string;
  pageVersionId: string;
  index: number;
  count: number;
}) {
  const meta = TYPE_META[block.type];
  const Icon = meta.icon;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 py-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Icon className="size-4 text-muted-foreground" />
          {meta.label}
        </div>
        <div className="flex items-center gap-1">
          <form action={reorderBlockAction.bind(null, block.id, pageVersionId, classId, "up")}>
            <Button type="submit" size="icon" variant="ghost" disabled={index === 0}>
              <ArrowUp className="size-4" />
            </Button>
          </form>
          <form action={reorderBlockAction.bind(null, block.id, pageVersionId, classId, "down")}>
            <Button type="submit" size="icon" variant="ghost" disabled={index === count - 1}>
              <ArrowDown className="size-4" />
            </Button>
          </form>
          <form action={removeBlockAction.bind(null, block.id, classId)}>
            <Button type="submit" size="icon" variant="ghost">
              <Trash2 className="size-4" />
            </Button>
          </form>
        </div>
      </CardHeader>
      <CardContent>
        <BlockBody block={block} classId={classId} />
      </CardContent>
    </Card>
  );
}

async function BlockBody({
  block,
  classId,
}: {
  block: { id: string; type: BlockType; config: unknown };
  classId: string;
}) {
  switch (block.type) {
    case "rich_text": {
      const config = block.config as BlockConfigMap["rich_text"];
      return <RichTextEditor blockId={block.id} classId={classId} initialDoc={config.doc} />;
    }
    case "video": {
      const config = block.config as BlockConfigMap["video"];
      const asset = config.mediaAssetId
        ? await db.query.mediaAssets.findFirst({ where: (m, { eq }) => eq(m.id, config.mediaAssetId!) })
        : null;
      return (
        <VideoEditor
          blockId={block.id}
          classId={classId}
          initialConfig={config}
          existingAsset={
            asset
              ? { provider: asset.provider as "youtube" | "vimeo", providerRef: asset.providerRef, thumbnailUrl: asset.thumbnailUrl }
              : null
          }
        />
      );
    }
    case "resource_list": {
      const config = block.config as BlockConfigMap["resource_list"];
      const fileIds = config.items.flatMap((item) => ("fileAssetId" in item ? [item.fileAssetId] : []));
      const files =
        fileIds.length === 0
          ? []
          : await db.query.fileAssets.findMany({ where: (f, { inArray: inArrayOp }) => inArrayOp(f.id, fileIds) });
      const fileMeta = Object.fromEntries(
        files.map((f) => [f.id, { filename: f.filename, sizeBytes: f.sizeBytes }])
      );
      return (
        <ResourceListEditor blockId={block.id} classId={classId} items={config.items} fileMeta={fileMeta} />
      );
    }
    case "assessment": {
      const config = block.config as BlockConfigMap["assessment"];
      return <AssessmentSummary assessmentId={config.assessmentId} classId={classId} />;
    }
    default:
      return <p className="text-sm text-muted-foreground">No editor for this block type yet.</p>;
  }
}
