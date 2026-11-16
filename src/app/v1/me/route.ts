import { route } from "@/lib/http";
import { missingForPromotion } from "@/lib/promotion";
import { activeProgressOf, personById } from "@/lib/records";

// Your own record, with your current progress and what is left to do.
export const GET = route(({ me }) => {
  const person = personById(me.personId);
  const progress = activeProgressOf(me.personId) ?? null;
  return { ...person, progress, missingForPromotion: progress ? missingForPromotion(me.personId) : [] };
});
