import {
  AbilityBuilder,
  createMongoAbility,
  type ForcedSubject,
  type MongoAbility,
} from "@casl/ability";
import { rolesHeldBy, type Role } from "./roles";

// The rules are in docs/access-policy.md. Each grant names its rule id.

// Objects that belong to the company (the install).
export const LADDER_SUBJECTS = ["ladder", "pay-band", "level", "topic", "test"] as const;
// Objects that belong to one person. Each row carries personId.
export const PERSON_SUBJECTS = [
  "progress",
  "test-result",
  "work-item",
  "contribution",
  "review",
  "certification",
  "promotion",
] as const;

export type SubjectName =
  | (typeof LADDER_SUBJECTS)[number]
  | (typeof PERSON_SUBJECTS)[number]
  | "person"
  | "space";

export type Action =
  | "create"
  | "read"
  | "update"
  | "delete"
  | "read-pay"
  | "read-answer-key"
  | "mark-topic"
  | "revoke"
  | "deactivate"
  | "assign-role";

// The fields a rule may test.
export type Row = {
  id?: string | null;
  spaceId?: string | null;
  personId?: string | null;
  levelId?: string | null;
  status?: string | null;
};
type Tagged = { [N in SubjectName]: ForcedSubject<N> & Row }[SubjectName];
export type Subject = SubjectName | Tagged;
export type AppAbility = MongoAbility<[Action, Subject]>;

// The person who asks. The role comes from the database, never from the caller.
export type Actor = {
  personId: string;
  // The company space of the person. A person never reaches another space.
  spaceId: string;
  role: Role;
  currentLevelId: string | null;
  currentPayBandId: string | null;
} | null;

type Builder = AbilityBuilder<AppAbility>;
type Me = NonNullable<Actor>;

// What each role ADDS on top of the role below it.
const GRANTS: Record<Role, (b: Builder, me: Me) => void> = {
  member: ({ can }, me) => {
    const mine = { personId: me.personId };
    // P32: everyone reads their own company space.
    can("read", "space", { id: me.spaceId });
    // P6: everyone reads the ladder, without pay amounts.
    can("read", ["ladder", "pay-band", "level", "topic"]);
    // P9: pay for the member's own current band and level only.
    if (me.currentPayBandId) can("read-pay", "pay-band", { id: me.currentPayBandId });
    if (me.currentLevelId) {
      can("read-pay", "level", { id: me.currentLevelId });
      // P10: test questions for the member's own current level only.
      can("read", "test", { levelId: me.currentLevelId });
      // P12: take a test for the member's own current level.
      can("create", "test-result", { ...mine, levelId: me.currentLevelId });
    }
    // P13: read your own records.
    can(["read", "read-pay"], "person", { id: me.personId });
    can("read", [...PERSON_SUBJECTS], mine);
    // P15: mark topics on your own active progress.
    can("mark-topic", "progress", { ...mine, status: "active" });
    // P16: submit work, and change it until a review passes it.
    can("create", ["work-item", "contribution"], mine);
    can("update", ["work-item", "contribution"], { ...mine, status: { $ne: "passed" } });
  },
  manager: ({ can }, me) => {
    const others = { personId: { $ne: me.personId } };
    // P7, P8: build the ladder.
    can(["create", "update", "delete"], [...LADDER_SUBJECTS]);
    // P9, P10, P11: all pay amounts, all tests, the answer key.
    can("read-pay", ["pay-band", "level"]);
    can(["read", "read-answer-key"], "test");
    // P17: read every person's records.
    can(["read", "read-pay"], "person");
    can("read", [...PERSON_SUBJECTS]);
    // P18, P19, P20: review, certify and promote other people, never yourself.
    can("create", ["review", "certification", "promotion"], others);
    can("revoke", "certification", others);
  },
  owner: ({ can }, me) => {
    // P33: the Owner changes the name of the space.
    can("update", "space", { id: me.spaceId });
    // P25: add people and change their details.
    can(["create", "update"], "person");
    // P25, P26: the Owner cannot deactivate or change the role of the Owner.
    can(["deactivate", "assign-role"], "person", { id: { $ne: me.personId } });
  },
};

// Build the ability for one actor. No actor means no rules: default deny (P1, P2).
export function defineAbilityFor(actor: Actor): AppAbility {
  const builder = new AbilityBuilder<AppAbility>(createMongoAbility);
  if (actor) {
    for (const role of rolesHeldBy(actor.role)) GRANTS[role](builder, actor);
  }
  const ability = builder.build();
  if (actor) SPACE_OF.set(ability, actor.spaceId);
  return ability;
}

// The space that an ability was built for. The decision point reads it.
const SPACE_OF = new WeakMap<AppAbility, string>();
export const spaceOfAbility = (ability: AppAbility): string | undefined => SPACE_OF.get(ability);
