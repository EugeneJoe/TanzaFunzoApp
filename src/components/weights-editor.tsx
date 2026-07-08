"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type AptitudeTerm = { id: string; name: string };

const AUTOSAVE_DELAY_MS = 900;

/**
 * The single reusable "counts toward" weights UI (data-model.md D1) — one
 * aptitude_weights table, one component, embedded wherever a question,
 * case study, or observation needs weighting. Callers own their own
 * server-side guards (e.g. the assessment editor's lock check) via the
 * `onSave` callback rather than this component importing a specific action.
 */
export function WeightsEditor({
  aptitudes,
  currentWeights,
  onSave,
  disabled,
}: {
  aptitudes: AptitudeTerm[];
  currentWeights: Record<string, number>;
  onSave: (weights: Array<{ termId: string; weight: number }>) => Promise<{ error?: string }>;
  disabled?: boolean;
}) {
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(aptitudes.map((a) => [a.id, currentWeights[a.id] ?? 0]))
  );
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRun = useRef(true);

  const sum = Object.values(values).reduce((a, b) => a + b, 0);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    setStatus("saving");
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      const weights = aptitudes.map((a) => ({ termId: a.id, weight: values[a.id] ?? 0 }));
      const result = await onSave(weights);
      setError(result.error ?? null);
      setStatus("idle");
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, AUTOSAVE_DELAY_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <Label className="text-xs text-muted-foreground">Counts toward</Label>
        {sum === 100 ? (
          <Check className="size-3.5 text-green-600" />
        ) : (
          <span className="text-xs text-muted-foreground">{sum}%</span>
        )}
        {status === "saving" && <span className="text-xs text-muted-foreground">saving…</span>}
      </div>
      <div className="flex flex-wrap gap-3">
        {aptitudes.map((a) => (
          <div key={a.id} className="flex items-center gap-1.5">
            <Label className="text-xs">{a.name}</Label>
            <Input
              type="number"
              min={0}
              max={100}
              disabled={disabled}
              value={values[a.id] ?? 0}
              onChange={(e) => setValues((v) => ({ ...v, [a.id]: Number(e.target.value) }))}
              className="h-7 w-16 text-sm"
            />
            <span className="text-xs text-muted-foreground">%</span>
          </div>
        ))}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
