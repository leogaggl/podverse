// Seeds a now-playing row for the seeded E2E account so a Maestro flow can act as if a second
// device had been listening. Maestro drives one device, so the "other device" side of a handoff
// has to come from the API.
//
// Runs on the host JVM (not the device), so `localhost` is correct for both iOS and Android runs.
// Requires the Mobile E2E API on :4230 and the web E2E seed fixtures.
//
// Env (via `runScript: { env: ... }`):
//   E2E_ITEM_ID_TEXT        item id_text to make now-playing. Required unless the Add by RSS
//                           variables below are set.
//   E2E_ADD_BY_RSS_FEED_URL, E2E_ADD_BY_RSS_GUID, E2E_ADD_BY_RSS_TITLE,
//   E2E_ADD_BY_RSS_ENCLOSURE_URL
//                           make an Add by RSS episode now-playing instead, as web writes it: no
//                           parsed bundle, only the feed URL, guid, title, and enclosure.
//   E2E_PLAYBACK_POSITION   seconds, default 0
//   E2E_PLAYBACK_EVENT_KIND one of the shared playback event kinds, default "play"
//   E2E_LAST_PLAYED_AT      ISO-8601 timestamp. When omitted, four minutes after now so a
//                           just-paused local item is older than this other-device row. The
//                           server accepts client timestamps up to five minutes in the future.
//   E2E_QUEUE_ID_TEXT       queue to write into. When omitted, the account's active queue, which
//                           is the one the app plays into — see the note below.

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
const REQUESTED_QUEUE_ID_TEXT = optional(
  typeof E2E_QUEUE_ID_TEXT !== 'undefined' ? E2E_QUEUE_ID_TEXT : null,
  ''
);
const ITEM_ID_TEXT = optional(
  typeof E2E_ITEM_ID_TEXT !== 'undefined' ? E2E_ITEM_ID_TEXT : null,
  ''
);
const PLAYBACK_POSITION = optional(
  typeof E2E_PLAYBACK_POSITION !== 'undefined' ? E2E_PLAYBACK_POSITION : null,
  '0'
);
const PLAYBACK_EVENT_KIND = optional(
  typeof E2E_PLAYBACK_EVENT_KIND !== 'undefined' ? E2E_PLAYBACK_EVENT_KIND : null,
  'play'
);
const ADD_BY_RSS_FEED_URL = optional(
  typeof E2E_ADD_BY_RSS_FEED_URL !== 'undefined' ? E2E_ADD_BY_RSS_FEED_URL : null,
  ''
);
const ADD_BY_RSS_GUID = optional(
  typeof E2E_ADD_BY_RSS_GUID !== 'undefined' ? E2E_ADD_BY_RSS_GUID : null,
  ''
);
const ADD_BY_RSS_TITLE = optional(
  typeof E2E_ADD_BY_RSS_TITLE !== 'undefined' ? E2E_ADD_BY_RSS_TITLE : null,
  ''
);
const ADD_BY_RSS_ENCLOSURE_URL = optional(
  typeof E2E_ADD_BY_RSS_ENCLOSURE_URL !== 'undefined' ? E2E_ADD_BY_RSS_ENCLOSURE_URL : null,
  ''
);
const NEWER_THAN_LOCAL_MS = 4 * 60 * 1000;
const LAST_PLAYED_AT = optional(
  typeof E2E_LAST_PLAYED_AT !== 'undefined' ? E2E_LAST_PLAYED_AT : null,
  new Date(Date.now() + NEWER_THAN_LOCAL_MS).toISOString()
);

const IS_ADD_BY_RSS = ADD_BY_RSS_FEED_URL.length > 0;
if (IS_ADD_BY_RSS && (ADD_BY_RSS_GUID.length === 0 || ADD_BY_RSS_ENCLOSURE_URL.length === 0)) {
  throw new Error(
    'seed-playback-now-playing: E2E_ADD_BY_RSS_GUID and E2E_ADD_BY_RSS_ENCLOSURE_URL are required with E2E_ADD_BY_RSS_FEED_URL'
  );
}
if (!IS_ADD_BY_RSS && ITEM_ID_TEXT.length === 0) {
  throw new Error('seed-playback-now-playing: E2E_ITEM_ID_TEXT is required');
}
const SEED_LABEL = IS_ADD_BY_RSS ? `Add by RSS ${ADD_BY_RSS_GUID}` : ITEM_ID_TEXT;

const JSON_HEADERS = { 'Content-Type': 'application/json' };

const postJson = (url, body, headers) =>
  http.post(url, {
    headers: headers ? Object.assign({}, JSON_HEADERS, headers) : JSON_HEADERS,
    body: JSON.stringify(body),
  });

const failOn = (label, response) => {
  if (!response.ok) {
    throw new Error(
      `seed-playback-now-playing: ${label} failed (${response.status}) ${response.body}`
    );
  }
};

// The mobile token endpoint returns the access token in the response body by design, unlike
// cookie-based web login, which withholds it unless the API is explicitly configured otherwise.
const tokenResponse = postJson(`${API_BASE_URL}/auth/mobile/token`, {
  email: LOGIN_EMAIL,
  password: LOGIN_PASSWORD,
});
failOn('mobile token', tokenResponse);

const accessToken = json(tokenResponse.body).access_token;
if (typeof accessToken !== 'string' || accessToken.length === 0) {
  throw new Error('seed-playback-now-playing: mobile token response had no access_token');
}

const authHeaders = { Authorization: `Bearer ${accessToken}` };

// Handoff is decided per queue: the app compares its now-playing against the server's for the same
// queue, because that is what two devices on one account share. So this row has to land in the
// queue the app is playing into — the account's active queue — and not in a seeded fixture queue
// the account also owns. Mirrors the app's own selection (active queue, else the first one).
const resolveQueueIdText = () => {
  if (REQUESTED_QUEUE_ID_TEXT.length > 0) {
    return REQUESTED_QUEUE_ID_TEXT;
  }

  const response = http.get(`${API_BASE_URL}/queue/all-for-account/private`, {
    headers: authHeaders,
  });
  failOn('queue list', response);

  const queues = json(response.body);
  if (!Array.isArray(queues) || queues.length === 0) {
    throw new Error('seed-playback-now-playing: the account has no queues');
  }

  const active = queues.find((queue) => queue && queue.is_active_queue === true);
  const selected = active !== undefined ? active : queues[0];
  if (typeof selected.id_text !== 'string' || selected.id_text.length === 0) {
    throw new Error('seed-playback-now-playing: the selected queue has no id_text');
  }

  return selected.id_text;
};

const QUEUE_ID_TEXT = resolveQueueIdText();
const seedBody = {
  last_played_at: LAST_PLAYED_AT,
  playback_event_kind: PLAYBACK_EVENT_KIND,
  playback_position: Number(PLAYBACK_POSITION),
};
const nowPlayingUrl = `${API_BASE_URL}/queue/${QUEUE_ID_TEXT}/resources/now-playing`;

const readNowPlayingResource = (body) => {
  const parsed = json(body);
  return Array.isArray(parsed) ? parsed[0] : parsed;
};

const isSeededResource = (resource) => {
  if (!resource) {
    return false;
  }
  if (IS_ADD_BY_RSS) {
    const data = resource.add_by_rss_resource_data;
    return !!data && data.feed_url === ADD_BY_RSS_FEED_URL && data.guid === ADD_BY_RSS_GUID;
  }
  return !!resource.item && resource.item.id_text === ITEM_ID_TEXT;
};

const seedUrl = IS_ADD_BY_RSS
  ? `${API_BASE_URL}/queue/${QUEUE_ID_TEXT}/item-add-by-rss/now-playing`
  : `${API_BASE_URL}/queue/${QUEUE_ID_TEXT}/item/${ITEM_ID_TEXT}/now-playing`;
const seedRequestBody = IS_ADD_BY_RSS
  ? Object.assign({}, seedBody, {
      add_by_rss_resource_data: {
        enclosure_url: ADD_BY_RSS_ENCLOSURE_URL,
        feed_url: ADD_BY_RSS_FEED_URL,
        guid: ADD_BY_RSS_GUID,
        medium_id: null,
        title: ADD_BY_RSS_TITLE,
      },
    })
  : seedBody;

// A just-paused device may still be posting episode A. Write B and reread until the
// server row matches, so remount reconcile sees the other-device item.
let confirmed = false;
for (let attempt = 0; attempt < 8; attempt += 1) {
  const seedResponse = postJson(seedUrl, seedRequestBody, authHeaders);
  failOn(`now-playing seed for ${SEED_LABEL}`, seedResponse);

  const current = http.get(nowPlayingUrl, { headers: authHeaders });
  failOn(`now-playing read for ${SEED_LABEL}`, current);
  if (isSeededResource(readNowPlayingResource(current.body))) {
    confirmed = true;
    break;
  }
}

if (!confirmed) {
  throw new Error(
    `seed-playback-now-playing: server now-playing was not ${SEED_LABEL} after retries`
  );
}
