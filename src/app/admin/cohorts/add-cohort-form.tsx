"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCohortAction, type CreateCohortState } from "./actions";

const initialState: CreateCohortState = {};

const fieldLabelClass = "font-heading text-xs font-semibold text-navy-900";
const fieldInputClass = "h-auto rounded-lg border-input px-[13px] py-2.5 text-sm text-text-input";

export function AddCohortForm() {
  const [state, formAction, isPending] = useActionState(createCohortAction, initialState);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[15px]">Add a cohort</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cohort-name" className={fieldLabelClass}>
                Cohort name
              </Label>
              <Input id="cohort-name" name="name" placeholder="Cohort 3" required className={fieldInputClass} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cohort-start" className={fieldLabelClass}>
                Start date
              </Label>
              <Input id="cohort-start" name="startDate" type="date" required className={fieldInputClass} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cohort-enrol-open" className={fieldLabelClass}>
                Enrolment opens
              </Label>
              <Input id="cohort-enrol-open" name="enrolOpenAt" type="date" required className={fieldInputClass} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cohort-enrol-close" className={fieldLabelClass}>
                Enrolment closes
              </Label>
              <Input id="cohort-enrol-close" name="enrolCloseAt" type="date" required className={fieldInputClass} />
            </div>
          </div>

          {state.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}
          {state.overlapHint && (
            <p className="text-sm text-warning-text">{state.overlapHint} New signups go to the earliest-starting open cohort.</p>
          )}
          <p className="text-xs text-text-faint">
            Signups auto-assign to the earliest-starting cohort with an open enrolment window — overlapping windows aren&rsquo;t blocked, but only one will receive new fellows.
          </p>

          <div className="flex justify-end">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Adding…" : "+ Add cohort"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
