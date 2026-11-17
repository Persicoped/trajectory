import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { spaces } from "@/db/schema";
import { authorize } from "@/lib/authz";
import { route } from "@/lib/http";
import { createPasswordLink } from "@/lib/password-links";
import { personById } from "@/lib/records";
import { spaceUrl } from "@/lib/spaces";

// P35: make a one-time link that lets a person choose their password. The
// Owner makes it for any person of the space. A person makes it for
// themselves. The reply holds the link one time. Give it to the person.
export const POST = route<{ id: string }>(({ req, ability, params }) => {
  const person = personById(params.id);
  authorize(ability, "read", "person", person);
  authorize(ability, "make-password-link", "person", person);
  const space = getDb().select().from(spaces).where(eq(spaces.id, person.spaceId)).get();
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host;
  const local = /^(localhost|127\.0\.0\.1|.*\.localhost)(:\d+)?$/.test(host);
  const origin = (space && spaceUrl(space.slug)) ?? `${req.headers.get("x-forwarded-proto") ?? (local ? "http" : "https")}://${host}`;
  return { personId: person.id, ...createPasswordLink(person.id, origin) };
}, { status: 201 });
