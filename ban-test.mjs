// Stack: Node 22 | File: ban-test.mjs
// Runs the six checks behind the article's table, with client keys only.
//
//   cp .env.example .env     # PARSE_APP_ID, PARSE_REST_KEY, PARSE_MASTER_KEY
//   node --env-file=.env ban-test.mjs
//
// The master key is used for exactly one thing — setting and clearing the ban,
// which is what an admin tool would do. Every check that stands in for a user's
// device uses the application id and REST key, because the master key bypasses
// triggers and a test that uses it proves nothing.

const PARSE = 'https://parseapi.back4app.com';
const { PARSE_APP_ID, PARSE_REST_KEY, PARSE_MASTER_KEY } = process.env;

if (!PARSE_APP_ID || !PARSE_REST_KEY || !PARSE_MASTER_KEY) {
  console.error('set PARSE_APP_ID, PARSE_REST_KEY and PARSE_MASTER_KEY first');
  process.exit(1);
}

const asClient = {
  'X-Parse-Application-Id': PARSE_APP_ID,
  'X-Parse-REST-API-Key': PARSE_REST_KEY,
  'Content-Type': 'application/json',
};
const asServer = {
  'X-Parse-Application-Id': PARSE_APP_ID,
  'X-Parse-Master-Key': PARSE_MASTER_KEY,
  'Content-Type': 'application/json',
};

const body = async (res) => {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
};

const USERNAME = `ban-test-${Date.now()}`;
const PASSWORD = 'demo-pass-2026';

const line = (label, res, extra = '') =>
  console.log(`${label.padEnd(44)} ${String(res.status).padEnd(4)} ${extra}`);

// --- the steps -------------------------------------------------------------

const signUp = async () => {
  const res = await fetch(`${PARSE}/users`, {
    method: 'POST', headers: asClient,
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });
  const b = await body(res);
  line('sign up', res);
  return b.objectId;
};

const logIn = async () => {
  const q = new URLSearchParams({ username: USERNAME, password: PASSWORD });
  const res = await fetch(`${PARSE}/login?${q}`, {
    headers: { ...asClient, 'X-Parse-Revocable-Session': '1' },
  });
  const b = await body(res);
  line('log in', res, res.status === 200 ? 'session issued' : JSON.stringify(b));
  return b.sessionToken;
};

const setBanned = async (objectId, value) => {
  const res = await fetch(`${PARSE}/users/${objectId}`, {
    method: 'PUT', headers: asServer, body: JSON.stringify({ isBanned: value }),
  });
  line(`server sets isBanned=${value}`, res);
};

const useSession = async (token) => {
  const res = await fetch(`${PARSE}/users/me`, {
    headers: { ...asClient, 'X-Parse-Session-Token': token },
  });
  const b = await body(res);
  line('old session on /users/me', res,
    res.status === 200 ? 'STILL VALID' : JSON.stringify(b));
};

const clientWritesFlag = async (token, objectId, value) => {
  const res = await fetch(`${PARSE}/users/${objectId}`, {
    method: 'PUT',
    headers: { ...asClient, 'X-Parse-Session-Token': token },
    body: JSON.stringify({ isBanned: value }),
  });
  const b = await body(res);
  line(`client sets isBanned=${value} on itself`, res,
    res.status === 200 ? 'WRITTEN' : JSON.stringify(b));
};

const cleanUp = async (objectId) => {
  await fetch(`${PARSE}/users/${objectId}`, { method: 'DELETE', headers: asServer });
  console.log('\ntest user deleted');
};

// --- the run ---------------------------------------------------------------

console.log(`${'check'.padEnd(44)} code reply\n${'-'.repeat(78)}`);

const objectId = await signUp();
const token = await logIn();

await clientWritesFlag(token, objectId, true);   // expect 400 with the three triggers
await setBanned(objectId, true);
await logIn();                                   // expect 400 / 141
await useSession(token);                         // expect 400 / 209 once sessions are revoked
await setBanned(objectId, false);
await logIn();                                   // expect 200 again

await cleanUp(objectId);
