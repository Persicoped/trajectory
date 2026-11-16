# API design

This page describes the REST API for Trajectory and the MCP server on top of it.

The object names come from [objects.md](objects.md). The permissions come from [access-policy.md](access-policy.md).

## Design rules

1. The API is the only way in. The MCP server calls the API. It does not read the database.
2. Every path starts with `/v1`.
3. A path names a thing, not an action. Use plural nouns in kebab-case: `/v1/pay-bands`.
4. The HTTP method is the action: `GET` reads, `POST` creates, `PATCH` changes, `DELETE` removes.
5. Each object has one home path: `/v1/levels/{id}`. A nested path is only for a list or a create under a parent: `/v1/pay-bands/{id}/levels`.
6. Bodies are JSON. Field names use `snake_case`. Ids are UUIDs. Dates use ISO 8601 in UTC.
7. Money is an integer number of cents with a currency code: `"rate_cents": 2500, "currency": "USD"`.
8. A list returns pages: `?limit=50&cursor=...`. The reply has `data` and `next_cursor`.
9. An error uses the `application/problem+json` format, with `type`, `title`, `status` and `detail`.
10. The API checks access on every request, in one place. The default is deny.
11. When a person may not see an object, the API returns `404`, not `403`. This does not reveal that the object exists.
12. History objects (Review, Certification, Promotion) have no `PATCH` and no `DELETE`.

## Roles

There are three roles: Member, Manager and Owner. A person has one role. The person who creates a company space is its Owner. The Owner can do everything a Manager can do, so "Manager" in the tables below also means the Owner. A Manager or the Owner can also climb the ladder. On their own record they have Member rights only.

## Sign-in

The system is headless, so there is no sign-in page of its own.

- **People** sign in through the company's identity provider with OAuth 2.1 and OpenID Connect. The MCP server uses the standard MCP authorization flow.
- **Scripts** use a personal access token that a person makes for their own account. A token can never do more than its owner.
- Every request carries `Authorization: Bearer <token>`.
- The token says who the person is. The API reads the person's roles from its own database, not from the token.

## Company spaces

One install serves many companies. Each company has a space, and each space has a subdomain: `acme.trajectory.example`. Set `TRAJECTORY_BASE_DOMAIN` to the part after the space name.

- A token belongs to one person, and a person belongs to one space. So a token reaches one space only.
- On a space subdomain, a token of another space is refused with `401`.
- An object of another space gives `404`, for every role.

| Method and path | What it does | Who |
|---|---|---|
| `POST /v1/spaces` | Sign up: make a space and its Owner. The reply holds the token, one time. | Anyone. No token. |
| `GET /v1/space` | Read your own space | Member, Manager, Owner |
| `PATCH /v1/space` | Change the name of your space | Owner |

A sign-up body has `name`, `slug`, `owner_name` and `owner_email`. The slug has 3 to 32 lowercase letters, digits or hyphens. Set `TRAJECTORY_SIGNUP=closed` to stop sign-up.

## Paths

### The ladder

| Method and path | What it does | Who |
|---|---|---|
| `GET /v1/ladders` | List ladders | Member, Manager |
| `POST /v1/ladders` | Create a ladder | Manager |
| `GET /v1/ladders/{id}` | Read a ladder | Member, Manager |
| `PATCH /v1/ladders/{id}` | Change a ladder | Manager |
| `GET /v1/ladders/{id}/pay-bands` | List the pay bands in a ladder | Member, Manager |
| `POST /v1/ladders/{id}/pay-bands` | Create a pay band | Manager (band builder) |
| `GET /v1/pay-bands/{id}` | Read a pay band | Member, Manager |
| `PATCH /v1/pay-bands/{id}` | Change a pay band | Manager (band builder) |
| `GET /v1/pay-bands/{id}/levels` | List the levels in a pay band | Member, Manager |
| `POST /v1/pay-bands/{id}/levels` | Create a level | Manager (level builder) |
| `GET /v1/levels/{id}` | Read a level | Member, Manager |
| `PATCH /v1/levels/{id}` | Change a level | Manager (level builder) |
| `GET /v1/levels/{id}/topics` | List the topics in a level | Member, Manager |
| `POST /v1/levels/{id}/topics` | Create a topic | Manager (level builder) |
| `GET /v1/topics/{id}` | Read a topic | Member, Manager |
| `PATCH /v1/topics/{id}` | Change a topic | Manager (level builder) |
| `GET /v1/topics/{id}/tests` | List the tests for a topic | Member (own current level only), Manager |
| `POST /v1/topics/{id}/tests` | Create a test | Manager (level builder) |
| `GET /v1/tests/{id}` | Read a test. A member does not get the answer key. | Member (own current level only), Manager |
| `PATCH /v1/tests/{id}` | Change a test | Manager (level builder) |

A member sees pay only for their own pay band and level. For other bands and levels, the API leaves the pay fields out.

Each ladder object also has a `DELETE` path for a manager. `DELETE` works only when no person has used the object. After that, a manager sets its `status` to `retired`.

### People

| Method and path | What it does | Who |
|---|---|---|
| `GET /v1/me` | Read your own record | Member, Manager |
| `GET /v1/people` | List people | Manager, Owner |
| `POST /v1/people` | Add a person | Owner |
| `GET /v1/people/{id}` | Read a person | Self, Manager, Owner |
| `PATCH /v1/people/{id}` | Change a person's name or email | Owner |
| `PUT /v1/people/{id}/role` | Give or remove the Manager role | Owner, not on own record |
| `POST /v1/people/{id}/deactivation` | Stop a person's access. The record stays. | Owner, not on own record |

### Progress

| Method and path | What it does | Who |
|---|---|---|
| `GET /v1/people/{id}/progress` | List a person's progress, newest first | Self, Manager |
| `GET /v1/progress/{id}` | Read one progress record, with what is done and what is left | Self, Manager |
| `POST /v1/progress/{id}/topics/{topic_id}/completion` | Mark a topic as learned | Self |
| `GET /v1/progress/{id}/test-results` | List test attempts | Self, Manager |
| `POST /v1/progress/{id}/test-results` | Submit answers to a test. The system scores them. | Self |
| `GET /v1/progress/{id}/work-items` | List work items | Self, Manager |
| `POST /v1/progress/{id}/work-items` | Submit a work item | Self |
| `GET /v1/progress/{id}/contributions` | List contributions | Self, Manager |
| `POST /v1/progress/{id}/contributions` | Submit a contribution | Self |
| `GET /v1/work-items/{id}` | Read a work item | Self, Manager |
| `PATCH /v1/work-items/{id}` | Change a work item before its review | Self |
| `GET /v1/contributions/{id}` | Read a contribution | Self, Manager |
| `PATCH /v1/contributions/{id}` | Change a contribution before its review | Self |

The system creates the first Progress when a manager adds a person to a ladder. It creates the next Progress when a Promotion is made.

### Reviews, certifications and promotions

| Method and path | What it does | Who |
|---|---|---|
| `POST /v1/work-items/{id}/reviews` | Decide on a work item: `passed` or `not_yet` | Manager (reviewer), not on own record |
| `POST /v1/contributions/{id}/reviews` | Decide on a contribution | Manager (reviewer), not on own record |
| `POST /v1/test-results/{id}/reviews` | Decide on the talk-through review of a test | Manager (reviewer), not on own record |
| `GET /v1/reviews/{id}` | Read a review | Subject person, Manager |
| `GET /v1/people/{id}/certifications` | List a person's certifications | Self, Manager |
| `POST /v1/certifications/{id}/revocation` | Revoke a certification. The record stays. | Manager, not on own record |
| `GET /v1/people/{id}/promotions` | List a person's promotions | Self, Manager |
| `POST /v1/people/{id}/promotions` | Promote a person to the next level and set the new rate | Manager (promoter), not on own record |

A promotion is one request that does three things together: it completes the current Progress, it creates the Certifications for the level, and it starts the next Progress. If any check fails, nothing changes and the reply says which check failed.

The checks are:

1. All required tests are passed and reviewed.
2. The work items are approved.
3. One contribution is approved.
4. The minimum duration of the level is met.
5. The new rate is inside the range of the pay band.

## MCP tools

The MCP server is a thin layer. Each tool calls the API with the caller's own token, so the same access rules apply. The server runs on standard input and output. The code is in `mcp/`.

| Tool | API call |
|---|---|
| `my_status` | `GET /v1/me` |
| `my_space` | `GET /v1/space` |
| `rename_space` | `PATCH /v1/space` |
| `list_ladders` | `GET /v1/ladders` |
| `show_ladder` | `GET /v1/ladders/{id}`, its pay bands and their levels |
| `show_level` | `GET /v1/levels/{id}`, its topics and their tests |
| `mark_topic_learned` | `POST /v1/progress/{id}/topics/{topic_id}/completion` |
| `get_test` | `GET /v1/tests/{id}` |
| `submit_test` | `POST /v1/progress/{id}/test-results` |
| `submit_work` | `POST /v1/progress/{id}/work-items` |
| `submit_contribution` | `POST /v1/progress/{id}/contributions` |
| `list_people` | `GET /v1/people` |
| `show_person` | `GET /v1/people/{id}`, with progress, certifications and promotions |
| `add_person` | `POST /v1/people` |
| `set_role` | `PUT /v1/people/{id}/role` |
| `review` | `POST .../reviews` on a work item, a contribution or a test result |
| `promote` | `POST /v1/people/{id}/promotions` |
| `build_ladder` | `POST /v1/ladders` |
| `build_pay_band` | `POST /v1/ladders/{id}/pay-bands` |
| `build_level` | `POST /v1/pay-bands/{id}/levels` |
| `build_topic` | `POST /v1/levels/{id}/topics` |
| `build_test` | `POST /v1/topics/{id}/tests` |

A tool that acts on "your" level finds your current progress from `GET /v1/me`. The first `promote` for a new person puts that person on their first level.

## Open questions

The full list of 19 open questions is in [access-policy.md](access-policy.md). The ones that change this API the most are:

1. Can a member see the pay for levels above their own? Seeing the path ahead can motivate people. The default here is no.
2. Does a manager see everyone's pay, or only the pay of their own reports? The default here is everyone.
3. Can a certification be public, for a profile page?
4. What happens after a `not_yet` review: a wait time, or a limit on attempts?
