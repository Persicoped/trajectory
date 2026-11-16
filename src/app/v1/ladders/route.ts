import { collection } from "@/lib/ladder-crud";
import { ladder } from "@/lib/kinds";

export const { GET, POST } = collection(ladder);
