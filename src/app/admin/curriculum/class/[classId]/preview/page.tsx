import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { BlockRenderer } from "@/components/blocks/block-renderer";
import { QnaSection } from "@/components/qna/qna-section";
import { getSession } from "@/lib/session";

export default async function PreviewPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;

  const cls = await db.query.classes.findFirst({
    where: (c, { eq }) => eq(c.id, classId),
    with: { page: { with: { draftVersion: { with: { blocks: true } } } } },
  });
  if (!cls?.page?.draftVersion) notFound();

  const blocks = [...cls.page.draftVersion.blocks].sort((a, b) => a.position - b.position);
  const session = await getSession();

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between border-b bg-muted/50 px-6 py-3">
        <p className="text-sm text-muted-foreground">
          Previewing draft v{cls.page.draftVersion.versionNo} — exactly what fellows will see
        </p>
        <Button asChild size="sm" variant="outline">
          <Link href={`/admin/curriculum/class/${classId}`}>Back to builder</Link>
        </Button>
      </div>
      <div className="flex flex-col gap-6 p-6">
        <BlockRenderer blocks={blocks} classId={classId} mode="preview" />
        <Separator />
        <div>
          <p className="mb-3 text-xs text-muted-foreground">
            Q&amp;A attaches to the class, not this draft — shown here across all cohorts for moderation, independent
            of publish state.
          </p>
          {session.userId && <QnaSection classId={classId} viewer={{ kind: "admin", userId: session.userId }} />}
        </div>
      </div>
    </div>
  );
}
