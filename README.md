# ban-users-cloud-code

[![Deploy on Back4app](https://img.shields.io/badge/Deploy%20on-Back4app-1568B8?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iI2ZmZiIgZD0iTTEyIDJMMiA3djEwbDEwIDUgMTAtNVY3eiIvPjwvc3ZnPg==)](https://www.back4app.com/signup?utm_source=github&utm_medium=repo&utm_campaign=ban-users-cloud-code)

**Three Cloud Code triggers that make a user ban stick: refuse the next login, end the sessions already open, and refuse to be undone by the person it applies to.**  One boolean on the user record is the data model; the triggers are what turn it into a rule. Nothing to provision, patch or keep running.

Measured on a free Back4app backend: blocking the login returns `400 / 141`, a session taken before the ban then returns `400 / 209`, and a client trying to clear its own flag returns `400 / 141`. `ban-test.mjs` reproduces all six checks in one run.

> **Read the article:** [How to Ban and Unban Users in Your App, and Make the Ban Stick](https://www.back4app.com/blog/ban-and-unban-users-from-your-app?utm_source=github&utm_medium=repo&utm_campaign=ban-users-cloud-code)

## What it does

`cloud/main.js` holds the three triggers:

| Trigger | What it closes |
| --- | --- |
| `beforeLogin` | runs before a session token exists, so a banned account never receives one |
| `afterSave(Parse.User)` | on the transition into banned, destroys every row in `_Session` for that user |
| `beforeSave(Parse.User)` | refuses a changed `isBanned` unless the request carries the master key |

Without the second, a banned user stays signed in until they happen to log out — weeks, on a mobile app. Without the third, that same user can write `isBanned: false` to their own record and let themselves back in.

## What we measured

| Check | One trigger | Three triggers |
| --- | --- | --- |
| Login while banned | `400 / 141` | `400 / 141` |
| Session taken before the ban | **`200` — still valid** | `400 / 209` |
| Client changing its own `isBanned` | **`200` — written** | `400 / 141` |

How we measured: every request that stands in for a user's device carries the application id and REST key only. The master key appears once, to set and clear the flag the way an admin tool would — a test that uses it everywhere bypasses the triggers and proves nothing.

## Files

- `cloud/main.js` — the three triggers, ready to paste into Cloud Code.
- `ban-test.mjs` — the six checks, no dependencies beyond Node 22. Creates its own user and deletes it at the end.
- `.env.example` — the three credentials the test needs.

## Deploy your own

1. **Create a free account.** Sign up at [https://www.back4app.com/signup?utm_source=github&utm_medium=repo&utm_campaign=ban-users-cloud-code](https://www.back4app.com/signup?utm_source=github&utm_medium=repo&utm_campaign=ban-users-cloud-code).
2. **Add the column.** Database → Browser → `_User` → add `isBanned`, type Boolean, default false.
3. **Deploy the triggers.** Cloud Code → Functions & Web Hosting → paste `cloud/main.js` into `main.js` → Deploy.
4. **Copy the keys.** App Settings → Security & Keys: the Application ID, the REST API key and the Master key.

## Run locally

```bash
cp .env.example .env      # PARSE_APP_ID, PARSE_REST_KEY, PARSE_MASTER_KEY
node --env-file=.env ban-test.mjs
```

```
check                                        code reply
------------------------------------------------------------------------------
sign up                                      201
log in                                       200  session issued
client sets isBanned=true on itself          400  {"code":141,"error":"isBanned can only be changed by the server"}
server sets isBanned=true                    200
log in                                       400  {"code":141,"error":"This user has been banned"}
old session on /users/me                     400  {"code":209,"error":"Invalid session token"}
server sets isBanned=false                   200
log in                                       200  session issued
```

Keep `.env` out of version control — it is git-ignored here, and the master key in it can read and write anything in the backend.

## What the platform gives you

A managed Parse Server with a database, REST and GraphQL APIs, Cloud Code and a dashboard, so triggers like these run on every request regardless of which client made it. Documentation: [https://www.back4app.com/docs?utm_source=github&utm_medium=repo&utm_campaign=ban-users-cloud-code](https://www.back4app.com/docs?utm_source=github&utm_medium=repo&utm_campaign=ban-users-cloud-code).

## License

MIT.
