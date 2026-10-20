// Asserts that the seeded E2E account's server now-playing row is an Add by RSS episode, so a
// Maestro flow can prove the phone recorded what it played. The phone posts now-playing as soon as
// playback starts; this rereads a few times in case that post is still in flight.
//
// Runs on the host JVM (not the device), so `localhost` is correct for both iOS and Android runs.
// Requires the Mobile E2E API on :4230 and the web E2E seed fixtures.
//
// Env (via `runScript: { env: ... }`):
//   E2E_ADD_BY_RSS_FEED_URL  required, canonical feed URL the row must carry
//   E2E_ADD_BY_RSS_TITLE     required, episode title the row must carry

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
const FEED_URL = optional(
  typeof E2E_ADD_BY_RSS_FEED_URL !== 'undefined' ? E2E_ADD_BY_RSS_FEED_URL : null,
  ''
);
const TITLE = optional(
  typeof E2E_ADD_BY_RSS_TITLE !== 'undefined' ? E2E_ADD_BY_RSS_TITLE : null,
  ''
);

if (FEED_URL.length === 0 || TITLE.length === 0) {
  throw new Error(
    'assert-add-by-rss-now-playing: E2E_ADD_BY_RSS_FEED_URL and E2E_ADD_BY_RSS_TITLE are required'
  );
}

const failOn = (label, response) => {
  if (!response.ok) {
    throw new Error(
      `assert-add-by-rss-now-playing: ${label} failed (${response.status}) ${response.body}`
    );
  }
};

const tokenResponse = http.post(`${API_BASE_URL}/auth/mobile/token`, {
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: LOGIN_EMAIL, password: LOGIN_PASSWORD }),
});
failOn('mobile token', tokenResponse);

const accessToken = json(tokenResponse.body).access_token;
if (typeof accessToken !== 'string' || accessToken.length === 0) {
  throw new Error('assert-add-by-rss-now-playing: mobile token response had no access_token');
}
const authHeaders = { Authorization: `Bearer ${accessToken}` };

const readNowPlayingRows = () => {
  const queuesResponse = http.get(`${API_BASE_URL}/queue/all-for-account/private`, {
    headers: authHeaders,
  });
  failOn('queue list', queuesResponse);
  const queues = json(queuesResponse.body);
  if (!Array.isArray(queues)) {
    return [];
  }

  const rows = [];
  for (let index = 0; index < queues.length; index += 1) {
    const queue = queues[index];
    if (!queue || typeof queue.id_text !== 'string') {
      continue;
    }
    const response = http.get(`${API_BASE_URL}/queue/${queue.id_text}/resources/now-playing`, {
      headers: authHeaders,
    });
    failOn(`now-playing read for ${queue.id_text}`, response);
    const parsed = json(response.body);
    const resource = Array.isArray(parsed) ? parsed[0] : parsed;
    if (resource) {
      rows.push(resource);
    }
  }
  return rows;
};

const isExpectedRow = (resource) => {
  const data = resource.add_by_rss_resource_data;
  return (
    typeof resource.add_by_rss_hash_id === 'string' &&
    resource.add_by_rss_hash_id.length > 0 &&
    !!data &&
    data.feed_url === FEED_URL &&
    data.title === TITLE
  );
};

let lastSeen = [];
let confirmed = false;
for (let attempt = 0; attempt < 10; attempt += 1) {
  lastSeen = readNowPlayingRows();
  if (lastSeen.some(isExpectedRow)) {
    confirmed = true;
    break;
  }
}

if (!confirmed) {
  const seen = lastSeen.map((resource) =>
    resource.add_by_rss_resource_data
      ? `add_by_rss:${resource.add_by_rss_resource_data.title}`
      : `item:${resource.item ? resource.item.id_text : 'none'}`
  );
  throw new Error(
    `assert-add-by-rss-now-playing: no now-playing row is "${TITLE}" from ${FEED_URL}; saw ${JSON.stringify(seen)}`
  );
}
