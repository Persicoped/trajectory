import { describe, expect, it } from "vitest";
import { subject } from "@casl/ability";
import {
  defineAbilityFor,
  LADDER_SUBJECTS,
  PERSON_SUBJECTS,
  type Action,
  type SubjectName,
} from "./ability";
import { LADDER, type Role } from "./roles";

const ME = "p_me";
const OTHER = "p_other";
const MY_LEVEL = "lvl_mine";
const MY_BAND = "band_mine";

const as = (role: Role) =>
  defineAbilityFor({ personId: ME, spaceId: "space_1", role, currentLevelId: MY_LEVEL, currentPayBandId: MY_BAND });

const ACTIONS: Action[] = [
  "create", "read", "update", "delete", "read-pay", "read-answer-key",
  "mark-topic", "revoke", "deactivate", "assign-role",
];
const ALL: SubjectName[] = [...LADDER_SUBJECTS, ...PERSON_SUBJECTS, "person"];
const WRITE: Action[] = ["create", "update", "delete"];

describe("the ladder", () => {
  it("never gives a lower role something the role above lacks", () => {
    const rows = [
      { id: ME, personId: ME, levelId: MY_LEVEL, status: "active" },
      { id: OTHER, personId: OTHER, levelId: "lvl_x", status: "submitted" },
      { id: MY_LEVEL }, { id: MY_BAND },
    ];
    for (let i = 0; i < LADDER.length - 1; i++) {
      const lower = as(LADDER[i]);
      const higher = as(LADDER[i + 1]);
      for (const type of ALL) for (const action of ACTIONS) for (const row of rows) {
        if (lower.can(action, subject(type, { ...row }))) {
          expect(higher.can(action, subject(type, { ...row })), `${LADDER[i + 1]} ${action} ${type}`).toBe(true);
        }
      }
    }
  });
});

describe("refusals", () => {
  it("D1: denies everything with no actor", () => {
    const nobody = defineAbilityFor(null);
    for (const type of ALL) for (const action of ACTIONS) {
      expect(nobody.can(action, subject(type, { id: ME, personId: ME })), `${action} ${type}`).toBe(false);
    }
  });

  it("D2 to D8: a member never reads another person's records", () => {
    const m = as("member");
    for (const type of PERSON_SUBJECTS) {
      expect(m.can("read", subject(type, { personId: OTHER })), type).toBe(false);
      expect(m.can("read", subject(type, { personId: ME })), type).toBe(true);
    }
    expect(m.can("read", subject("person", { id: OTHER }))).toBe(false);
    expect(m.can("read-pay", subject("person", { id: OTHER }))).toBe(false);
    expect(m.can("read-pay", subject("person", { id: ME }))).toBe(true);
  });

  it("D9 to D11: a member cannot review, certify or promote anyone", () => {
    const m = as("member");
    for (const who of [ME, OTHER]) {
      for (const type of ["review", "certification", "promotion"] as const) {
        expect(m.can("create", subject(type, { personId: who })), `${type} ${who}`).toBe(false);
      }
      expect(m.can("revoke", subject("certification", { personId: who }))).toBe(false);
    }
  });

  it("D12 to D14: a manager and the owner cannot act on their own record", () => {
    for (const role of ["manager", "owner"] as const) {
      const a = as(role);
      for (const type of ["review", "certification", "promotion"] as const) {
        expect(a.can("create", subject(type, { personId: ME })), `${role} ${type}`).toBe(false);
        expect(a.can("create", subject(type, { personId: OTHER })), `${role} ${type}`).toBe(true);
      }
      expect(a.can("revoke", subject("certification", { personId: ME }))).toBe(false);
      expect(a.can("revoke", subject("certification", { personId: OTHER }))).toBe(true);
    }
  });

  it("D15, D16: a member reads pay for their own band and level only", () => {
    const m = as("member");
    expect(m.can("read-pay", subject("pay-band", { id: MY_BAND }))).toBe(true);
    expect(m.can("read-pay", subject("pay-band", { id: "band_x" }))).toBe(false);
    expect(m.can("read-pay", subject("level", { id: MY_LEVEL }))).toBe(true);
    expect(m.can("read-pay", subject("level", { id: "lvl_x" }))).toBe(false);
    expect(as("manager").can("read-pay", subject("level", { id: "lvl_x" }))).toBe(true);
  });

  it("D17, D18: a member never reads an answer key or another level's test", () => {
    const m = as("member");
    expect(m.can("read-answer-key", subject("test", { levelId: MY_LEVEL }))).toBe(false);
    expect(m.can("read", subject("test", { levelId: MY_LEVEL }))).toBe(true);
    expect(m.can("read", subject("test", { levelId: "lvl_x" }))).toBe(false);
    expect(as("manager").can("read-answer-key", subject("test", { levelId: "lvl_x" }))).toBe(true);
  });

  it("D18: a member with no level reads no test and no pay", () => {
    const m = defineAbilityFor({ personId: ME, spaceId: "space-1", role: "member", currentLevelId: null, currentPayBandId: null });
    expect(m.can("read", subject("test", { levelId: null }))).toBe(false);
    expect(m.can("read-pay", subject("level", { id: null }))).toBe(false);
    expect(m.can("read-pay", subject("pay-band", { id: null }))).toBe(false);
  });

  it("D19: a member cannot build the ladder", () => {
    const m = as("member");
    for (const type of LADDER_SUBJECTS) for (const action of WRITE) {
      expect(m.can(action, subject(type, { id: "x" })), `${action} ${type}`).toBe(false);
      expect(as("manager").can(action, subject(type, { id: "x" })), `${action} ${type}`).toBe(true);
    }
  });

  it("D20: nobody changes a person's level or pay except through a promotion", () => {
    expect(as("member").can("update", subject("person", { id: ME }))).toBe(false);
    expect(as("manager").can("update", subject("person", { id: ME }))).toBe(false);
    for (const role of LADDER) {
      expect(as(role).can("update", subject("progress", { personId: ME })), role).toBe(false);
    }
  });

  it("D21: a member cannot change work after a review passed it", () => {
    const m = as("member");
    for (const type of ["work-item", "contribution"] as const) {
      expect(m.can("update", subject(type, { personId: ME, status: "submitted" }))).toBe(true);
      expect(m.can("update", subject(type, { personId: ME, status: "not_yet" }))).toBe(true);
      expect(m.can("update", subject(type, { personId: ME, status: "passed" }))).toBe(false);
    }
  });

  it("D22: a member cannot write on another person's record", () => {
    const m = as("member");
    for (const type of ["work-item", "contribution"] as const) {
      expect(m.can("create", subject(type, { personId: OTHER }))).toBe(false);
      expect(m.can("update", subject(type, { personId: OTHER, status: "submitted" }))).toBe(false);
    }
    expect(m.can("create", subject("test-result", { personId: OTHER, levelId: MY_LEVEL }))).toBe(false);
    expect(m.can("create", subject("test-result", { personId: ME, levelId: "lvl_x" }))).toBe(false);
    expect(m.can("create", subject("test-result", { personId: ME, levelId: MY_LEVEL }))).toBe(true);
    expect(m.can("mark-topic", subject("progress", { personId: OTHER, status: "active" }))).toBe(false);
    expect(m.can("mark-topic", subject("progress", { personId: ME, status: "completed" }))).toBe(false);
  });

  it("D23: a manager cannot add people, deactivate them or give roles", () => {
    const a = as("manager");
    expect(a.can("create", subject("person", { id: "new" }))).toBe(false);
    expect(a.can("update", subject("person", { id: OTHER }))).toBe(false);
    expect(a.can("deactivate", subject("person", { id: OTHER }))).toBe(false);
    expect(a.can("assign-role", subject("person", { id: OTHER }))).toBe(false);
    expect(as("owner").can("assign-role", subject("person", { id: OTHER }))).toBe(true);
    expect(as("owner").can("create", subject("person", { id: "new" }))).toBe(true);
  });

  it("D24: nobody edits or deletes a test result, review, certification or promotion", () => {
    for (const role of LADDER) {
      for (const type of ["test-result", "review", "certification", "promotion"] as const) {
        for (const action of ["update", "delete"] as const) {
          expect(as(role).can(action, subject(type, { personId: OTHER })), `${role} ${action} ${type}`).toBe(false);
        }
      }
      for (const type of ["person", "work-item", "contribution"] as const) {
        expect(as(role).can("delete", subject(type, { id: OTHER, personId: OTHER })), `${role} delete ${type}`).toBe(false);
      }
    }
  });

  it("D25: the owner cannot deactivate the owner or change the owner's role", () => {
    const o = as("owner");
    expect(o.can("deactivate", subject("person", { id: ME }))).toBe(false);
    expect(o.can("assign-role", subject("person", { id: ME }))).toBe(false);
    expect(o.can("deactivate", subject("person", { id: OTHER }))).toBe(true);
  });
});
