import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pageVersions } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { BlockCard } from "./block-card";
import { addBlockAction } from "./actions";
import { restoreVersionAction } from "./publish-actions";
import { PublishButton } from "./publish-button";

export default async function ClassBuilderPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;

  const cls = await db.query.classes.findFirst({
    where: (c, { eq }) => eq(c.id, classId),
    with: {
      module: true,
      page: { with: { draftVersion: { with: { blocks: true } }, publishedVersion: true } },
    },
  });
  if (!cls || !cls.page?.draftVersion) notFound();

  const draft = cls.page.draftVersion;
  const blocks = [...draft.blocks].sort((a, b) => a.position - b.position);
  const allVersions = await db.query.pageVersions.findMany({
    where: eq(pageVersions.pageId, cls.page.id),
    orderBy: (v, { desc }) => [desc(v.versionNo)],
  });

  const lastSaved =
    blocks.length > 0
      ? new Date(Math.max(...blocks.map((b) => b.updatedAt.getTime())))
      : draft.createdAt;

  return (
    <div className="flex flex-1 gap-6 p-6">
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              {cls.module.title} / {cls.title}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <h1 className="text-xl font-semibold">{cls.title}</h1>
              <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">
                Draft v{draft.versionNo}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">Saved {lastSaved.toLocaleString()}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="secondary">
              <Link href={`/admin/curriculum/class/${classId}/preview`}>Preview as fellow</Link>
            </Button>
            <PublishButton classId={classId} />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {blocks.length === 0 && (
            <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground italic">
              No blocks yet — add one below to start building this class.
            </p>
          )}
          {blocks.map((block, index) => (
            <BlockCard
              key={block.id}
              block={block}
              classId={classId}
              pageVersionId={draft.id}
              index={index}
              count={blocks.length}
            />
          ))}
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-dashed p-3">
          <span className="text-sm text-muted-foreground">Add block:</span>
          <form action={addBlockAction.bind(null, classId, "rich_text")}>
            <SubmitButton size="sm" variant="outline" pendingText="Adding…">
              Rich text
            </SubmitButton>
          </form>
          <form action={addBlockAction.bind(null, classId, "video")}>
            <SubmitButton size="sm" variant="outline" pendingText="Adding…">
              Video
            </SubmitButton>
          </form>
          <form action={addBlockAction.bind(null, classId, "resource_list")}>
            <SubmitButton size="sm" variant="outline" pendingText="Adding…">
              Resources
            </SubmitButton>
          </form>
          <form action={addBlockAction.bind(null, classId, "assessment")}>
            <SubmitButton size="sm" variant="outline" pendingText="Adding…">
              Assessment
            </SubmitButton>
          </form>
        </div>
      </div>

      <div className="flex w-[190px] shrink-0 flex-col gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Page</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-xs text-muted-foreground">
            <p>Status: {cls.page.publishedVersionId ? "Published" : "Never published"}</p>
            {cls.page.publishedVersion && (
              <p>
                Published v{cls.page.publishedVersion.versionNo}
                {cls.page.publishedVersion.publishedAt &&
                  ` · ${new Date(cls.page.publishedVersion.publishedAt).toLocaleDateString()}`}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Versions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-xs">
            {allVersions.map((v) => (
              <div key={v.id} className="flex items-center justify-between">
                <span>
                  v{v.versionNo} {v.publishedAt ? "" : "(editing)"}
                </span>
                {v.publishedAt ? (
                  <form action={restoreVersionAction.bind(null, classId, v.id)}>
                    <SubmitButton size="sm" variant="ghost" className="h-6 px-2 text-xs" pendingText="Restoring…">
                      Restore
                    </SubmitButton>
                  </form>
                ) : (
                  <span className="text-muted-foreground">editing</span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
