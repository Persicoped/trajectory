import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/client";
import { people, spaces } from "../db/schema";
import { createToken } from "./tokens";

// Names that a space cannot take, because the product uses them.
const RESERVED = ["www", "api", "app", "admin", "docs", "mail", "status", "support", "trajectory"];

export const slug = z
  .string()
  .regex(/^[a-z][a-z0-9-]{1,30}[a-z0-9]$/, "Use 3 to 32 lowercase letters, digits or hyphens. Start with a letter.")
  .refine((s) => !RESERVED.includes(s), "This name is reserved.");

export const signUp = z.strictObject({
  name: z.string().min(1),
  slug,
  ownerName: z.string().min(1),
  ownerEmail: z.email(),
});

export class SlugTaken extends Error {}

// Make a company space and its Owner in one step. The person who makes the
// space is its Owner. The token is shown one time.
export function createSpace(input: z.infer<typeof signUp>) {
  const db = getDb();
  if (db.select().from(spaces).where(eq(spaces.slug, input.slug)).get()) throw new SlugTaken();
  const space = db.insert(spaces).values({ name: input.name, slug: input.slug }).returning().get();
  const owner = db
    .insert(people)
    .values({ spaceId: space.id, name: input.ownerName, email: input.ownerEmail, role: "owner" })
    .returning()
    .get();
  return { space, owner, token: createToken(owner.id, "first token") };
}

// The web address of a space, when the install has a base domain.
export function spaceUrl(spaceSlug: string): string | null {
  const base = process.env.TRAJECTORY_BASE_DOMAIN;
  if (!base) return null;
  const scheme = base.endsWith("localhost") ? "http" : "https";
  const port = process.env.TRAJECTORY_PUBLIC_PORT ? `:${process.env.TRAJECTORY_PUBLIC_PORT}` : "";
  return `${scheme}://${spaceSlug}.${base}${port}`;
}
