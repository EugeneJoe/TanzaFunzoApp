ALTER TABLE "class_question_replies" DROP CONSTRAINT "class_question_replies_question_id_class_questions_id_fk";
--> statement-breakpoint
ALTER TABLE "class_question_replies" ADD CONSTRAINT "class_question_replies_question_id_class_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."class_questions"("id") ON DELETE cascade ON UPDATE no action;