import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { classes } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getCurrentEnrollment } from "@/lib/enrollment";
import { getFellowJourney, isReleased } from "@/lib/journey";
import { getCompletedClassIds, recordClassView } from "@/lib/completion";
import { Separator } from "@/components/ui/separator";
import { Overline } from "@/components/ui/overline";
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

  await recordClassView(session.userId, classId);

  // Scoped to this module, not the whole cohort curriculum — a fellow
  // reading "Class 1 of 1" should see progress through that module, not a
  // number diluted by other modules elsewhere in their journey.
  const completedIds = await getCompletedClassIds(session.userId, sameModule);
  const progressPct = sameModule.length > 0 ? Math.round((completedIds.size / sameModule.length) * 100) : 0;

  const blocks = [...cls.page.publishedVersion.blocks].sort((a, b) => a.position - b.position);

  return (
    <div className="mx-auto flex w-full max-w-[780px] flex-col gap-6 px-8 py-10 sm:px-12">
      <div className="flex items-start justify-between gap-4">
        <Overline>
          {cls.module.title} · Class {ordinal} of {sameModule.length}
        </Overline>
        <div className="flex shrink-0 items-center gap-2 pt-0.5">
          <div className="h-1.5 w-[130px] overflow-hidden rounded-full bg-track">
            <div className="h-full rounded-full bg-orange" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="text-xs font-medium text-text-faint">{progressPct}%</span>
        </div>
      </div>

      <div>
        <h1 className="font-heading text-[32px] font-semibold text-navy-900">{cls.title}</h1>
        <p className="mt-1 text-sm text-text-faint">
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
            <p className="text-sm text-text-faint">Next class: {nextEntry.class.title}</p>
          ) : (
            <p className="text-sm text-text-faint">
              Next: {nextEntry.class.title} · unlocks{" "}
              {nextEntry.releaseAt ? nextEntry.releaseAt.toLocaleDateString() : "date TBD"}
            </p>
          )}
        </>
      )}
    </div>
  );
}
