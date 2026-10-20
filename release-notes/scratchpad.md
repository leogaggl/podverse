## Custom API field no longer takes a login email

- Surfaces: mobile
- Change: Text fields stay out of platform autofill unless they name themselves. Login, sign-up,
  forgot-password, change-email, and Add by RSS username and password fields name themselves. The
  Custom API URL is a URL field. A value that is not an http(s) address shows the existing
  invalid-URL message immediately, with a danger border while the keyboard is open. An http(s)
  address that is not a canonical API base shows that message on blur and on Save.
- Who notices: someone pointing the app at another server, especially when a saved login email was
  landing in API URL
- Operator steps: none
