// Puts a change-password E2E account back on its stable password before the app logs in,
// and checks that the screen left it there at the end of the flow.
//
// Runs on the host JVM (not the device), so `localhost` is correct for both iOS and Android runs.
// Requires the Mobile E2E API on :4230 and the web E2E seed fixtures.
//
// A stable login means the account is already on the stable password. This script does not call
// change-password in that case: this token is not the app's session, and a change would end it.
//
// Env (via `runScript: { env: ... }`):
//   E2E_ACCOUNT_EMAIL                 required. Refuses the shared seeded emails.
//   E2E_ACCOUNT_PASSWORD              required. The stable password.
//   E2E_ACCOUNT_TEMP_PASSWORD         required. Used only when the stable login is 401.
//   E2E_CHANGE_PASSWORD_REPAIR_THROW  optional. "1" repairs a non-stable account, then throws.

const optional = (value, fallback) =>
  typeof value === 'string' && value.length > 0 ? value : fallback;

const required = (name, value) => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`auth-change-password: ${name} is required`);
  }
  return value;
};

const API_BASE_URL = optional(
  typeof E2E_API_BASE_URL !== 'undefined' ? E2E_API_BASE_URL : null,
  'http://localhost:4230/api/v2'
);
const EMAIL = required(
  'E2E_ACCOUNT_EMAIL',
  typeof E2E_ACCOUNT_EMAIL !== 'undefined' ? E2E_ACCOUNT_EMAIL : ''
);
const STABLE_PASSWORD = required(
  'E2E_ACCOUNT_PASSWORD',
  typeof E2E_ACCOUNT_PASSWORD !== 'undefined' ? E2E_ACCOUNT_PASSWORD : ''
);
const TEMP_PASSWORD = required(
  'E2E_ACCOUNT_TEMP_PASSWORD',
  typeof E2E_ACCOUNT_TEMP_PASSWORD !== 'undefined' ? E2E_ACCOUNT_TEMP_PASSWORD : ''
);
const REPAIR_THROW =
  typeof E2E_CHANGE_PASSWORD_REPAIR_THROW !== 'undefined' &&
  E2E_CHANGE_PASSWORD_REPAIR_THROW === '1';

const FORBIDDEN_EMAILS = [
  'e2e-user@example.com',
  'e2e-perf@example.com',
  'e2e-popularity-undecided@example.com',
  'e2e-stale-terms@example.com',
  'e2e-consent-order@example.com',
];
if (FORBIDDEN_EMAILS.indexOf(EMAIL) !== -1) {
  throw new Error(`auth-change-password: refusing shared seeded email ${EMAIL}`);
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

const postJson = (url, body, headers) =>
  http.post(url, {
    headers: headers ? Object.assign({}, JSON_HEADERS, headers) : JSON_HEADERS,
    body: JSON.stringify(body),
  });

const throwStatus = (label, response) => {
  throw new Error(`auth-change-password: ${label} failed (${response.status}) ${response.body}`);
};

const statusCode = (response) => Number(response.status);

const login = (password) =>
  postJson(`${API_BASE_URL}/auth/mobile/token`, {
    email: EMAIL,
    password,
    device_label: 'E2E Change Password',
  });

const stableLogin = login(STABLE_PASSWORD);
if (statusCode(stableLogin) === 200) {
  // Already on the stable password. Leave the app's session alone.
} else if (statusCode(stableLogin) !== 401) {
  throwStatus('stable login', stableLogin);
} else {
  const temporaryLogin = login(TEMP_PASSWORD);
  if (statusCode(temporaryLogin) !== 200) {
    throwStatus('temporary login', temporaryLogin);
  }
  const accessToken = json(temporaryLogin.body).access_token;
  if (typeof accessToken !== 'string' || accessToken.length === 0) {
    throw new Error('auth-change-password: temporary login response had no access_token');
  }
  const changed = postJson(
    `${API_BASE_URL}/account/change-password`,
    { current_password: TEMP_PASSWORD, new_password: STABLE_PASSWORD },
    { Authorization: `Bearer ${accessToken}` }
  );
  if (statusCode(changed) !== 200) {
    throwStatus('change-password', changed);
  }
  if (REPAIR_THROW) {
    throw new Error('change-password account was not left on the stable password');
  }
}
