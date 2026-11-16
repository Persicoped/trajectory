// The API speaks snake_case. The code uses camelCase.
// The values under these keys are maps keyed by question id. Do not touch them.
const OPAQUE = new Set(["answers", "answerKey", "answer_key"]);

function convert(value: unknown, rename: (key: string) => string): unknown {
  if (Array.isArray(value)) return value.map((v) => convert(v, rename));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      out[rename(key)] = OPAQUE.has(key) ? v : convert(v, rename);
    }
    return out;
  }
  return value;
}

export const toSnake = (value: unknown) =>
  convert(value, (k) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`));
export const toCamel = (value: unknown) =>
  convert(value, (k) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()));
