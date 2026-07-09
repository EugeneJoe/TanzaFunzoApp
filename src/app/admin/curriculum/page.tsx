import Link from "next/link";
import { ArrowDown, ArrowUp, Archive } from "lucide-react";
import { db } from "@/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  archiveClassAction,
  archiveModuleAction,
  createClassAction,
  createModuleAction,
  reorderClassAction,
  reorderModuleAction,
} from "./actions";
import { ReleaseToggle } from "./release-toggle";

export default async function CurriculumPage() {
  const [modulesList, cohortsList, journeyStepsList] = await Promise.all([
    db.query.modules.findMany({
      where: (m, { eq }) => eq(m.status, "active"),
      orderBy: (m, { asc }) => [asc(m.position)],
      with: {
        classes: {
          orderBy: (c, { asc }) => [asc(c.position)],
        },
      },
    }),
    db.query.cohorts.findMany({ orderBy: (c, { asc }) => [asc(c.startDate)] }),
    db.query.journeySteps.findMany(),
  ]);

  const releasedSet = new Set(
    journeyStepsList.filter((s) => s.releaseAt).map((s) => `${s.cohortId}:${s.classId}`)
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="sticky top-0 z-10 -mx-6 flex flex-wrap items-center justify-between gap-3 border-b bg-background px-6 py-3">
        <h1 className="text-2xl font-semibold">Curriculum</h1>
        <form action={createModuleAction} className="flex items-center gap-2">
          <Input name="title" placeholder="New module title" className="w-56" required />
          <SubmitButton variant="outline" size="sm" pendingText="Adding…">
            Add module
          </SubmitButton>
        </form>
      </div>

      {modulesList.length === 0 && (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground italic">
          No modules yet — add one above to start building the curriculum.
        </p>
      )}

      {modulesList.map((mod, modIndex) => {
        const activeClasses = mod.classes.filter((c) => c.status === "active");
        return (
          <Card key={mod.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{mod.title}</CardTitle>
              <div className="flex items-center gap-1">
                <form action={reorderModuleAction.bind(null, mod.id, "up")}>
                  <SubmitButton size="icon" variant="ghost" disabled={modIndex === 0}>
                    <ArrowUp className="size-4" />
                  </SubmitButton>
                </form>
                <form action={reorderModuleAction.bind(null, mod.id, "down")}>
                  <SubmitButton size="icon" variant="ghost" disabled={modIndex === modulesList.length - 1}>
                    <ArrowDown className="size-4" />
                  </SubmitButton>
                </form>
                <form action={archiveModuleAction.bind(null, mod.id)}>
                  <SubmitButton size="icon" variant="ghost">
                    <Archive className="size-4" />
                  </SubmitButton>
                </form>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {activeClasses.length === 0 && (
                <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground italic">
                  No classes in this module yet.
                </p>
              )}
              {activeClasses.map((cls, clsIndex) => (
                <div key={cls.id} className="flex items-center justify-between rounded-lg border p-3">
                  <Link href={`/admin/curriculum/class/${cls.id}`} className="font-medium hover:underline">
                    {cls.title}
                  </Link>
                  <div className="flex items-center gap-4">
                    {cohortsList.map((cohort) => {
                      const released = releasedSet.has(`${cohort.id}:${cls.id}`);
                      return (
                        <div key={cohort.id} className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">{cohort.name}</span>
                          <ReleaseToggle cohortId={cohort.id} classId={cls.id} released={released} />
                          <Badge variant={released ? "default" : "outline"}>
                            {released ? "Released" : "Locked"}
                          </Badge>
                        </div>
                      );
                    })}
                    <div className="flex items-center gap-1">
                      <form action={reorderClassAction.bind(null, cls.id, mod.id, "up")}>
                        <SubmitButton size="icon" variant="ghost" disabled={clsIndex === 0}>
                          <ArrowUp className="size-4" />
                        </SubmitButton>
                      </form>
                      <form action={reorderClassAction.bind(null, cls.id, mod.id, "down")}>
                        <SubmitButton
                          size="icon"
                          variant="ghost"
                          disabled={clsIndex === activeClasses.length - 1}
                        >
                          <ArrowDown className="size-4" />
                        </SubmitButton>
                      </form>
                      <form action={archiveClassAction.bind(null, cls.id)}>
                        <SubmitButton size="icon" variant="ghost">
                          <Archive className="size-4" />
                        </SubmitButton>
                      </form>
                    </div>
                  </div>
                </div>
              ))}
              <form action={createClassAction} className="flex items-center gap-2 pt-1">
                <input type="hidden" name="moduleId" value={mod.id} />
                <Input name="title" placeholder="New class title" className="max-w-xs" required />
                <SubmitButton variant="outline" size="sm" pendingText="Adding…">
                  Add class
                </SubmitButton>
              </form>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
