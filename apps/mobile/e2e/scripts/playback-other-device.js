// Signs in as a second device on the seeded account so a Maestro flow can see another device
// playing. Maestro drives one phone, so check-in, claim, and publish come from the API.
//
// Runs on the host JVM (not the device), so `localhost` is correct for both iOS and Android runs.
// Requires the Mobile E2E API on :4230 and the web E2E seed fixtures.
//
// The other device is always "E2E Other Device". claim stores the access token and session id on
// Maestro's `output` object, which stays available to later runScript steps in the same flow.
// publish, check-in, and end read that token. The session leaves the device list about 40 s
// after its last check-in, so the flow checks in again before a step that needs it present.
// end deletes the session, which removes the device at once.
//
// Env (via `runScript: { env: ... }`):
//   E2E_OTHER_DEVICE_ACTION   claim, publish, check-in, or end. Required.
//   E2E_ITEM_ID_TEXT          item id_text. Required for claim and publish.
//   E2E_ITEM_TITLE            item title. Required for claim and publish.
//   E2E_CHANNEL_TITLE         channel title. Optional for claim and publish; default "E2E Podcast".
//   E2E_PLAYBACK_STATUS       playing, paused, or loading. Default "playing".
//   E2E_PLAYBACK_POSITION     seconds. Default "30".
//   E2E_PLAYBACK_DURATION     seconds. Default "600".

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
const ACTION = optional(
  typeof E2E_OTHER_DEVICE_ACTION !== 'undefined' ? E2E_OTHER_DEVICE_ACTION : null,
  ''
);
const ITEM_ID_TEXT = optional(
  typeof E2E_ITEM_ID_TEXT !== 'undefined' ? E2E_ITEM_ID_TEXT : null,
  ''
);
const ITEM_TITLE = optional(typeof E2E_ITEM_TITLE !== 'undefined' ? E2E_ITEM_TITLE : null, '');
const CHANNEL_TITLE = optional(
  typeof E2E_CHANNEL_TITLE !== 'undefined' ? E2E_CHANNEL_TITLE : null,
  'E2E Podcast'
);
const PLAYBACK_STATUS = optional(
  typeof E2E_PLAYBACK_STATUS !== 'undefined' ? E2E_PLAYBACK_STATUS : null,
  'playing'
);
const PLAYBACK_POSITION = optional(
  typeof E2E_PLAYBACK_POSITION !== 'undefined' ? E2E_PLAYBACK_POSITION : null,
  '30'
);
const PLAYBACK_DURATION = optional(
  typeof E2E_PLAYBACK_DURATION !== 'undefined' ? E2E_PLAYBACK_DURATION : null,
  '600'
);

const OTHER_DEVICE_LABEL = 'E2E Other Device';
// MediumEnum.Podcast. This script runs in Maestro's JavaScript and cannot import the enum.
const PODCAST_MEDIUM = 2;

if (ACTION !== 'claim' && ACTION !== 'publish' && ACTION !== 'check-in' && ACTION !== 'end') {
  throw new Error(
    'playback-other-device: E2E_OTHER_DEVICE_ACTION must be claim, publish, check-in, or end'
  );
}

const NEEDS_ITEM = ACTION === 'claim' || ACTION === 'publish';
if (NEEDS_ITEM && ITEM_ID_TEXT.length === 0) {
  throw new Error('playback-other-device: E2E_ITEM_ID_TEXT is required for claim and publish');
}
if (NEEDS_ITEM && ITEM_TITLE.length === 0) {
  throw new Error('playback-other-device: E2E_ITEM_TITLE is required for claim and publish');
}

const requireFiniteNumber = (label, raw) => {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`playback-other-device: ${label} is not a number (${raw})`);
  }
  return value;
};

const outputString = (value) => (typeof value === 'string' ? value : '');

const requireAccessToken = () => {
  const token = outputString(output.otherDeviceAccessToken);
  if (token.length === 0) {
    throw new Error(
      'playback-other-device: missing output.otherDeviceAccessToken; run claim before this action'
    );
  }
  return token;
};

const requireSessionIdText = () => {
  const sessionIdText = outputString(output.otherDeviceSessionIdText);
  if (sessionIdText.length === 0) {
    throw new Error(
      'playback-other-device: missing output.otherDeviceSessionIdText; run claim before this action'
    );
  }
  return sessionIdText;
};

const JSON_HEADERS = { 'Content-Type': 'application/json' };

const postJson = (url, body, headers) =>
  http.post(url, {
    headers: headers ? Object.assign({}, JSON_HEADERS, headers) : JSON_HEADERS,
    body: JSON.stringify(body),
  });

const failOn = (label, response) => {
  if (!response.ok) {
    throw new Error(`playback-other-device: ${label} failed (${response.status}) ${response.body}`);
  }
};

const authHeaders = (accessToken) => ({ Authorization: `Bearer ${accessToken}` });

const login = () => {
  const tokenResponse = postJson(`${API_BASE_URL}/auth/mobile/token`, {
    email: LOGIN_EMAIL,
    password: LOGIN_PASSWORD,
    device_label: OTHER_DEVICE_LABEL,
  });
  failOn('mobile token', tokenResponse);
  const accessToken = json(tokenResponse.body).access_token;
  if (typeof accessToken !== 'string' || accessToken.length === 0) {
    throw new Error('playback-other-device: mobile token response had no access_token');
  }
  return accessToken;
};

const listSessions = (accessToken) => {
  const response = http.get(`${API_BASE_URL}/auth/sessions`, {
    headers: authHeaders(accessToken),
  });
  failOn('list sessions', response);
  const rows = json(response.body).rows;
  if (!Array.isArray(rows)) {
    throw new Error('playback-other-device: sessions response had no rows array');
  }
  return rows;
};

const deleteSession = (accessToken, idText, label) => {
  if (typeof idText !== 'string' || idText.length === 0) {
    throw new Error(`playback-other-device: ${label} had no id_text`);
  }
  const response = http.request(`${API_BASE_URL}/auth/sessions/${encodeURIComponent(idText)}`, {
    method: 'DELETE',
    headers: authHeaders(accessToken),
  });
  failOn(label, response);
};

const checkIn = (accessToken) => {
  const response = postJson(
    `${API_BASE_URL}/account/playback/presence`,
    {},
    authHeaders(accessToken)
  );
  failOn('presence', response);
};

const publishState = (accessToken, claim) => {
  const response = postJson(
    `${API_BASE_URL}/account/playback/state`,
    {
      claim,
      resource: {
        ref: { kind: 'item', item_id_text: ITEM_ID_TEXT },
        medium: PODCAST_MEDIUM,
        title: ITEM_TITLE,
        channel_title: CHANNEL_TITLE,
        image_url: null,
      },
      status: PLAYBACK_STATUS,
      is_live: false,
      position_seconds: requireFiniteNumber('E2E_PLAYBACK_POSITION', PLAYBACK_POSITION),
      duration_seconds: requireFiniteNumber('E2E_PLAYBACK_DURATION', PLAYBACK_DURATION),
      rate: 1,
    },
    authHeaders(accessToken)
  );
  failOn(`playback state ${PLAYBACK_STATUS}`, response);
};

if (ACTION === 'claim') {
  const accessToken = login();
  const rows = listSessions(accessToken);
  const current = rows.find((row) => row && row.is_current === true);
  if (
    current === undefined ||
    typeof current.id_text !== 'string' ||
    current.id_text.length === 0
  ) {
    throw new Error('playback-other-device: sessions response had no current id_text');
  }
  output.otherDeviceAccessToken = accessToken;
  output.otherDeviceSessionIdText = current.id_text;
  rows.forEach((row) => {
    if (!row || row.is_current === true || row.device_label !== OTHER_DEVICE_LABEL) {
      return;
    }
    deleteSession(accessToken, row.id_text, `delete leftover ${row.id_text}`);
  });
  checkIn(accessToken);
  publishState(accessToken, true);
} else if (ACTION === 'publish') {
  publishState(requireAccessToken(), false);
} else if (ACTION === 'check-in') {
  checkIn(requireAccessToken());
} else {
  deleteSession(requireAccessToken(), requireSessionIdText(), 'end session');
}
