"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { AptitudeTerm, WeightsEditor } from "@/components/weights-editor";
import {
  reorderQuestionAction,
  removeQuestionAction,
  setWeightsAction,
  updateMCQuestionAction,
  updatePointsAction,
  updateShortAnswerQuestionAction,
} from "./actions";
import { TagPicker } from "./tag-picker";

type MCOption = { id: string; text: string };

export function QuestionCard({
  assessmentId,
  questionId,
  type,
  index,
  count,
  points,
  initialBody,
  initialOptions,
  initialCorrectOptionId,
  initialRubric,
  currentTags,
  availableTags,
  aptitudes,
  currentWeights,
  locked,
}: {
  assessmentId: string;
  questionId: string;
  type: "mc" | "short_answer";
  index: number;
  count: number;
  points: number;
  initialBody: string;
  initialOptions: MCOption[];
  initialCorrectOptionId: string | null;
  initialRubric: string;
  currentTags: { id: string; name: string }[];
  availableTags: { id: string; name: string }[];
  aptitudes: AptitudeTerm[];
  currentWeights: Record<string, number>;
  locked: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [body, setBody] = useState(initialBody);
  const [options, setOptions] = useState<MCOption[]>(initialOptions);
  const [correctOptionId, setCorrectOptionId] = useState(initialCorrectOptionId);
  const [rubric, setRubric] = useState(initialRubric);
  const [pointsValue, setPointsValue] = useState(points);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRun = useRef(true);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (locked) return;
    if (type === "mc" && options.some((o) => o.text.trim().length === 0)) return;
    timeoutRef.current = setTimeout(() => {
      if (type === "mc") {
        updateMCQuestionAction(assessmentId, questionId, body, options, correctOptionId);
      } else {
        updateShortAnswerQuestionAction(assessmentId, questionId, body, rubric);
      }
    }, 800);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, options, correctOptionId, rubric]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          Q{index + 1} · {type === "mc" ? "Multiple choice" : "Short answer"} ·{" "}
          <input
            type="number"
            disabled={locked}
            value={pointsValue}
            onChange={(e) => {
              const v = Number(e.target.value);
              setPointsValue(v);
              if (!locked) startTransition(() => updatePointsAction(assessmentId, questionId, v));
            }}
            className="inline-block w-12 rounded border bg-transparent px-1 text-center"
          />{" "}
          pts
        </span>
        {!locked && (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled={index === 0 || isPending}
              onClick={() => startTransition(() => reorderQuestionAction(assessmentId, questionId, "up"))}
            >
              <ArrowUp className="size-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled={index === count - 1 || isPending}
              onClick={() => startTransition(() => reorderQuestionAction(assessmentId, questionId, "down"))}
            >
              <ArrowDown className="size-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled={isPending}
              onClick={() => startTransition(() => removeQuestionAction(assessmentId, questionId))}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        )}
      </div>

      <Textarea
        value={body}
        disabled={locked}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Question prompt"
        rows={2}
      />

      {type === "mc" ? (
        <RadioGroup value={correctOptionId ?? undefined} onValueChange={(v) => !locked && setCorrectOptionId(v)}>
          <div className="flex flex-col gap-2">
            {options.map((opt, i) => (
              <div key={opt.id} className="flex items-center gap-2">
                <RadioGroupItem value={opt.id} disabled={locked} />
                <Input
                  value={opt.text}
                  disabled={locked}
                  onChange={(e) =>
                    setOptions((prev) => prev.map((o, j) => (j === i ? { ...o, text: e.target.value } : o)))
                  }
                  placeholder={`Option ${i + 1}`}
                />
                {!locked && options.length > 2 && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => setOptions((prev) => prev.filter((_, j) => j !== i))}
                  >
                    <X className="size-4" />
                  </Button>
                )}
              </div>
            ))}
            {!locked && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-fit"
                onClick={() => setOptions((prev) => [...prev, { id: crypto.randomUUID(), text: "" }])}
              >
                Add option
              </Button>
            )}
          </div>
        </RadioGroup>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Textarea
            value={rubric}
            disabled={locked}
            onChange={(e) => setRubric(e.target.value)}
            placeholder="Grading rubric — what does a good answer look like?"
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            AI drafts a score and feedback against this rubric — you review and approve before the fellow sees it.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4 border-t pt-3">
        <TagPicker
          assessmentId={assessmentId}
          questionId={questionId}
          currentTags={currentTags}
          availableTags={availableTags}
          disabled={locked}
        />
        <div className="flex flex-col gap-1">
          <WeightsEditor
            aptitudes={aptitudes}
            currentWeights={currentWeights}
            onSave={(weights) => setWeightsAction(assessmentId, "question", questionId, weights)}
          />
          {locked && (
            <p className="text-xs text-muted-foreground">
              Weights stay editable even when locked — scores recompute from the existing signal ledger.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
