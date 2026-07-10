import { db } from "@/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AddCohortForm } from "./add-cohort-form";
import { ReassignControl } from "./reassign-control";

export default async function AdminCohortsPage() {
  const [cohortsList, allEnrollments] = await Promise.all([
    db.query.cohorts.findMany({ orderBy: (c, { asc }) => [asc(c.startDate)] }),
    db.query.enrollments.findMany({
      with: { user: true, cohort: true },
      orderBy: (e, { asc }) => [asc(e.createdAt)],
    }),
  ]);

  // Enrollments are append-only history — a fellow's *current* cohort is
  // their most recent enrollment row (see actions.ts).
  const latestByUser = new Map<string, (typeof allEnrollments)[number]>();
  for (const enrollment of allEnrollments) {
    latestByUser.set(enrollment.userId, enrollment);
  }

  const membersByCohort = new Map<string, (typeof allEnrollments)[number][]>();
  for (const enrollment of latestByUser.values()) {
    const list = membersByCohort.get(enrollment.cohortId) ?? [];
    list.push(enrollment);
    membersByCohort.set(enrollment.cohortId, list);
  }

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-8 py-10 sm:px-12">
      <h1 className="font-heading text-[32px] font-semibold text-navy-900">Cohorts</h1>
      <AddCohortForm />
      {cohortsList.map((cohort) => {
        const members = (membersByCohort.get(cohort.id) ?? []).sort((a, b) =>
          a.user.fullName.localeCompare(b.user.fullName)
        );
        const otherCohorts = cohortsList.filter((c) => c.id !== cohort.id);

        return (
          <Card key={cohort.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                {cohort.name}
                <Badge variant="secondary">{cohort.status}</Badge>
              </CardTitle>
              <p className="text-sm text-text-faint">
                Starts {cohort.startDate} · enrolment window {cohort.enrolOpenAt} – {cohort.enrolCloseAt} ·{" "}
                {members.length} fellow{members.length === 1 ? "" : "s"}
              </p>
            </CardHeader>
            <CardContent>
              {members.length === 0 ? (
                <p className="text-sm text-muted-foreground">No fellows enrolled yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-heading text-[11px] font-semibold tracking-[1px] text-text-faint uppercase">
                        Name
                      </TableHead>
                      <TableHead className="font-heading text-[11px] font-semibold tracking-[1px] text-text-faint uppercase">
                        Email
                      </TableHead>
                      <TableHead className="font-heading text-[11px] font-semibold tracking-[1px] text-text-faint uppercase">
                        Assigned by
                      </TableHead>
                      {otherCohorts.length > 0 && (
                        <TableHead className="text-right font-heading text-[11px] font-semibold tracking-[1px] text-text-faint uppercase">
                          Move to
                        </TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((enrollment) => (
                      <TableRow key={enrollment.id}>
                        <TableCell className="text-[14.5px] font-semibold text-navy-900">
                          {enrollment.user.fullName}
                        </TableCell>
                        <TableCell className="text-text-faint">{enrollment.user.email}</TableCell>
                        <TableCell>
                          <Badge variant={enrollment.assignedBy === "admin" ? "default" : "outline"}>
                            {enrollment.assignedBy}
                          </Badge>
                        </TableCell>
                        {otherCohorts.length > 0 && (
                          <TableCell className="text-right">
                            <ReassignControl userId={enrollment.user.id} otherCohorts={otherCohorts} />
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
