import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { topicCompletions, topics } from "@/db/schema";
import { authorize } from "@/lib/authz";
import { notFound, route } from "@/lib/http";
import { progressById } from "@/lib/records";

// P15: a member marks a topic as learned on their own active progress.
export const POST = route<{ id: string; topicId: string }>(({ ability, params }) => {
  const prog = progressById(params.id);
  authorize(ability, "read", "progress", prog);
  authorize(ability, "mark-topic", "progress", prog);
  const topic = getDb().select().from(topics).where(eq(topics.id, params.topicId)).get();
  if (!topic || topic.levelId !== prog.levelId) throw notFound();
  getDb().insert(topicCompletions).values({ progressId: prog.id, topicId: topic.id }).onConflictDoNothing().run();
  return { progressId: prog.id, topicId: topic.id, learned: true };
}, { status: 201 });
