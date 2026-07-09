"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { approveAndReleaseGradeAction, draftWithAiAction } from "./actions";

export function GradeForm({ gradeId, maxScore, aiAvailable }: { gradeId: string; maxScore: number; aiAvailable: boolean }) {
  const router = useRouter();
  const [score, setScore] = useState("");
  const [feedback, setFeedback] = useState("");
  const [usedAi, setUsedAi] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDrafting, startDrafting] = useTransition();
  const [isSaving, startSaving] = useTransition();

  function handleDraftWithAi() {
    setError(null);
    startDrafting(async () => {
      const result = await draftWithAiAction(gradeId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setScore(String(result.score));
      setFeedback(result.feedback);
      setUsedAi(true);
    });
  }

  function handleApprove() {
    setError(null);
    if (score.trim() === "") {
      setError("Enter a score.");
      return;
    }
    startSaving(async () => {
      const result = await approveAndReleaseGradeAction(gradeId, Number(score), feedback, usedAi);
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success("Grade released");
      router.push("/admin/grading");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border p-4">
      {aiAvailable ? (
        <Button
          type="button"
          variant="outline"
          onClick={handleDraftWithAi}
          disabled={isDrafting}
          className="self-start"
        >
          {isDrafting ? "Drafting…" : "Draft with AI"}
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">
          AI drafting is unavailable (no ANTHROPIC_API_KEY configured) — grade manually below.
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="score">Score (out of {maxScore})</Label>
        <Input
          id="score"
          type="number"
          min={0}
          max={maxScore}
          value={score}
          onChange={(e) => {
            setScore(e.target.value);
            setUsedAi(false);
          }}
          className="w-32"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="feedback">Feedback</Label>
        <Textarea
          id="feedback"
          value={feedback}
          onChange={(e) => {
            setFeedback(e.target.value);
            setUsedAi(false);
          }}
          rows={5}
          placeholder="Feedback for the fellow"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button onClick={handleApprove} disabled={isSaving || !feedback.trim() || score.trim() === ""} className="self-start">
        {isSaving ? "Releasing…" : "Approve and release"}
      </Button>
    </div>
  );
}
