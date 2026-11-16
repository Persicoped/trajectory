import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { apiTokens, levels, people, spaces } from "@/db/schema";
import { isRole } from "./roles";
import type { Actor } from "./ability";
import { hashToken } from "./hash";

// Who is asking. The token says who the person is. The role and the current
// level come from the database on the server, never from the caller.
export async function getActor(req: Request): Promise<Actor> {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (!match) return null;

  const db = getDb();
  const token = db
    .select()
    .from(apiTokens)
    .where(and(eq(apiTokens.tokenHash, hashToken(match[1])), isNull(apiTokens.revokedAt)))
    .get();
  if (!token) return null;

  const person = db.select().from(people).where(eq(people.id, token.personId)).get();
  // P27: a deactivated person holds no permissions.
  if (!person || !person.active || !isRole(person.role)) return null;

  // P31: on a space subdomain, only the people of that space can sign in.
  const slug = spaceSlugOfHost(req);
  if (slug) {
    const space = db.select().from(spaces).where(eq(spaces.id, person.spaceId)).get();
    if (!space || space.slug !== slug) return null;
  }

  const level = person.currentLevelId
    ? db.select().from(levels).where(eq(levels.id, person.currentLevelId)).get()
    : undefined;

  return {
    personId: person.id,
    spaceId: person.spaceId,
    role: person.role,
    currentLevelId: person.currentLevelId,
    currentPayBandId: level?.payBandId ?? null,
  };
}

// The space slug in the host name, such as "acme" in acme.trajectory.example.
// TRAJECTORY_BASE_DOMAIN is the part after the slug. With no base domain, or
// on the base domain itself, there is no slug and the token alone decides.
export function spaceSlugOfHost(req: Request): string | null {
  const base = process.env.TRAJECTORY_BASE_DOMAIN?.toLowerCase();
  if (!base) return null;
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").toLowerCase().replace(/:\d+$/, "");
  if (!host.endsWith(`.${base}`)) return null;
  return host.slice(0, -base.length - 1) || null;
}
