import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { topicCompletions } from "@/db/schema";
import { authorize } from "@/lib/authz";
import { route } from "@/lib/http";
import { missingForPromotion } from "@/lib/promotion";
import { progressById } from "@/lib/records";

// One progress record, with what is done and what is left.
export const GET = route<{ id: string }>(({ ability, params }) => {
  const prog = progressById(params.id);
  authorize(ability, "read", "progress", prog);
  const done = getDb().select().from(topicCompletions).where(eq(topicCompletions.progressId, prog.id)).all();
  return {
    ...prog,
    topicsLearned: done.map((d) => d.topicId),
    missingForPromotion: prog.status === "active" ? missingForPromotion(prog.personId) : [],
  };
});
