**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

# 92 — Web: warn before turning Popularity Tracking off

A No to Popularity Tracking now deletes the listener's stored listening data (plan 70). Before
any No that would delete something, web asks first in a modal. The modal says the listening data
is deleted right away and that recommendations start from scratch if they turn tracking on again
(R18, R35).

Two places send a No on web, and both ask:

1. The Settings switch (`SettingsListenStats`) when it is turned off.
2. The agreement prompt's No Thanks (`PopularityAgreementGate`), which renders on
   `/popularity-tracking` and as the full-page gate in `AppChrome` for an undecided or stale
   account.

The decision comes from plan 70's shared helper `isPopularityTrackingOptOutDestructive` (true
when `listen_stats_accepted === true`, on any version). An undecided listener's No Thanks
deletes nothing and does not ask. Mobile does the same in plan 94.

## Rows

R18, R35

## Runs after

70, 90, 91

## Files

- `apps/web/src/components/Legal/ModalPopularityTrackingOptOut.tsx` (new)
- `apps/web/src/styles/components/Modal/ModalPopularityTrackingOptOut.module.scss` (new)
- `apps/web/src/components/Settings/Panels/SettingsAccount/SettingsListenStats.tsx`
- `apps/web/src/components/Legal/PopularityAgreementGate.tsx`
- `apps/web/e2e/popularity-tracking-consent.spec.ts`

## Modal — `ModalPopularityTrackingOptOut`

Reuse the `@podverse/ui` `Modal` exactly as `ModalDeleteAccount.tsx` does (same folder pattern,
**modal-layout-contract**, **form-primary-actions-row**):

```tsx
type ModalPopularityTrackingOptOutProps = {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ModalPopularityTrackingOptOut({ isOpen, onCancel, onConfirm }: ModalPopularityTrackingOptOutProps)
```

- `t = useTranslations('popularity_tracking')`, `tMisc = useTranslations('misc')`.
- `<Modal isOpen={isOpen} onClose={onCancel} closeButtonAriaLabel={tMisc('close_modal')}
  header={t('opt_out_confirm_title')} ariaLabel={t('opt_out_confirm_title')}>`.
- `<Modal.Body>` holds `<p className={styles.message}>{t('opt_out_confirm_body')}</p>` and
  `<Modal.Actions>` with, in DOM order:
  1. `<Button type="button" variant="secondary" onClick={onCancel}>{tMisc('cancel')}</Button>`
  2. `<Button type="button" variant="danger" onClick={onConfirm}>{t('opt_out_confirm_action')}</Button>`
- Named export only (**prefer-named-exports**). Styles import last (**styles-import-last**).

`ModalPopularityTrackingOptOut.module.scss` is a copy of `ModalDeleteAccount.module.scss`
(`.message` with `color: var(--text-color-secondary); margin: 0;`).

The modal does not call the API. Each host closes it and then runs its existing No path, which
already shows a toast on failure.

## `SettingsListenStats.tsx`

- Import `isPopularityTrackingOptOutDestructive` from `@podverse/helpers` next to the existing
  helper imports, and `ModalPopularityTrackingOptOut` from `../../../Legal/ModalPopularityTrackingOptOut`.
- New state `const [isOptOutConfirmOpen, setIsOptOutConfirmOpen] = useState(false);`.
- In `switchProps.onChange`, replace the `!next` branch:

  ```tsx
  if (!next) {
    if (isPopularityTrackingOptOutDestructive(loggedInAccount?.account_settings)) {
      setIsOptOutConfirmOpen(true);
      return;
    }
    void turnOff();
    return;
  }
  ```

- Render the modal inside the returned `SettingsSection`, after the switch:

  ```tsx
  <ModalPopularityTrackingOptOut
    isOpen={isOptOutConfirmOpen}
    onCancel={() => {
      setIsOptOutConfirmOpen(false);
    }}
    onConfirm={() => {
      setIsOptOutConfirmOpen(false);
      void turnOff();
    }}
  />
  ```

The switch is controlled by `checked: allowed`, so Cancel leaves it on without extra state.

## `PopularityAgreementGate.tsx`

- Import `isPopularityTrackingOptOutDestructive` from `@podverse/helpers` and
  `ModalPopularityTrackingOptOut` from `./ModalPopularityTrackingOptOut`.
- New state `isOptOutConfirmOpen`, as above.
- Replace the `onReject` prop body:

  ```tsx
  onReject={() => {
    if (isPopularityTrackingOptOutDestructive(loggedInAccount?.account_settings)) {
      setIsOptOutConfirmOpen(true);
      return;
    }
    void handleDecision(false);
  }}
  ```

- Wrap the return in a fragment and render the modal after `<AgreementScreen … />`, with
  `onConfirm` closing it and then calling `void handleDecision(false)`.

`handleDecision` already guards on `pending`, sets the account, and calls `onDecided`; do not
change it.

## Tests

`apps/web/e2e/popularity-tracking-consent.spec.ts` (serial). Follow **e2e-readability** (full
sentences) and pass the verified element to the capture helpers
(**e2e-screenshot-verified-element**).

1. In the test "When the account already accepted, the settings switch turns tracking off
   immediately and on only after Yes.":
   - Rename it to "When the account already accepted, turning the settings switch off asks
     first, and tracking turns back on only after Yes."
   - Replace the step "Turning the switch off opts out immediately." with two steps:
     - "Turning the switch off asks first, and Cancel keeps tracking on." Click the switch;
       expect `page.getByRole('dialog', { name: 'Turn Off Popularity Tracking?' })` visible;
       click its `Cancel` button; expect the dialog hidden, the switch still checked, and
       `listenStatsAccepted(page)` to be `true`. Capture the dialog before Cancel.
     - "Confirming Turn Off and Delete turns tracking off." Click the switch, click
       `Turn Off and Delete` in the dialog, expect the switch not checked and
       `listenStatsAccepted(page)` to be `false`.
   - The later steps (No Thanks keeps it off, Yes turns it on) stay. That No Thanks runs while
     the account is opted out, so it does not ask; add
     `await expect(page.getByRole('dialog', { name: 'Turn Off Popularity Tracking?' })).toHaveCount(0);`
     after its click.
2. New test at the end of the describe: "When an account accepted an older version, No Thanks on
   the prompt asks first, and confirming turns tracking off."
   - `loginViaApi(page, E2E_POPULARITY_STALE_EMAIL)` (import it from `./helpers/legalConsent`).
   - `page.goto('/')`; expect `page.getByRole('main', { name: POPULARITY_SCREEN_NAME })` visible.
   - Click `No Thanks`; expect the dialog visible; capture it; click `Cancel`; expect the dialog
     hidden, the prompt still visible, and `listenStatsAccepted(page)` to be `true`.
   - Click `No Thanks` again, then `Turn Off and Delete`; expect the prompt hidden
     (`toHaveCount(0)`) and `listenStatsAccepted(page)` to be `false`.

`packages/ui/src/components/layout/Modal/Modal.tsx` renders `role="dialog"` with
`aria-label={ariaLabel}`, so `getByRole('dialog', { name: 'Turn Off Popularity Tracking?' })`
finds it. Keep the locator in a `optOutDialog(page)` function next to `popularitySwitch`. Inside
the dialog, use `getByRole('button', { name: 'Cancel', exact: true })` so the close button does
not match.

## Release scratchpad

```markdown
## Web asks before Popularity Tracking is turned off

- Surfaces: web
- Change: turning off the Popularity Tracking switch in Settings, or answering No Thanks at the
  agreement prompt after an earlier Yes, now opens a "Turn Off Popularity Tracking?" dialog. It
  says the Taste Profile, the Hidden From Taste Profile list, and stored listening history are
  deleted right away, and that recommendations start from scratch if tracking is turned on
  again. Cancel keeps tracking on; "Turn Off and Delete" sends the No. A listener who never said
  Yes is not asked.
- Who notices: signed-in web listeners who had allowed Popularity Tracking
- Operator steps: none
```
