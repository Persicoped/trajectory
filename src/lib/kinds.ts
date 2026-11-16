import "server-only";
import { z } from "zod";
import * as t from "@/db/schema";
import { can } from "@/lib/authz";
import { levelIdOfTopic, type Kind } from "./ladder-crud";

const status = z.enum(["active", "retired"]);
const cents = z.number().int().min(0);
const days = z.number().int().min(0);
const omit = (row: Record<string, unknown>, keys: string[]) =>
  Object.fromEntries(Object.entries(row).filter(([k]) => !keys.includes(k)));

// The update schemas carry no defaults, so a PATCH changes only what it names.
const ladderFields = z.strictObject({ name: z.string().min(1), description: z.string(), status });
const ladderDefaults = { description: z.string().default(""), status: status.default("active") };
export const ladder: Kind = {
  subject: "ladder",
  table: t.ladders,
  inSpace: true,
  create: ladderFields.extend(ladderDefaults),
  update: ladderFields.partial(),
};

const bandFields = z.strictObject({
  name: z.string().min(1),
  position: z.number().int().min(1),
  minRateCents: cents,
  maxRateCents: cents,
  currency: z.string().length(3),
  minDurationDays: days,
  status,
});
const bandDefaults = { currency: z.string().length(3).default("USD"), minDurationDays: days.default(0), status: status.default("active") };
export const payBand: Kind = {
  subject: "pay-band",
  table: t.payBands,
  parent: { key: "ladderId", column: t.payBands.ladderId, kind: ladder },
  create: bandFields.extend(bandDefaults).refine((b) => b.maxRateCents >= b.minRateCents, "max_rate_cents must not be less than min_rate_cents"),
  update: bandFields.partial(),
  // P9: leave the pay range out unless the caller may read it.
  view: (row, ability, facts) =>
    can(ability, "read-pay", "pay-band", facts) ? row : omit(row, ["minRateCents", "maxRateCents"]),
};

const levelFields = z.strictObject({
  title: z.string().min(1),
  position: z.number().int().min(1),
  recommendedRateCents: cents,
  minDurationDays: days,
  status,
});
const levelDefaults = { minDurationDays: days.default(0), status: status.default("active") };
export const level: Kind = {
  subject: "level",
  table: t.levels,
  parent: { key: "payBandId", column: t.levels.payBandId, kind: payBand },
  create: levelFields.extend(levelDefaults),
  update: levelFields.partial(),
  // P9: leave the recommended pay out unless the caller may read it.
  view: (row, ability, facts) =>
    can(ability, "read-pay", "level", facts) ? row : omit(row, ["recommendedRateCents"]),
};

const topicFields = z.strictObject({ name: z.string().min(1), description: z.string(), required: z.boolean() });
const topicDefaults = { description: z.string().default(""), required: z.boolean().default(true) };
export const topic: Kind = {
  subject: "topic",
  table: t.topics,
  parent: { key: "levelId", column: t.topics.levelId, kind: level },
  create: topicFields.extend(topicDefaults),
  update: topicFields.partial(),
};

const testFields = z.strictObject({
  title: z.string().min(1),
  questions: z.array(z.strictObject({ id: z.string().min(1), prompt: z.string().min(1), choices: z.array(z.string()).min(2) })).min(1),
  answerKey: z.record(z.string(), z.number().int().min(0)),
  passMark: z.number().int().min(1).max(100),
});
const testDefaults = { passMark: z.number().int().min(1).max(100).default(80) };
const keyMatches = (v: { questions?: { id: string }[]; answerKey?: Record<string, number> }) =>
  !v.questions || !v.answerKey || v.questions.every((q) => q.id in v.answerKey!);
export const test: Kind = {
  subject: "test",
  table: t.tests,
  parent: { key: "topicId", column: t.tests.topicId, kind: topic },
  create: testFields.extend(testDefaults).refine(keyMatches, "answer_key must have an answer for each question"),
  update: testFields.partial().refine(keyMatches, "answer_key must have an answer for each question"),
  // P10: the rule tests the level that the test belongs to.
  facts: (row) => ({ levelId: levelIdOfTopic(row.topicId as string) }),
  // P11: the answer key is for managers only.
  view: (row, ability, facts) =>
    can(ability, "read-answer-key", "test", facts) ? row : omit(row, ["answerKey"]),
};
