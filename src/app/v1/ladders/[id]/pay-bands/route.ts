import { children } from "@/lib/ladder-crud";
import { payBand } from "@/lib/kinds";

export const { GET, POST } = children(payBand);
