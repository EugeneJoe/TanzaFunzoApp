"use client";

import { useTransition } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { reassignFellowAction } from "./actions";

export function ReassignControl({
  userId,
  otherCohorts,
}: {
  userId: string;
  otherCohorts: { id: string; name: string }[];
}) {
  const [cohortId, setCohortId] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-end gap-2">
      <Select value={cohortId} onValueChange={setCohortId}>
        <SelectTrigger size="sm" className="w-40">
          <SelectValue placeholder="Choose cohort" />
        </SelectTrigger>
        <SelectContent>
          {otherCohorts.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!cohortId || isPending}
        onClick={() => startTransition(() => reassignFellowAction(userId, cohortId))}
      >
        {isPending ? "Moving…" : "Reassign"}
      </Button>
    </div>
  );
}
