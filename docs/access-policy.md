# Access policy

Status: first draft. The rules are proposed. The project owner has not agreed them yet.
The open questions are at the end of this file.

This file says who may do what in Trajectory. It is the source for every access check
in the code. Each permission in the code must trace to a rule id in this file.

Rule ids are permanent. Do not renumber them. If a rule goes away, retire its id and
leave the row in place.

## Scope

- Trajectory is a REST API with an MCP server on top. It has no screen of its own.
- One install serves one company. All people in an install are in the same company.
- This file covers the rules only. It does not choose the stack or the code that
  enforces the rules.

## Who uses this

| Role | The job | Limits |
|------|---------|--------|
| Member | Climbs the ladder. Learns topics, takes tests, submits work items and contributions. | Sees and acts on their own record only. |
| Manager | Builds the ladder and approves progress. Holds four capabilities: band builder, level builder, reviewer, promoter. | Cannot review, certify, promote or set pay for their own record. Cannot grant roles. |
| Owner | Answers for the install. Adds people and grants the Manager role. Holds all that a Manager holds. | One per install. Cannot review, certify, promote or set pay for their own record. |

Notes on the roles:

- Each person holds one role only.
- The roles form a ladder: Owner, then Manager, then Member. A role never holds a
  permission that the role above it lacks.
- A Manager and the Owner can also climb the ladder. Each has their own record, and on
  that record they have the rights of a Member and no more.
- The Owner role is a proposal. The project owner named Member and Manager only. Some
  role must be able to grant Manager, and one Owner per install is the smallest answer.
  See open question Q1.
- The four Manager capabilities are four groups of permissions on one role. They are
  not four roles. See open question Q2.

## The rules

### General

| Id | Rule |
|----|------|
| P1 | Anything this policy does not allow is refused. |
| P2 | Every request must come from a signed-in person. A request with no known person is refused. Nothing is public. |
| P3 | Each person holds exactly one role: Member, Manager or Owner. A new person is a Member. |
| P4 | Every check is made on the server, against the record that is asked for. The role alone does not decide. |
| P5 | The MCP server acts as the signed-in person. It holds no rights of its own and can never do more than that person can do through the REST API. |

### The ladder

| Id | Rule |
|----|------|
| P6 | Every signed-in person may read the ladder: ladders, pay bands, levels and topics. This read does not include pay amounts. |
| P7 | Only a Manager may create, change or remove a ladder or a pay band. This is the band builder capability. |
| P8 | Only a Manager may create, change or remove a level, a topic or a test. This is the level builder capability. |
| P9 | A Member may read the pay range of their own current pay band and the recommended pay of their own current level. A Member is refused the pay amounts of every other pay band and level. A Manager may read all pay amounts. |

### Tests

| Id | Rule |
|----|------|
| P10 | A Member may read the questions of a test only when the test belongs to their own current level. |
| P11 | The answer key of a test is for Managers only. It is never sent to a Member in any response. This includes the test, the test result and the review. |
| P12 | A Member may take a test for their own current level. The test result belongs to that Member. |

### A person's own record

| Id | Rule |
|----|------|
| P13 | A Member may read their own person record, pay, progress, test results, work items, contributions, reviews, certifications and promotions. |
| P14 | A Member never reads another person's person record, pay, progress, test results, work items, contributions, reviews, certifications or promotions. |
| P15 | A Member may mark topics as learned on their own progress. A Member cannot change any other part of their progress. |
| P16 | A Member may create work items and contributions on their own record. A Member may change one of them until a review passes it. After a pass, it cannot be changed. |

### Managers

| Id | Rule |
|----|------|
| P17 | A Manager may read every person's record, pay, progress, test results, work items, contributions, reviews, certifications and promotions. |
| P18 | A Manager may give a review (pass or not yet) on another person's test result, work item or contribution. This is the reviewer capability. |
| P19 | A Manager may promote another person, set that person's actual pay, and issue or revoke that person's certification. This is the promoter capability. |
| P20 | No person reviews, certifies, promotes or sets pay for their own record. This applies to the Member, the Manager and the Owner. Another Manager or the Owner must do it. |
| P21 | On their own record, a Manager or the Owner has the rights of a Member and no more. |
| P22 | A person's level and actual pay change only through a promotion. No other request can change them. |
| P23 | A test result, review, certification or promotion is never edited or deleted. A wrong record is corrected by a new record. To revoke a certification is to mark it as revoked, not to delete it. |

### The Owner

| Id | Rule |
|----|------|
| P24 | A company space has exactly one Owner. The Owner is the person who created the space. The Owner holds every permission that a Manager holds. |
| P25 | Only the Owner may add a person, change a person's details, deactivate a person, and grant or remove the Manager role. |
| P26 | Nobody can remove the Owner role from the Owner or deactivate the Owner. This includes the Owner. |
| P27 | A deactivated person cannot sign in and holds no permissions. Their records are kept. |

### Certifications and records

| Id | Rule |
|----|------|
| P28 | A certification is private. Only the person it belongs to and Managers may read it. There is no public link. |
| P29 | Every review, promotion, pay change, certification and role change records who did it and when. |

### Company spaces

| Id | Rule |
|----|------|
| P30 | Every ladder and every person belongs to one company space. A person can never read or change anything of another space. This holds for every role, the Owner included. The reply is "not found", so the person cannot learn that the object exists. |
| P31 | Each space has its own subdomain. On a space subdomain, only the people of that space can sign in. |
| P32 | Every person may read their own space: its name and its subdomain name. |
| P33 | Only the Owner may change the name of the space. The subdomain name does not change. |
| P34 | Sign-up is the one request that needs no sign-in. A new user makes a space and becomes its Owner. An install can close sign-up. |

## Deny cases

Each row is a refusal that must have its own test. The enforcement stage must not ship
a rule from this table without the test.

| Id | Who | Tries to | Result | Rule |
|----|-----|----------|--------|------|
| D1 | No signed-in person | Make any request | Refused | P2 |
| D2 | Member | Read another person's pay | Refused | P14 |
| D3 | Member | Read another person's progress | Refused | P14 |
| D4 | Member | Read another person's test results | Refused | P14 |
| D5 | Member | Read another person's reviews | Refused | P14 |
| D6 | Member | Read another person's promotions | Refused | P14 |
| D7 | Member | Read another person's work items, contributions or certifications | Refused | P14, P28 |
| D8 | Member | Read another person's person record, or list all people | Refused | P14 |
| D9 | Member | Give a review on their own test result, work item or contribution | Refused | P18, P20 |
| D10 | Member | Give a review on another person's record | Refused | P18 |
| D11 | Member | Promote themselves, set their own pay or issue their own certification | Refused | P19, P20 |
| D12 | Manager | Give a review on their own test result, work item or contribution | Refused | P20 |
| D13 | Manager | Promote themselves, set their own pay, or issue or revoke their own certification | Refused | P20 |
| D14 | Owner | Review, certify, promote or set pay for their own record | Refused | P20 |
| D15 | Member | Read the pay range of a pay band that is not their own current band | Refused | P9 |
| D16 | Member | Read the recommended pay of a level that is not their own current level | Refused | P9 |
| D17 | Member | Read the answer key of any test | Refused | P11 |
| D18 | Member | Read the questions of a test that is not for their own current level | Refused | P10 |
| D19 | Member | Create, change or remove a ladder, pay band, level, topic or test | Refused | P7, P8 |
| D20 | Member | Change their own level or pay by any request | Refused | P15, P22 |
| D21 | Member | Change a work item or contribution after a review passed it | Refused | P16 |
| D22 | Member | Create or change a work item, contribution or test result on another person's record | Refused | P12, P16 |
| D23 | Manager | Grant or remove the Manager role, or add or deactivate a person | Refused | P25 |
| D24 | Manager | Edit or delete a test result, review, certification or promotion | Refused | P23 |
| D25 | Anyone | Remove the Owner role from the Owner or deactivate the Owner | Refused | P26 |
| D26 | Deactivated person | Make any request | Refused | P27 |
| D27 | Anyone | Read a certification through a public link | Refused | P2, P28 |
| D28 | A person through the MCP server | Do something the REST API refuses for that person | Refused | P5 |
| D29 | Anyone, the Owner included | Read or change a ladder, a person or a record of another company space | Refused | P30 |
| D30 | Manager | Promote a person to a level of another space | Refused | P30 |
| D31 | A person of one space | Sign in on the subdomain of another space | Refused | P31 |
| D32 | Member, Manager | Change the name of the space | Refused | P33 |

## What is protected

One install serves many companies. Each company has a space. A ladder and a person carry the id of their space, and every other object belongs to a ladder or to a person. The one decision point finds the space of each row and refuses a row of another space (P30).

"Belongs to" has two values in this file:

- **company** - the row is shared by the whole install. Access depends on the role.
- **person** - the row is about one person. Access depends on the role and on whether
  the caller is that person.

| Object | Belongs to | Owner field | Notes |
|--------|------------|-------------|-------|
| ladder | company | none today | Readable by every signed-in person. |
| pay-band | company | none today | The pay range is a guarded part. See P9. |
| level | company | none today | The recommended pay is a guarded part. See P9. |
| topic | company | none today | |
| test | company | none today | The answer key is a guarded part. See P11. |
| person | person | `id` | The row is the person. Holds the role and the current actual pay. |
| progress | person | `person_id` | A person at a level. |
| test-result | person | `person_id` | The person who took the test. |
| work-item | person | `person_id` | The person who submitted it. |
| contribution | person | `person_id` | The person who submitted it. |
| review | person | `person_id` | The person who is reviewed. The reviewer is in `reviewer_id`, and it must not equal `person_id`. |
| certification | person | `person_id` | The person who is certified. The issuer is in `issued_by`, and it must not equal `person_id`. |
| promotion | person | `person_id` | The person who is promoted. The promoter is in `promoted_by`, and it must not equal `person_id`. |

The field names are proposals. The schema does not exist yet.

## Permissions

Every name is `object:action`. Each one traces to a rule id.

| Permission | What it allows | Rule |
|------------|----------------|------|
| `ladder:read` | Read a ladder | P6 |
| `ladder:create` | Create a ladder | P7 |
| `ladder:update` | Change a ladder | P7 |
| `ladder:delete` | Remove a ladder | P7 |
| `pay-band:read` | Read a pay band, without pay amounts | P6 |
| `pay-band:read-pay` | Read the pay range of a pay band | P9 |
| `pay-band:create` | Create a pay band | P7 |
| `pay-band:update` | Change a pay band | P7 |
| `pay-band:delete` | Remove a pay band | P7 |
| `level:read` | Read a level, without pay amounts | P6 |
| `level:read-pay` | Read the recommended pay of a level | P9 |
| `level:create` | Create a level | P8 |
| `level:update` | Change a level | P8 |
| `level:delete` | Remove a level | P8 |
| `topic:read` | Read a topic | P6 |
| `topic:create` | Create a topic | P8 |
| `topic:update` | Change a topic | P8 |
| `topic:delete` | Remove a topic | P8 |
| `test:read` | Read the questions of a test | P10 |
| `test:read-answer-key` | Read the answer key of a test | P11 |
| `test:create` | Create a test | P8 |
| `test:update` | Change a test | P8 |
| `test:delete` | Remove a test | P8 |
| `person:read` | Read a person record, without pay | P13, P14, P17 |
| `person:read-pay` | Read a person's actual pay | P13, P14, P17 |
| `person:create` | Add a person | P25 |
| `person:update` | Change a person's details | P25 |
| `person:deactivate` | Deactivate a person | P25, P26 |
| `person:assign-role` | Grant or remove the Manager role | P25, P26 |
| `progress:read` | Read a person's progress | P13, P14, P17 |
| `progress:mark-topic` | Mark a topic as learned | P15 |
| `test-result:create` | Take a test | P12 |
| `test-result:read` | Read a test result | P13, P14, P17 |
| `work-item:create` | Submit a work item | P16 |
| `work-item:read` | Read a work item | P13, P14, P17 |
| `work-item:update` | Change a work item | P16 |
| `contribution:create` | Submit a contribution | P16 |
| `contribution:read` | Read a contribution | P13, P14, P17 |
| `contribution:update` | Change a contribution | P16 |
| `review:create` | Give a review: pass or not yet | P18, P20 |
| `review:read` | Read a review | P13, P14, P17 |
| `certification:read` | Read a certification | P13, P14, P17, P28 |
| `certification:create` | Issue a certification | P19, P20 |
| `certification:revoke` | Revoke a certification | P19, P20, P23 |
| `promotion:create` | Promote a person and set the actual pay | P19, P20, P22 |
| `promotion:read` | Read a promotion | P13, P14, P17 |

There is no permission to edit or delete a test result, review, certification or
promotion (P23). There is no permission to delete a person, work item or contribution.
With default deny (P1), those actions are refused for every role.

## Roles and permissions

How to read the table:

- **any** - on any row.
- **own** - only on rows that belong to the caller.
- **own current** - only for the caller's own current pay band or level.
- **others** - on any row except rows that belong to the caller.
- **any; own as Member** - on any row, but on the caller's own rows only what a Member may do.
- **-** - refused.

| Permission | Member | Manager | Owner | Capability |
|------------|--------|---------|-------|------------|
| `ladder:read` | any | any | any | |
| `ladder:create` | - | any | any | band builder |
| `ladder:update` | - | any | any | band builder |
| `ladder:delete` | - | any | any | band builder |
| `pay-band:read` | any | any | any | |
| `pay-band:read-pay` | own current | any | any | |
| `pay-band:create` | - | any | any | band builder |
| `pay-band:update` | - | any | any | band builder |
| `pay-band:delete` | - | any | any | band builder |
| `level:read` | any | any | any | |
| `level:read-pay` | own current | any | any | |
| `level:create` | - | any | any | level builder |
| `level:update` | - | any | any | level builder |
| `level:delete` | - | any | any | level builder |
| `topic:read` | any | any | any | |
| `topic:create` | - | any | any | level builder |
| `topic:update` | - | any | any | level builder |
| `topic:delete` | - | any | any | level builder |
| `test:read` | own current | any | any | |
| `test:read-answer-key` | - | any | any | level builder, reviewer |
| `test:create` | - | any | any | level builder |
| `test:update` | - | any | any | level builder |
| `test:delete` | - | any | any | level builder |
| `person:read` | own | any | any | |
| `person:read-pay` | own | any | any | |
| `person:create` | - | - | any | |
| `person:update` | - | - | any | |
| `person:deactivate` | - | - | others | |
| `person:assign-role` | - | - | others | |
| `progress:read` | own | any | any | |
| `progress:mark-topic` | own | own | own | |
| `test-result:create` | own | own | own | |
| `test-result:read` | own | any | any | |
| `work-item:create` | own | own | own | |
| `work-item:read` | own | any | any | |
| `work-item:update` | own | own | own | |
| `contribution:create` | own | own | own | |
| `contribution:read` | own | any | any | |
| `contribution:update` | own | own | own | |
| `review:create` | - | others | others | reviewer |
| `review:read` | own | any | any | |
| `certification:read` | own | any | any | |
| `certification:create` | - | others | others | promoter |
| `certification:revoke` | - | others | others | promoter |
| `promotion:create` | - | others | others | promoter |
| `promotion:read` | own | any | any | |

## What is not settled yet

- **Sign-in.** This policy needs the server to know who the caller is. Nothing in the
  project does that yet. The rules can be agreed now. They cannot be enforced until
  sign-in exists.
- **The data layer.** The stack is not chosen. There is no schema and no single place
  where a check can sit. The object list and owner fields above are a plan, not a
  reading of real tables.
- **The roles.** Roles are a business decision. The table above is a proposal until
  the project owner agrees it.
- **Enforcement.** Trajectory is an API service, so the rules will run as one policy
  with one decision point, not as checks inside each route. That work starts only after
  this file is agreed.

## Open questions

Each question shows the default this draft uses. The defaults are the cautious choice
unless the note says otherwise.

| Id | Question | Default in this draft |
|----|----------|-----------------------|
| Q1 | Who grants the Manager role? | Settled. A third role, Owner. One per company space, held by the person who created the space. Holds all Manager permissions and is the only role that adds people and grants Manager (P24, P25). |
| Q2 | Are the four Manager capabilities always held together, or can a person hold only some of them (for example reviewer but not promoter)? | Held together. One Manager role holds all four. The capability column in the role table shows where to split later. |
| Q3 | Is an org or tenant boundary needed? | Settled. One install serves many companies, and each company has a space with its own subdomain (P30 to P34). |
| Q4 | Does a Manager see and act on every person in the install, or only on the people who report to them? | Every person (P17). This is not the cautious choice. There is no team or reporting-line object in the object list, so there is nothing to narrow by. It means every Manager can read every person's pay. |
| Q5 | May a Member read recommended pay and pay ranges for the whole ladder? | No. A Member sees pay for their own current band and level only (P9). So a Member cannot see what the next level pays. That may weaken the "visible path" goal in the README. |
| Q6 | May certifications be public, for example a link a person can share? | No. Private (P28). A public certification needs its own rule: what the public view shows, and who turns it on. |
| Q7 | A Manager who also climbs the ladder can read the answer key of their own next test. Is that acceptable? | Accepted for now. The answer key stays Manager-only (P11), and another Manager must still review the result (P20). The key is not hidden from a Manager for their own level. |
| Q8 | What if the Owner is the only Manager? Nobody can review or promote the Owner (P20). | The Owner's own climb is blocked until a second Manager exists. The self-review rule is not relaxed. |
| Q9 | How is the Owner role moved to another person, and what if the Owner leaves? | Not allowed in this draft (P26). There is no transfer permission. It needs a rule before the first real install. |
| Q10 | Who adds people to the install? | The Owner only (P25). This can be slow in a larger company. The other choice is to let Managers add Members. |
| Q11 | How does a person get their first level and starting pay? | A Manager records it as a promotion with no previous level (`promotion:create`). There is no separate placement permission. |
| Q12 | May a Member read a test before they reach that level? | No. Only tests for their own current level (P10). Topics for all levels stay readable (P6). |
| Q13 | May a Member see anything about other people, for example names, levels or certifications of teammates? | No. Nothing (P14). A team directory or a leaderboard needs a new rule. |
| Q14 | May a work item or contribution be withdrawn or deleted? May a wrong review or promotion be undone? | No deletes. A wrong record is corrected by a new record (P23). A demotion or a pay cut has no rule yet. |
| Q15 | Is a read-only role needed, for example for HR, finance or an auditor? | No. Three roles only. |
| Q16 | Will a program need to call the API with no person behind it, for example a payroll export or a service key? | No. Every call acts as a signed-in person (P2, P5). API keys that the app issues have no owner in the current plan and need a decision first. |
| Q17 | May a person change their own details, such as their name? | No. Only the Owner changes a person's details (P25). |
| Q18 | Who may read the record of who did what (P29)? | Managers, as part of each record. There is no separate audit log object and no permission for one. |
| Q19 | Which capability creates a ladder? | Band builder (P7). Both builder capabilities sit on the Manager role, so this matters only if Q2 splits them. |
