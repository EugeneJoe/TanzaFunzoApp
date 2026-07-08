import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getCurrentEnrollment } from "@/lib/enrollment";
import { getFellowJourney, isReleased, type JourneyEntry } from "@/lib/journey";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function groupByModule(entries: JourneyEntry[]) {
  const groups: { module: JourneyEntry["module"]; classes: JourneyEntry[] }[] = [];
  for (const entry of entries) {
    const last = groups[groups.length - 1];
    if (last && last.module.id === entry.module.id) {
      last.classes.push(entry);
    } else {
      groups.push({ module: entry.module, classes: [entry] });
    }
  }
  return groups;
}

export default async function LearnPage() {
  const session = await requireUser();
  const enrollment = await getCurrentEnrollment(session.userId);

  if (!enrollment) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="text-muted-foreground">You&apos;re not enrolled in a cohort yet.</p>
      </div>
    );
  }

  const journey = await getFellowJourney(enrollment.cohortId);
  const releasedEntries = journey.filter(isReleased);
  const continueClassId = releasedEntries[releasedEntries.length - 1]?.class.id;
  const groups = groupByModule(journey);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Your journey</h1>
        <p className="text-sm text-muted-foreground">{enrollment.cohort.name}</p>
      </div>

      {groups.length === 0 && <p className="text-sm text-muted-foreground">No classes have been added yet.</p>}

      {groups.map(({ module, classes }) => (
        <Card key={module.id}>
          <CardHeader>
            <CardTitle>{module.title}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {classes.map((entry) => {
              const released = isReleased(entry);
              const isContinue = entry.class.id === continueClassId;
              return (
                <div key={entry.class.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium">{entry.class.title}</p>
                    {!released && (
                      <p className="text-xs text-muted-foreground">
                        {entry.releaseAt ? `Unlocks ${entry.releaseAt.toLocaleDateString()}` : "Not yet scheduled"}
                      </p>
                    )}
                  </div>
                  {released ? (
                    <Button asChild size="sm" variant={isContinue ? "default" : "outline"}>
                      <Link href={`/learn/class/${entry.class.id}`}>{isContinue ? "Continue" : "Open"}</Link>
                    </Button>
                  ) : (
                    <Badge variant="outline">Locked</Badge>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
