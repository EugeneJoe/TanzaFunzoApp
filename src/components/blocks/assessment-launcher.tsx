import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { assessmentQuestions } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSession } from "@/lib/session";
import { countSubmissions, getLatestSubmission, getSubmissionResult } from "@/lib/assessment-result";

const MINUTES_PER_QUESTION = 2;

type FellowStatus = { label: "Not started" | "Submitted" | "Graded"; attemptsExhausted: boolean };

async function getFellowStatus(assessmentId: string, attemptsAllowed: number): Promise<FellowStatus> {
  const session = await getSession();
  if (!session.userId) return { label: "Not started", attemptsExhausted: false };

  const submissionCount = await countSubmissions(session.userId, assessmentId);
  const attemptsExhausted = submissionCount >= attemptsAllowed;
  if (submissionCount === 0) return { label: "Not started", attemptsExhausted };

  const latest = await getLatestSubmission(session.userId, assessmentId);
  const result = latest ? await getSubmissionResult(latest.id) : null;
  return { label: result?.allReleased ? "Graded" : "Submitted", attemptsExhausted };
}

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
          <FellowLauncherBody
            assessmentId={assessmentId}
            classId={classId}
            attemptsAllowed={assessment.settings.attemptsAllowed}
          />
        )}
      </CardContent>
    </Card>
  );
}

async function FellowLauncherBody({
  assessmentId,
  classId,
  attemptsAllowed,
}: {
  assessmentId: string;
  classId: string;
  attemptsAllowed: number;
}) {
  const { label, attemptsExhausted } = await getFellowStatus(assessmentId, attemptsAllowed);
  return (
    <div className="flex items-center gap-3">
      <Badge variant={label === "Graded" ? "default" : "outline"}>{label}</Badge>
      {attemptsExhausted ? (
        <Button disabled>Start assessment</Button>
      ) : (
        <Button asChild>
          <Link href={`/learn/class/${classId}/assessment`}>Start assessment</Link>
        </Button>
      )}
    </div>
  );
}
