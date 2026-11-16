import "server-only";
import { ForbiddenError, subject as tag } from "@casl/ability";
import { spaceOfAbility, type Action, type AppAbility, type Row, type SubjectName } from "./ability";
import { OutsideSpace, spaceOfRow } from "./space";

// The one decision point. Every route handler asks here. Nothing else in the
// app compares role names.

// P30: a row of another company space is out of reach, for every role and
// every action. This check comes before the role rules.
function inMySpace(ability: AppAbility, type: SubjectName, row: Row): boolean {
  const space = spaceOfRow(type, row);
  return space === undefined || space === spaceOfAbility(ability);
}

// Throws ForbiddenError unless allowed. Pass the row for read, update and
// delete, and the new row (with its personId) for create.
export function authorize(ability: AppAbility, action: Action, type: SubjectName, row: Row): void {
  if (!inMySpace(ability, type, row)) throw new OutsideSpace();
  ForbiddenError.from(ability).throwUnlessCan(action, tag(type, { ...row }));
}

// May the caller do this? Use it to leave fields out of a reply.
export function can(ability: AppAbility, action: Action, type: SubjectName, row: Row): boolean {
  return inMySpace(ability, type, row) && ability.can(action, tag(type, { ...row }));
}

export { ForbiddenError, OutsideSpace };
export { defineAbilityFor } from "./ability";
export type { Action, Actor, AppAbility, Row, SubjectName } from "./ability";
export { getActor } from "./actor";
export { hashToken } from "./hash";
