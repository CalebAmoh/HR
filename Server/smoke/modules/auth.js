/** Auth module — the harness already logged in; verify /me and token refresh work. */
module.exports.run = async (t) => {
  const { api } = t;
  const me = await api.get('/me');
  t.check('GET /me → 200', me.status === 200, { status: me.status, msg: me.body?.message });
  t.check('  /me returns a user + userType', !!me.body?.data && ('userType' in me.body.data), Object.keys(me.body?.data || {}).slice(0, 6));
  // refresh-token uses an httpOnly cookie; without it we expect a clean 401 (not a crash)
  const rt = await api.get('/user/refresh-token');
  t.check('GET /user/refresh-token responds (200 or 401)', [200, 401].includes(rt.status), { status: rt.status });
};
