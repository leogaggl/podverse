// Prepares account sessions for the signed-in devices flow. Maestro drives one device, so the
// other session, and the sign-out of this device, come from the API.
//
// Runs on the host JVM (not the device), so `localhost` is correct for both iOS and Android runs.
// Requires the Mobile E2E API on :4230 and the web E2E seed fixtures.
//
// iOS and Android slots run at once against one seeded account. Each action only touches the
// labels that slot owns.
//
// Env (via `runScript: { env: ... }`):
//   E2E_SESSION_ACTION       create-other or end-device. Required.
//   E2E_OTHER_DEVICE_LABEL   label for create-other. Required for that action.
//   E2E_DEVICE_LABEL_SUFFIX  " · iOS" or " · Android". Required for end-device.

const optional = (value, fallback) =>
  typeof value === 'string' && value.length > 0 ? value : fallback;

const API_BASE_URL = optional(
  typeof E2E_API_BASE_URL !== 'undefined' ? E2E_API_BASE_URL : null,
  'http://localhost:4230/api/v2'
);
const LOGIN_EMAIL = optional(
  typeof E2E_LOGIN_EMAIL !== 'undefined' ? E2E_LOGIN_EMAIL : null,
  'e2e-user@example.com'
);
const LOGIN_PASSWORD = optional(
  typeof E2E_LOGIN_PASSWORD !== 'undefined' ? E2E_LOGIN_PASSWORD : null,
  'Test!1Aa'
);
const ACTION = optional(typeof E2E_SESSION_ACTION !== 'undefined' ? E2E_SESSION_ACTION : null, '');
const OTHER_DEVICE_LABEL = optional(
  typeof E2E_OTHER_DEVICE_LABEL !== 'undefined' ? E2E_OTHER_DEVICE_LABEL : null,
  ''
);
const DEVICE_LABEL_SUFFIX = optional(
  typeof E2E_DEVICE_LABEL_SUFFIX !== 'undefined' ? E2E_DEVICE_LABEL_SUFFIX : null,
  ''
);

if (ACTION !== 'create-other' && ACTION !== 'end-device') {
  throw new Error('auth-sessions: E2E_SESSION_ACTION must be create-other or end-device');
}
if (ACTION === 'create-other' && OTHER_DEVICE_LABEL.length === 0) {
  throw new Error('auth-sessions: E2E_OTHER_DEVICE_LABEL is required for create-other');
}
if (ACTION === 'end-device' && DEVICE_LABEL_SUFFIX.length === 0) {
  throw new Error('auth-sessions: E2E_DEVICE_LABEL_SUFFIX is required for end-device');
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

const postJson = (url, body, headers) =>
  http.post(url, {
    headers: headers ? Object.assign({}, JSON_HEADERS, headers) : JSON_HEADERS,
    body: JSON.stringify(body),
  });

const failOn = (label, response) => {
  if (!response.ok) {
    throw new Error(`auth-sessions: ${label} failed (${response.status}) ${response.body}`);
  }
};

const login = (deviceLabel) => {
  const tokenResponse = postJson(`${API_BASE_URL}/auth/mobile/token`, {
    email: LOGIN_EMAIL,
    password: LOGIN_PASSWORD,
    device_label: deviceLabel,
  });
  failOn('mobile token', tokenResponse);
  const accessToken = json(tokenResponse.body).access_token;
  if (typeof accessToken !== 'string' || accessToken.length === 0) {
    throw new Error('auth-sessions: mobile token response had no access_token');
  }
  return accessToken;
};

const authHeaders = (accessToken) => ({ Authorization: `Bearer ${accessToken}` });

const listSessions = (accessToken) => {
  const response = http.get(`${API_BASE_URL}/auth/sessions`, {
    headers: authHeaders(accessToken),
  });
  failOn('list sessions', response);
  const rows = json(response.body).rows;
  if (!Array.isArray(rows)) {
    throw new Error('auth-sessions: sessions response had no rows array');
  }
  return rows;
};

const deleteSession = (accessToken, idText, label) => {
  if (typeof idText !== 'string' || idText.length === 0) {
    throw new Error(`auth-sessions: ${label} had no id_text`);
  }
  const response = http.request(`${API_BASE_URL}/auth/sessions/${encodeURIComponent(idText)}`, {
    method: 'DELETE',
    headers: authHeaders(accessToken),
  });
  failOn(label, response);
};

if (ACTION === 'create-other') {
  const accessToken = login(OTHER_DEVICE_LABEL);
  const rows = listSessions(accessToken);
  rows.forEach((row) => {
    if (row.is_current === true || row.device_label !== OTHER_DEVICE_LABEL) {
      return;
    }
    deleteSession(accessToken, row.id_text, `delete leftover ${row.id_text}`);
  });
} else {
  const accessToken = login('E2E Host');
  const rows = listSessions(accessToken);
  let match = null;
  rows.forEach((row) => {
    if (row.is_current === true || row.client_type !== 'mobile') {
      return;
    }
    if (typeof row.device_label !== 'string' || !row.device_label.endsWith(DEVICE_LABEL_SUFFIX)) {
      return;
    }
    if (match === null || String(row.created_at) > String(match.created_at)) {
      match = row;
    }
  });
  if (match === null) {
    throw new Error(
      `auth-sessions: no non-current mobile session ends with ${JSON.stringify(DEVICE_LABEL_SUFFIX)}`
    );
  }
  deleteSession(accessToken, match.id_text, `delete device ${match.id_text}`);
  const current = rows.find((row) => row.is_current === true);
  if (current === undefined) {
    throw new Error('auth-sessions: sessions response had no current row to clean up');
  }
  deleteSession(accessToken, current.id_text, `delete host ${current.id_text}`);
}
