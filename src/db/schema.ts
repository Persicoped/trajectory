import { integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const stamp = (name: string) =>
  text(name)
    .notNull()
    .$defaultFn(() => new Date().toISOString());

// ---- The company space ----

// One company. Every ladder and every person belongs to one space. The slug is
// the subdomain of the space.
export const spaces = sqliteTable("spaces", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: stamp("created_at"),
});
const spaceId = () => text("space_id").notNull().references(() => spaces.id);

// ---- The ladder ----

export const ladders = sqliteTable("ladders", {
  id: id(),
  spaceId: spaceId(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  status: text("status", { enum: ["active", "retired"] }).notNull().default("active"),
  createdAt: stamp("created_at"),
});

export const payBands = sqliteTable("pay_bands", {
  id: id(),
  ladderId: text("ladder_id").notNull().references(() => ladders.id),
  name: text("name").notNull(),
  position: integer("position").notNull(),
  minRateCents: integer("min_rate_cents").notNull(),
  maxRateCents: integer("max_rate_cents").notNull(),
  currency: text("currency").notNull().default("USD"),
  minDurationDays: integer("min_duration_days").notNull().default(0),
  status: text("status", { enum: ["active", "retired"] }).notNull().default("active"),
  createdAt: stamp("created_at"),
});

export const levels = sqliteTable("levels", {
  id: id(),
  payBandId: text("pay_band_id").notNull().references(() => payBands.id),
  title: text("title").notNull(),
  position: integer("position").notNull(),
  recommendedRateCents: integer("recommended_rate_cents").notNull(),
  minDurationDays: integer("min_duration_days").notNull().default(0),
  status: text("status", { enum: ["active", "retired"] }).notNull().default("active"),
  createdAt: stamp("created_at"),
});

export const topics = sqliteTable("topics", {
  id: id(),
  levelId: text("level_id").notNull().references(() => levels.id),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  required: integer("required", { mode: "boolean" }).notNull().default(true),
  createdAt: stamp("created_at"),
});

export type Question = { id: string; prompt: string; choices: string[] };

export const tests = sqliteTable("tests", {
  id: id(),
  topicId: text("topic_id").notNull().references(() => topics.id),
  title: text("title").notNull(),
  questions: text("questions", { mode: "json" }).$type<Question[]>().notNull(),
  // Question id to the index of the right choice. Managers only.
  answerKey: text("answer_key", { mode: "json" }).$type<Record<string, number>>().notNull(),
  passMark: integer("pass_mark").notNull().default(80),
  createdAt: stamp("created_at"),
});

// ---- People ----

export const people = sqliteTable(
  "people",
  {
  id: id(),
  spaceId: spaceId(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role", { enum: ["member", "manager", "owner"] }).notNull().default("member"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  // These two change only through a promotion.
  currentLevelId: text("current_level_id").references(() => levels.id),
  currentRateCents: integer("current_rate_cents"),
  createdAt: stamp("created_at"),
  },
  // An email is used one time in a space. Two spaces can hold the same email.
  (t) => [uniqueIndex("people_space_email").on(t.spaceId, t.email)],
);

export const apiTokens = sqliteTable("api_tokens", {
  id: id(),
  personId: text("person_id").notNull().references(() => people.id),
  name: text("name").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: stamp("created_at"),
  revokedAt: text("revoked_at"),
});

// ---- One person's progress ----

export const progress = sqliteTable("progress", {
  id: id(),
  personId: text("person_id").notNull().references(() => people.id),
  levelId: text("level_id").notNull().references(() => levels.id),
  status: text("status", { enum: ["active", "completed"] }).notNull().default("active"),
  startedAt: stamp("started_at"),
  completedAt: text("completed_at"),
});

export const topicCompletions = sqliteTable(
  "topic_completions",
  {
    progressId: text("progress_id").notNull().references(() => progress.id),
    topicId: text("topic_id").notNull().references(() => topics.id),
    completedAt: stamp("completed_at"),
  },
  (t) => [primaryKey({ columns: [t.progressId, t.topicId] })],
);

export const testResults = sqliteTable("test_results", {
  id: id(),
  personId: text("person_id").notNull().references(() => people.id),
  progressId: text("progress_id").notNull().references(() => progress.id),
  testId: text("test_id").notNull().references(() => tests.id),
  answers: text("answers", { mode: "json" }).$type<Record<string, number>>().notNull(),
  score: integer("score").notNull(),
  passed: integer("passed", { mode: "boolean" }).notNull(),
  createdAt: stamp("created_at"),
});

const submission = {
  id: id(),
  personId: text("person_id").notNull().references(() => people.id),
  progressId: text("progress_id").notNull().references(() => progress.id),
  title: text("title").notNull(),
  link: text("link").notNull().default(""),
  notes: text("notes").notNull().default(""),
  status: text("status", { enum: ["submitted", "passed", "not_yet"] }).notNull().default("submitted"),
  createdAt: stamp("created_at"),
};

export const workItems = sqliteTable("work_items", { ...submission });
export const contributions = sqliteTable("contributions", { ...submission });

export const reviews = sqliteTable("reviews", {
  id: id(),
  // The person whose record is reviewed.
  personId: text("person_id").notNull().references(() => people.id),
  reviewerId: text("reviewer_id").notNull().references(() => people.id),
  subjectType: text("subject_type", { enum: ["test-result", "work-item", "contribution"] }).notNull(),
  subjectId: text("subject_id").notNull(),
  decision: text("decision", { enum: ["passed", "not_yet"] }).notNull(),
  notes: text("notes").notNull().default(""),
  createdAt: stamp("created_at"),
});

export const certifications = sqliteTable("certifications", {
  id: id(),
  personId: text("person_id").notNull().references(() => people.id),
  levelId: text("level_id").notNull().references(() => levels.id),
  skill: text("skill").notNull(),
  issuedBy: text("issued_by").notNull().references(() => people.id),
  issuedAt: stamp("issued_at"),
  revokedAt: text("revoked_at"),
  revokedBy: text("revoked_by").references(() => people.id),
});

export const promotions = sqliteTable("promotions", {
  id: id(),
  personId: text("person_id").notNull().references(() => people.id),
  fromLevelId: text("from_level_id").references(() => levels.id),
  toLevelId: text("to_level_id").notNull().references(() => levels.id),
  newRateCents: integer("new_rate_cents").notNull(),
  promotedBy: text("promoted_by").notNull().references(() => people.id),
  createdAt: stamp("created_at"),
});
