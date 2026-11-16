// The role ladder. Lowest first. Each role inherits every rule of the roles
// below it, so a higher role can never hold less than a lower one.
export const LADDER = ["member", "manager", "owner"] as const;
export type Role = (typeof LADDER)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (LADDER as readonly string[]).includes(value);
}

// The roles a given role holds: itself and everything below it.
export function rolesHeldBy(role: Role): Role[] {
  return LADDER.slice(0, LADDER.indexOf(role) + 1) as Role[];
}
