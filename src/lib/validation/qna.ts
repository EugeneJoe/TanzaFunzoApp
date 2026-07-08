import { z } from "zod";

// Plain text only (locked decision #11 / do-not-build: no rich text in Q&A).
export const qnaBodySchema = z.string().trim().min(1, "Say something first.").max(2000);
