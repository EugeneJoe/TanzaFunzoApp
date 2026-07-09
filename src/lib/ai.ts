import "server-only";
import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-5";
const TIMEOUT_MS = 20_000;

export type GradeDraft = { score: number; feedback: string };

/** Callers must check this before showing any "Draft with AI" control — no
 * network call is attempted when it's false (AC-4: absent, not a crash). */
export function isAiAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const GRADE_TOOL: Anthropic.Tool = {
  name: "submit_grade",
  description:
    "Submit a score and written feedback for a fellow's short-answer response, graded strictly against the provided rubric.",
  input_schema: {
    type: "object",
    properties: {
      score: { type: "number", description: "Points awarded, from 0 up to maxPoints." },
      feedback: {
        type: "string",
        description: "2-4 sentences of specific, constructive feedback addressed directly to the fellow.",
      },
    },
    required: ["score", "feedback"],
  },
};

/**
 * Drafts a score + feedback for one short-answer response. Never invoke
 * without checking isAiAvailable() first. Throws on any failure (timeout,
 * API error, malformed output) — the caller catches this to show an
 * "AI draft failed" notice and fall back to manual entry; a human still
 * approves everything before it's released either way (data-model.md: an
 * ai_draft grade can never reach released unassisted).
 */
export async function draftGrade(input: {
  questionBody: string;
  rubric: string;
  maxPoints: number;
  fellowAnswer: string;
}): Promise<GradeDraft> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set.");

  const client = new Anthropic({ apiKey, timeout: TIMEOUT_MS, maxRetries: 1 });

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    system:
      "You are assisting a Tanza Fellowship program admin in grading a fellow's short-answer response. " +
      "Score strictly against the given rubric and max points — do not be lenient or harsh beyond what " +
      "the rubric supports. Feedback should be specific to this answer and help the fellow improve, not " +
      "just justify the score. Always respond by calling submit_grade.",
    messages: [
      {
        role: "user",
        content: [
          `Question: ${input.questionBody}`,
          `Rubric: ${input.rubric}`,
          `Max points: ${input.maxPoints}`,
          `Fellow's answer:\n${input.fellowAnswer}`,
        ].join("\n\n"),
      },
    ],
    tools: [GRADE_TOOL],
    tool_choice: { type: "tool", name: "submit_grade" },
  });

  const toolUse = message.content.find((block) => block.type === "tool_use");
  if (!toolUse) throw new Error("AI response did not include a grade.");

  const parsed = toolUse.input as { score?: unknown; feedback?: unknown };
  const score = Number(parsed.score);
  const feedback = typeof parsed.feedback === "string" ? parsed.feedback.trim() : "";
  if (!Number.isFinite(score) || !feedback) throw new Error("AI response was malformed.");

  return { score: Math.max(0, Math.min(input.maxPoints, score)), feedback };
}
