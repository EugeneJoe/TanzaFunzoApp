import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { assessmentQuestions } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const MINUTES_PER_QUESTION = 2;

export async function AssessmentLauncher({
  assessmentId,
  classId,
  mode,
}: {
  assessmentId: string;
  classId: string;
  mode: "preview" | "fellow";
}) {
  const assessment = await db.query.assessments.findFirst({ where: (a, { eq }) => eq(a.id, assessmentId) });
  if (!assessment) return null;

  const questionLinks = await db.query.assessmentQuestions.findMany({
    where: eq(assessmentQuestions.assessmentId, assessmentId),
  });
  const minutes = questionLinks.length * MINUTES_PER_QUESTION;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{assessment.title}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {questionLinks.length} question{questionLinks.length === 1 ? "" : "s"} · about {minutes} minutes
        </p>
      </CardHeader>
      <CardContent>
        {mode === "preview" ? (
          <div className="flex items-center gap-2">
            <Badge variant="outline">Preview</Badge>
            <Button disabled>Start assessment</Button>
          </div>
        ) : (
          <Button asChild>
            <Link href={`/learn/class/${classId}/assessment`}>Start assessment</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
