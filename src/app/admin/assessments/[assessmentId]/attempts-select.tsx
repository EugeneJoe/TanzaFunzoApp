"use client";

import { useTransition } from "react";

export function AttemptsSelect({
  assessmentId,
  value,
  disabled,
  onSave,
}: {
  assessmentId: string;
  value: number;
  disabled?: boolean;
  onSave: (assessmentId: string, attemptsAllowed: number) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      className="h-7 rounded border bg-transparent px-1.5 text-sm disabled:opacity-50"
      value={value}
      disabled={disabled || isPending}
      onChange={(e) => startTransition(() => onSave(assessmentId, Number(e.target.value)))}
    >
      {[1, 2, 3].map((n) => (
        <option key={n} value={n}>
          {n} attempt{n === 1 ? "" : "s"}
        </option>
      ))}
    </select>
  );
}
