import { db } from "@/db";
import type { BlockConfigMap, BlockType } from "@/db/schema";
import { renderRichTextToHTML } from "@/lib/blocks/render-rich-text";
import { VideoPlayer } from "./video-player";
import { ResourceListContent } from "./resource-list-content";
import { AssessmentLauncher } from "./assessment-launcher";

export type RenderableBlock = { id: string; type: BlockType; config: unknown };

/**
 * Renders a page version's blocks in fellow reading order — used by both
 * the admin builder's "Preview as fellow" and the real fellow class page
 * (Stage 3), via the same import (not a copy), per the locked decision that
 * preview must show exactly what fellows will see.
 */
export async function BlockRenderer({
  blocks,
  classId,
  mode,
}: {
  blocks: RenderableBlock[];
  classId: string;
  mode: "preview" | "fellow";
}) {
  if (blocks.length === 0) {
    return (
      <p className="rounded-[10px] border border-dashed border-input p-8 text-center text-sm text-text-faint italic">
        This class doesn&apos;t have any content yet.
      </p>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6">
      {blocks.map((block) => (
        <Block key={block.id} block={block} classId={classId} mode={mode} />
      ))}
    </div>
  );
}

async function Block({ block, classId, mode }: { block: RenderableBlock; classId: string; mode: "preview" | "fellow" }) {
  switch (block.type) {
    case "rich_text": {
      const config = block.config as BlockConfigMap["rich_text"];
      const html = renderRichTextToHTML(config.doc);
      // eslint-disable-next-line react/no-danger -- generated from our own ProseMirror JSON, not untrusted HTML
      return <div className="richtext-content" dangerouslySetInnerHTML={{ __html: html }} />;
    }
    case "video": {
      const config = block.config as BlockConfigMap["video"];
      if (!config.mediaAssetId) return null;
      const asset = await db.query.mediaAssets.findFirst({ where: (m, { eq }) => eq(m.id, config.mediaAssetId!) });
      if (!asset) return null;
      return (
        <div className="flex flex-col gap-2">
          <VideoPlayer
            provider={asset.provider}
            providerRef={asset.providerRef}
            durationS={asset.durationS}
            thumbnailUrl={asset.thumbnailUrl}
          />
          {config.caption && <p className="text-sm text-text-faint italic">{config.caption}</p>}
        </div>
      );
    }
    case "resource_list": {
      const config = block.config as BlockConfigMap["resource_list"];
      return <ResourceListContent items={config.items} />;
    }
    case "assessment": {
      const config = block.config as BlockConfigMap["assessment"];
      return <AssessmentLauncher assessmentId={config.assessmentId} classId={classId} mode={mode} />;
    }
    default:
      return null;
  }
}
