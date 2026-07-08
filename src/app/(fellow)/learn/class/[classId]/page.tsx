import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { classes } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getCurrentEnrollment } from "@/lib/enrollment";
import { getFellowJourney, isReleased } from "@/lib/journey";
import { Separator } from "@/components/ui/separator";
import { BlockRenderer } from "@/components/blocks/block-renderer";
import { QnaSection } from "@/components/qna/qna-section";

export default async function FellowClassPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  const session = await requireUser();

  const enrollment = await getCurrentEnrollment(session.userId);
  if (!enrollment) notFound();

  const cls = await db.query.classes.findFirst({
    where: eq(classes.id, classId),
    with: { module: true, page: { with: { publishedVersion: { with: { blocks: true } } } } },
  });
  if (!cls || cls.status !== "active" || !cls.page?.publishedVersion) notFound();

  const journey = await getFellowJourney(enrollment.cohortId);
  const currentIndex = journey.findIndex((e) => e.class.id === classId);
  if (currentIndex === -1) notFound();

  const thisEntry = journey[currentIndex];
  if (!isReleased(thisEntry)) notFound();

  const sameModule = journey.filter((e) => e.module.id === cls.module.id);
  const ordinal = sameModule.findIndex((e) => e.class.id === classId) + 1;
  const nextEntry = journey[currentIndex + 1];

  const blocks = [...cls.page.publishedVersion.blocks].sort((a, b) => a.position - b.position);

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-6 p-6">
      <div>
        <p className="text-sm text-muted-foreground">
          {cls.module.title} · class {ordinal} of {sameModule.length}
        </p>
        <h1 className="text-xl font-semibold">{cls.title}</h1>
        <p className="text-xs text-muted-foreground">
          Released {thisEntry.releaseAt?.toLocaleDateString()}
          {cls.page.publishedVersion.publishedAt &&
            ` · Updated ${cls.page.publishedVersion.publishedAt.toLocaleDateString()}`}
        </p>
      </div>

      <BlockRenderer blocks={blocks} classId={classId} mode="fellow" />

      <Separator />

      <QnaSection classId={classId} viewer={{ kind: "fellow", userId: session.userId, cohortId: enrollment.cohortId }} />

      {nextEntry && (
        <>
          <Separator />
          {isReleased(nextEntry) ? (
            <p className="text-sm text-muted-foreground">Next class: {nextEntry.class.title}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Next: {nextEntry.class.title} · unlocks{" "}
              {nextEntry.releaseAt ? nextEntry.releaseAt.toLocaleDateString() : "date TBD"}
            </p>
          )}
        </>
      )}
    </div>
  );
}
