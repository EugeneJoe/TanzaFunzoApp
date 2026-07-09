import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getCurrentEnrollment } from "@/lib/enrollment";
import { getFellowJourney, isReleased, type JourneyEntry } from "@/lib/journey";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Overline } from "@/components/ui/overline";
import { cn } from "@/lib/utils";

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
    <div className="mx-auto flex w-full max-w-[780px] flex-col gap-6 px-8 py-10 sm:px-12">
      <div>
        <h1 className="font-heading text-[32px] font-semibold text-navy-900">Your journey</h1>
        <Overline className="mt-1">{enrollment.cohort.name}</Overline>
      </div>

      {groups.length === 0 && <p className="text-sm text-text-faint">No classes have been added yet.</p>}

      {groups.map(({ module, classes }) => {
        const isInProgressModule = classes.some((entry) => entry.class.id === continueClassId);
        return (
          <Card key={module.id} className="gap-0 py-0">
            <CardHeader className="flex-row items-center gap-2 border-b border-border py-4">
              <CardTitle className="text-lg">{module.title}</CardTitle>
              {isInProgressModule && <Badge variant="orange-tint">In progress</Badge>}
            </CardHeader>
            <CardContent className="flex flex-col gap-1 py-2">
              {classes.map((entry, i) => {
                const released = isReleased(entry);
                const isContinue = entry.class.id === continueClassId;
                return (
                  <div
                    key={entry.class.id}
                    className={cn(
                      "relative flex items-center gap-3 rounded-md px-3 py-3",
                      isContinue && "border-l-[3px] border-l-orange bg-orange-tint/30"
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-full font-heading text-xs font-semibold",
                        isContinue ? "bg-orange text-white" : "bg-card-alt text-muted-foreground"
                      )}
                    >
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <p className={cn("text-[15px] font-medium", released ? "text-navy-900" : "text-muted-foreground")}>
                        {entry.class.title}
                      </p>
                      {!released && (
                        <p className="text-xs text-text-faint">
                          {entry.releaseAt ? `Unlocks ${entry.releaseAt.toLocaleDateString()}` : "Not yet scheduled"}
                        </p>
                      )}
                    </div>
                    {released ? (
                      <Button asChild size="sm" variant={isContinue ? "default" : "outline"}>
                        <Link href={`/learn/class/${entry.class.id}`}>{isContinue ? "Continue" : "Open"}</Link>
                      </Button>
                    ) : (
                      <Badge variant="outline" className="bg-row-disabled">
                        Locked
                      </Badge>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
