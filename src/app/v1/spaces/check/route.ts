import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { spaces } from "@/db/schema";
import { notFound, publicRoute } from "@/lib/http";

// Is this host name a real space? A web server asks before it gets a
// certificate for a subdomain, so nobody can make it fetch certificates for
// names that do not exist. The reply holds no data about the space.
export const GET = publicRoute(({ req }) => {
  const base = process.env.TRAJECTORY_BASE_DOMAIN?.toLowerCase();
  const domain = (new URL(req.url).searchParams.get("domain") ?? "").toLowerCase();
  if (!base || !domain) throw notFound();
  if (domain === base) return { ok: true };
  if (!domain.endsWith(`.${base}`)) throw notFound();
  const slug = domain.slice(0, -base.length - 1);
  if (!getDb().select().from(spaces).where(eq(spaces.slug, slug)).get()) throw notFound();
  return { ok: true };
});
