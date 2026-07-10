import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { submissions } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getSubmissionResult } from "@/lib/assessment-result";
import { getAssessmentClassMap } from "@/lib/assessment-location";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default async function MePage() {
  const session = await requireUser();

  const [mySubmissions, classMap] = await Promise.all([
    db.query.submissions.findMany({
      where: and(eq(submissions.userId, session.userId), eq(submissions.subjectType, "assessment")),
      orderBy: desc(submissions.submittedAt),
    }),
    getAssessmentClassMap(),
  ]);

  const rows = await Promise.all(
    mySubmissions.map(async (sub) => ({
      sub,
      result: await getSubmissionResult(sub.id),
      location: classMap.get(sub.subjectId),
    }))
  );

  return (
    <div className="mx-auto flex w-full max-w-[780px] flex-col gap-8 px-8 py-10 sm:px-12">
      <div className="flex flex-col gap-3">
        <h1 className="font-heading text-[32px] font-semibold text-navy-900">Your coursework</h1>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No submissions yet — start a class assessment from your journey.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {rows.map(({ sub, result, location }) => (
              <Card key={sub.id}>
                <CardContent className="flex items-center justify-between gap-4 py-4">
                  <div>
                    <p className="font-medium text-navy-900">{result?.assessmentTitle ?? "Assessment"}</p>
                    <p className="text-sm text-text-faint">
                      {location ? `${location.moduleTitle} · ${location.classTitle} · ` : null}
                      Submitted {sub.submittedAt.toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {result && (
                      <>
                        <Badge variant={result.allReleased ? "solid-navy" : "outline"}>
                          {result.allReleased ? "Graded" : "Submitted"}
                        </Badge>
                        {result.releasedMax > 0 && (
                          <span className="font-heading text-[15px] font-semibold text-navy-900">
                            {result.releasedScore}/{result.releasedMax} pts
                          </span>
                        )}
                      </>
                    )}
                    {location && (
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/learn/class/${location.classId}/assessment`}>View</Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
