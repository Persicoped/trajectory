import { children } from "@/lib/ladder-crud";
import { topic } from "@/lib/kinds";

export const { GET, POST } = children(topic);
