import { conflict, HttpError, publicRoute } from "@/lib/http";
import { createSpace, signUp, SlugTaken, spaceUrl } from "@/lib/spaces";

// P34: sign-up. A new user makes a company space and becomes its Owner. This is the
// only request that needs no token. Set TRAJECTORY_SIGNUP=closed to stop it.
export const POST = publicRoute(async ({ body }) => {
  if (process.env.TRAJECTORY_SIGNUP === "closed") throw new HttpError(403, "Not allowed", "Sign-up is closed on this install.");
  const input = await body(signUp);
  try {
    const { space, owner, token } = createSpace(input);
    return { space: { ...space, url: spaceUrl(space.slug) }, owner, token };
  } catch (error) {
    if (error instanceof SlugTaken) throw conflict("This space name is taken.");
    throw error;
  }
}, { status: 201 });
