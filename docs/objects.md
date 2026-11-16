# Objects

This page lists the objects that Trajectory stores. The API design and the access policy use these names.

## The company space

| Object | What it is |
|---|---|
| **Space** | One company. It has a name and a slug. The slug is the subdomain of the space, such as `acme` in `acme.trajectory.example`. Every ladder and every person belongs to one space. |

## The ladder

A manager builds these objects. Members can read them.

| Object | What it is | Main fields |
|---|---|---|
| Ladder | One career path for one kind of job. Example: the AI developer ladder. | name, description, status |
| Pay Band | A pay range inside a ladder. It holds levels. | ladder, name, order, minimum rate, maximum rate, minimum duration |
| Level | One step inside a pay band. | pay band, title, order, recommended rate, minimum duration |
| Topic | One thing to learn at a level. | level, name, description, required or optional |
| Test | A check that the person knows a topic. | topic, questions, pass mark |

A pay band has a minimum duration and no maximum duration. No one is forced out of a band.

The pay band sets the actual pay range. The rate on a level is a recommendation.

## One person's progress

The system makes these objects as a person climbs.

| Object | What it is | Main fields |
|---|---|---|
| Person | A user of the system. | name, email, roles, current level, current pay rate |
| Progress | One person at one level. | person, level, start date, status |
| Test Result | One attempt at a test. | progress, test, score, passed, date |
| Work Item | A piece of real work that the person delivered. | progress, title, link, status |
| Contribution | An update to the team's shared agents or skills. | progress, title, link, status |
| Review | A manager's decision on a test result, work item or contribution. | subject, reviewer, decision, notes, date |
| Certification | A skill that the company certifies for a person. | person, level, skill, date |
| Promotion | A move to a new level, with the new title and pay. | person, from level, to level, new rate, approver, date |

## Rules that the objects must obey

1. A level belongs to one pay band. A pay band belongs to one ladder.
2. A person has one active Progress at a time.
3. A Progress cannot complete before the level's minimum duration ends.
4. A Promotion needs: all required tests passed, the work items approved, one contribution approved, and the minimum duration met.
5. A new pay rate must be inside the range of the pay band.
6. A person cannot review or promote their own record.
7. The system keeps history. It does not delete a Review, a Certification or a Promotion.
8. A person, a ladder and all that hangs from them stay inside one space. An email is used one time in a space.
