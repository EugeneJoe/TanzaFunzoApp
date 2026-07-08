"use client";

import { useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { setReleaseAction } from "./actions";

export function ReleaseToggle({
  cohortId,
  classId,
  released,
}: {
  cohortId: string;
  classId: string;
  released: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Switch
      checked={released}
      disabled={isPending}
      onCheckedChange={(checked) => startTransition(() => setReleaseAction(cohortId, classId, checked))}
      aria-label={released ? "Release" : "Lock"}
    />
  );
}
