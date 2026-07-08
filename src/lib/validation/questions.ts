import { z } from "zod";

export const mcOptionSchema = z.object({
  id: z.string().min(1),
  text: z.string().trim().min(1),
});

export const mcOptionsSchema = z.array(mcOptionSchema).min(2, "Add at least two options.");

export const shortAnswerRubricSchema = z.object({
  criteria: z.string().trim().min(1),
});

export const weightInputSchema = z.object({
  termId: z.string().min(1),
  weight: z.number().min(0).max(100),
});
