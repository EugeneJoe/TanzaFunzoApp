"use client";

import { useTransition } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { addTagAction, removeTagAction } from "./actions";

export function TagPicker({
  assessmentId,
  questionId,
  currentTags,
  availableTags,
  disabled,
}: {
  assessmentId: string;
  questionId: string;
  currentTags: { id: string; name: string }[];
  availableTags: { id: string; name: string }[];
  disabled?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const currentIds = new Set(currentTags.map((t) => t.id));
  const options = availableTags.filter((t) => !currentIds.has(t.id));

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {currentTags.map((tag) => (
        <Badge key={tag.id} variant="secondary" className="gap-1">
          {tag.name}
          {!disabled && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => startTransition(() => removeTagAction(assessmentId, questionId, tag.id))}
            >
              <X className="size-3" />
            </button>
          )}
        </Badge>
      ))}
      {!disabled && options.length > 0 && (
        // Plain native select (not the Radix-wrapped one) — no form
        // participation needed here, just an onChange -> direct action call.
        <select
          className="h-6 rounded border bg-transparent text-xs text-muted-foreground"
          value=""
          disabled={isPending}
          onChange={(e) => {
            const termId = e.target.value;
            if (termId) startTransition(() => addTagAction(assessmentId, questionId, termId));
          }}
        >
          <option value="">+ tag</option>
          {options.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
