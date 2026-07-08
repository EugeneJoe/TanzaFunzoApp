import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { classQuestionReplies, classQuestions, roles, userRoles } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatRelativeTime } from "@/lib/format";
import {
  deleteOwnQuestionAction,
  deleteOwnReplyAction,
  postQuestionAction,
  postReplyAction,
  setQuestionVisibilityAction,
  setReplyVisibilityAction,
} from "./actions";

type Viewer = { kind: "fellow"; userId: string; cohortId: string } | { kind: "admin"; userId: string };

async function getAdminUserIds(): Promise<Set<string>> {
  const adminRole = await db.query.roles.findFirst({ where: eq(roles.name, "admin") });
  if (!adminRole) return new Set();
  const rows = await db.query.userRoles.findMany({ where: eq(userRoles.roleId, adminRole.id) });
  return new Set(rows.map((r) => r.userId));
}

/**
 * Single component for both surfaces: the fellow class page (own-cohort,
 * visible-only, ask box) and the admin preview page (all cohorts, hidden
 * items flagged, hide/unhide controls) — same data, different scope and
 * controls per data-model.md §2.2 / FR-9.2.
 */
export async function QnaSection({ classId, viewer }: { classId: string; viewer: Viewer }) {
  const isAdminViewer = viewer.kind === "admin";

  const [questionList, adminIds] = await Promise.all([
    db.query.classQuestions.findMany({
      where: isAdminViewer
        ? eq(classQuestions.classId, classId)
        : and(
            eq(classQuestions.classId, classId),
            eq(classQuestions.cohortId, viewer.cohortId),
            eq(classQuestions.status, "visible")
          ),
      orderBy: desc(classQuestions.createdAt),
      with: {
        author: true,
        cohort: true,
        replies: {
          where: isAdminViewer ? undefined : eq(classQuestionReplies.status, "visible"),
          orderBy: asc(classQuestionReplies.createdAt),
          with: { author: true },
        },
      },
    }),
    getAdminUserIds(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Questions</h2>

      {viewer.kind === "fellow" && (
        <form action={postQuestionAction.bind(null, classId)} className="flex flex-col gap-2">
          <Textarea name="body" placeholder="Ask about this class" required maxLength={2000} rows={2} />
          <Button type="submit" size="sm" className="self-start">
            Post question
          </Button>
        </form>
      )}

      {questionList.length === 0 && <p className="text-sm text-muted-foreground">No questions yet.</p>}

      {questionList.map((q) => {
        const canDeleteQuestion = q.authorId === viewer.userId;
        return (
          <div key={q.id} className="flex flex-col gap-3 rounded-lg border p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium">
                  {q.author.fullName}
                  {isAdminViewer && <span className="ml-2 font-normal text-muted-foreground">{q.cohort.name}</span>}
                  <span className="ml-2 font-normal text-xs text-muted-foreground">
                    {formatRelativeTime(q.createdAt)}
                  </span>
                  {q.status === "hidden" && (
                    <Badge variant="destructive" className="ml-2">
                      Hidden
                    </Badge>
                  )}
                </p>
                <p className="mt-1 text-sm whitespace-pre-wrap">{q.body}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {isAdminViewer && (
                  <form action={setQuestionVisibilityAction.bind(null, classId, q.id, q.status === "visible")}>
                    <Button type="submit" size="sm" variant="ghost">
                      {q.status === "visible" ? "Hide" : "Unhide"}
                    </Button>
                  </form>
                )}
                {canDeleteQuestion && (
                  <form action={deleteOwnQuestionAction.bind(null, classId, q.id)}>
                    <Button type="submit" size="sm" variant="ghost">
                      Delete
                    </Button>
                  </form>
                )}
              </div>
            </div>

            {q.replies.length > 0 && (
              <div className="flex flex-col gap-3 border-l-2 pl-4">
                {q.replies.map((r) => {
                  const isAdminReply = adminIds.has(r.authorId);
                  const canDeleteReply = r.authorId === viewer.userId;
                  return (
                    <div key={r.id} className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">
                          {r.author.fullName}
                          {isAdminReply && <Badge className="ml-2">Tanza</Badge>}
                          <span className="ml-2 font-normal text-xs text-muted-foreground">
                            {formatRelativeTime(r.createdAt)}
                          </span>
                          {r.status === "hidden" && (
                            <Badge variant="destructive" className="ml-2">
                              Hidden
                            </Badge>
                          )}
                        </p>
                        <p className="mt-1 text-sm whitespace-pre-wrap">{r.body}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {isAdminViewer && (
                          <form action={setReplyVisibilityAction.bind(null, classId, r.id, r.status === "visible")}>
                            <Button type="submit" size="sm" variant="ghost">
                              {r.status === "visible" ? "Hide" : "Unhide"}
                            </Button>
                          </form>
                        )}
                        {canDeleteReply && (
                          <form action={deleteOwnReplyAction.bind(null, classId, r.id)}>
                            <Button type="submit" size="sm" variant="ghost">
                              Delete
                            </Button>
                          </form>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <form action={postReplyAction.bind(null, classId, q.id)} className="flex flex-col gap-2 pl-4">
              <Textarea name="body" placeholder="Reply" required maxLength={2000} rows={1} />
              <Button type="submit" size="sm" variant="outline" className="self-start">
                Reply
              </Button>
            </form>
          </div>
        );
      })}
    </div>
  );
}
