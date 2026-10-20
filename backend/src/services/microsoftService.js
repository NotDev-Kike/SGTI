const config = () => ({
  tenant: process.env.MS_TENANT_ID,
  client: process.env.MS_CLIENT_ID,
  secret: process.env.MS_CLIENT_SECRET,
  redirect: process.env.MS_REDIRECT_URI || 'http://localhost:5000/api/microsoft/callback',
  loginRedirect: process.env.MS_LOGIN_REDIRECT_URI || 'http://localhost:5000/api/microsoft/login/callback',
  graph: process.env.MS_GRAPH_URL || 'https://graph.microsoft.com/v1.0'
});
const db = require('../config/db');

const configured = () => Object.values(config()).slice(0, 3).every(Boolean);

async function createAuthorizationUrl(userId) {
  if (!configured()) throw new Error('Microsoft 365 no está configurado.');
  const state = require('crypto').randomBytes(32).toString('hex');
  await db.query('INSERT INTO microsoft_oauth_states (state, usuario_id, expires_at) VALUES ($1,$2,NOW()+INTERVAL \'10 minutes\')', [state, userId]);
  const params = new URLSearchParams({ client_id: config().client, response_type: 'code', redirect_uri: config().redirect, response_mode: 'query', scope: 'openid profile offline_access User.Read Calendars.ReadWrite Mail.Read', state });
  return `https://login.microsoftonline.com/${encodeURIComponent(config().tenant)}/oauth2/v2.0/authorize?${params}`;
}

async function createLoginAuthorizationUrl() {
  if (!configured()) throw new Error('Microsoft 365 no está configurado.');
  const state = require('crypto').randomBytes(32).toString('hex');
  await db.query('INSERT INTO microsoft_login_states (state, expires_at) VALUES ($1,NOW()+INTERVAL \'10 minutes\')', [state]);
  const params = new URLSearchParams({ client_id: config().client, response_type: 'code', redirect_uri: config().loginRedirect, response_mode: 'query', scope: 'openid profile email offline_access User.Read Calendars.ReadWrite Mail.Read', state });
  return `https://login.microsoftonline.com/${encodeURIComponent(config().tenant)}/oauth2/v2.0/authorize?${params}`;
}

async function exchangeAuthorizationCode(code) {
  const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(config().tenant)}/oauth2/v2.0/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: config().client, client_secret: config().secret, code, redirect_uri: config().loginRedirect, grant_type: 'authorization_code', scope: 'openid profile email offline_access User.Read Calendars.ReadWrite Mail.Read' }) });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error_description || 'Microsoft rechazó la conexión.');
  const profile = await graphWithToken('/me', body.access_token);
  return { profile, accessToken: body.access_token, refreshToken: body.refresh_token, expiresIn: Number(body.expires_in || 3600), scopes: body.scope || '' };
}

async function completeLogin(code, state) {
  const stateResult = await db.query('SELECT state FROM microsoft_login_states WHERE state=$1 AND expires_at>NOW()', [state]);
  if (!stateResult.rows.length) throw new Error('El inicio de sesión Microsoft expiró o no es válido.');
  await db.query('DELETE FROM microsoft_login_states WHERE state=$1', [state]);
  return exchangeAuthorizationCode(code);
}

async function savePersonalConnection(userId, authResult) {
  const profile = authResult.profile;
  await db.query(`INSERT INTO microsoft_conexiones (usuario_id,microsoft_user_id,microsoft_email,access_token,refresh_token,expires_at,scopes) VALUES($1,$2,$3,$4,$5,NOW()+($6 || ' seconds')::interval,$7)
    ON CONFLICT (usuario_id) DO UPDATE SET microsoft_user_id=EXCLUDED.microsoft_user_id,microsoft_email=EXCLUDED.microsoft_email,access_token=EXCLUDED.access_token,refresh_token=EXCLUDED.refresh_token,expires_at=EXCLUDED.expires_at,scopes=EXCLUDED.scopes,updated_at=CURRENT_TIMESTAMP`, [userId, profile.id, profile.mail || profile.userPrincipalName, authResult.accessToken, authResult.refreshToken, authResult.expiresIn, authResult.scopes]);
}

async function connectCallback(code, state) {
  const stateResult = await db.query('SELECT usuario_id FROM microsoft_oauth_states WHERE state=$1 AND expires_at>NOW()', [state]);
  if (!stateResult.rows.length) throw new Error('La autorización de Microsoft expiró o no es válida.');
  await db.query('DELETE FROM microsoft_oauth_states WHERE state=$1', [state]);
  const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(config().tenant)}/oauth2/v2.0/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: config().client, client_secret: config().secret, code, redirect_uri: config().redirect, grant_type: 'authorization_code', scope: 'openid profile offline_access User.Read Calendars.ReadWrite Mail.Read' }) });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error_description || 'Microsoft rechazó la conexión.');
  const profile = await graphWithToken('/me', body.access_token);
  await db.query(`INSERT INTO microsoft_conexiones (usuario_id,microsoft_user_id,microsoft_email,access_token,refresh_token,expires_at,scopes) VALUES($1,$2,$3,$4,$5,NOW()+($6 || ' seconds')::interval,$7)
    ON CONFLICT (usuario_id) DO UPDATE SET microsoft_user_id=EXCLUDED.microsoft_user_id,microsoft_email=EXCLUDED.microsoft_email,access_token=EXCLUDED.access_token,refresh_token=EXCLUDED.refresh_token,expires_at=EXCLUDED.expires_at,scopes=EXCLUDED.scopes,updated_at=CURRENT_TIMESTAMP`, [stateResult.rows[0].usuario_id, profile.id, profile.mail || profile.userPrincipalName, body.access_token, body.refresh_token, Number(body.expires_in || 3600), body.scope || '']);
  return stateResult.rows[0].usuario_id;
}

async function refreshPersonalToken(connection) {
  if (new Date(connection.expires_at).getTime() > Date.now() + 60000) return connection.access_token;
  const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(config().tenant)}/oauth2/v2.0/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: config().client, client_secret: config().secret, refresh_token: connection.refresh_token, grant_type: 'refresh_token', scope: 'openid profile offline_access User.Read Calendars.ReadWrite Mail.Read' }) });
  const body = await response.json();
  if (!response.ok) throw new Error('La conexión Microsoft requiere volver a autorizarse.');
  await db.query('UPDATE microsoft_conexiones SET access_token=$1,refresh_token=$2,expires_at=NOW()+($3 || \' seconds\')::interval,updated_at=CURRENT_TIMESTAMP WHERE usuario_id=$4', [body.access_token, body.refresh_token || connection.refresh_token, Number(body.expires_in || 3600), connection.usuario_id]);
  return body.access_token;
}

async function personalGraph(userId, path, options = {}) {
  const result = await db.query('SELECT * FROM microsoft_conexiones WHERE usuario_id=$1', [userId]);
  if (!result.rows.length) throw new Error('Conecte primero su cuenta personal de Microsoft.');
  return graphWithToken(path, await refreshPersonalToken(result.rows[0]), options);
}

async function graphWithToken(path, token, options = {}) {
  const response = await fetch(`${config().graph}${path}`, { ...options, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error?.message || `Microsoft Graph respondió ${response.status}.`);
  return body;
}
let cachedToken = null;

async function getToken() {
  if (!configured()) throw new Error('Microsoft 365 no está configurado. Defina MS_TENANT_ID, MS_CLIENT_ID y MS_CLIENT_SECRET.');
  if (cachedToken && cachedToken.expires > Date.now() + 60000) return cachedToken.value;
  const c = config();
  const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(c.tenant)}/oauth2/v2.0/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: c.client, client_secret: c.secret, scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials' }) });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error_description || 'No se pudo autenticar contra Microsoft 365.');
  cachedToken = { value: body.access_token, expires: Date.now() + Number(body.expires_in || 3600) * 1000 };
  return cachedToken.value;
}

async function graph(path, options = {}) {
  const response = await fetch(`${config().graph}${path}`, { ...options, headers: { authorization: `Bearer ${await getToken()}`, 'content-type': 'application/json', ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error?.message || `Microsoft Graph respondió ${response.status}.`);
  return body;
}

async function createEvent(userId, event) { return graph(`/users/${encodeURIComponent(userId)}/events`, { method: 'POST', body: JSON.stringify({ subject: event.titulo, body: { contentType: 'HTML', content: event.descripcion || '' }, start: { dateTime: event.inicio, timeZone: event.timezone || 'UTC' }, end: { dateTime: event.fin, timeZone: event.timezone || 'UTC' } }) }); }
async function sendMail(userId, message) { return graph(`/users/${encodeURIComponent(userId)}/sendMail`, { method: 'POST', body: JSON.stringify({ message, saveToSentItems: true }) }); }
async function notifyTicket(ticket, recipient, subject, body) {
  const mailbox = process.env.MS_MAILBOX;
  if (!mailbox || !configured() || !recipient) return false;
  await sendMail(mailbox, { subject, toRecipients: [{ emailAddress: { address: recipient } }], body: { contentType: 'HTML', content: body } });
  return true;
}
async function listEvents(userId, from, to) { const params = new URLSearchParams({ '$orderby': 'start/dateTime', '$top': '100' }); if (from) params.set('$filter', `start/dateTime ge '${from}' and end/dateTime le '${to || '9999-12-31T23:59:59Z'}'`); return graph(`/users/${encodeURIComponent(userId)}/calendarView?${params}`); }
async function personalEvents(userId, from, to) { const params = new URLSearchParams({ '$orderby': 'start/dateTime', '$top': '100' }); if (from) params.set('$filter', `start/dateTime ge '${from}' and end/dateTime le '${to || '9999-12-31T23:59:59Z'}'`); return personalGraph(userId, `/me/calendarView?${params}`); }
async function personalCreateEvent(userId, event) { return personalGraph(userId, '/me/events', { method: 'POST', body: JSON.stringify({ subject: event.titulo, body: { contentType: 'HTML', content: event.descripcion || '' }, start: { dateTime: event.inicio, timeZone: event.timezone || 'UTC' }, end: { dateTime: event.fin, timeZone: event.timezone || 'UTC' } }) }); }
async function personalMessages(userId) { return personalGraph(userId, '/me/mailFolders/inbox/messages?$top=50&$orderby=receivedDateTime%20desc&$select=id,subject,from,receivedDateTime,bodyPreview,isRead'); }

module.exports = { configured, createEvent, sendMail, notifyTicket, listEvents, createAuthorizationUrl, connectCallback, createLoginAuthorizationUrl, completeLogin, savePersonalConnection, personalEvents, personalCreateEvent, personalMessages };
