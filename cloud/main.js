// Stack: Parse Server | File: cloud/main.js
// A ban has to do three things: refuse the next login, refuse to be undone by
// the person it applies to, and end the sessions that already exist.

// 1. The door. beforeLogin runs before a session token is issued.
Parse.Cloud.beforeLogin(async (request) => {
  if (request.object.get('isBanned')) {
    throw new Error('This user has been banned');
  }
});

// 2. The flag. Without this, a signed-in user can clear their own ban.
Parse.Cloud.beforeSave(Parse.User, async (request) => {
  if (request.master) return;              // server-side and dashboard writes
  const original = request.original;
  if (!original) return;                   // sign-up, nothing to compare
  if (request.object.get('isBanned') !== original.get('isBanned')) {
    throw new Error('isBanned can only be changed by the server');
  }
});

// 3. The sessions already out there.
Parse.Cloud.afterSave(Parse.User, async (request) => {
  const original = request.original;
  if (!original) return;
  const nowBanned = request.object.get('isBanned') === true;
  const wasBanned = original.get('isBanned') === true;
  if (!nowBanned || wasBanned) return;

  const query = new Parse.Query(Parse.Session);
  query.equalTo('user', request.object);
  const sessions = await query.find({ useMasterKey: true });
  await Parse.Object.destroyAll(sessions, { useMasterKey: true });
});
