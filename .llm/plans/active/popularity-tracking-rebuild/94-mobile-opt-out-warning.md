**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

# 94 — Mobile: warn before turning Popularity Tracking off

Mobile parity with plan 92. A No that would delete stored listening data asks first, with the
same copy: the data is deleted right away, and recommendations start from scratch if tracking is
turned on again (R18, R35).

Three places send a No on mobile:

1. **More › Settings › Popularity Tracking, switch off** (`MoreSettingsPopularityTrackingScreen`).
   Asks with `ConfirmDialog`.
2. **The same screen, No while reviewing the agreement** (the inline
   `PopularityTrackingAgreementBody`). A stale acceptance reaches this. Asks with `ConfirmDialog`.
3. **The consent prompt** in `TermsAcceptanceProvider`, shown for undecided and stale accounts.
   That prompt is an RN full-screen `Modal`, and an `AppOverlay` raised from inside it renders
   under the modal's window (**mobile-overlays-in-tree** § The one boundary). So the prompt asks
   inline: No swaps the agreement body for a short confirmation panel in the same modal.

Each asks only when plan 70's `isPopularityTrackingOptOutDestructive(account?.account_settings)`
is true. An undecided listener's No asks nothing, as on web.

## Rows

R18, R35

## Runs after

70, 90

## Files

- `apps/mobile/src/components/feedback/ConfirmDialog.tsx`
- `apps/mobile/src/popularityTracking/PopularityTrackingOptOutPanel.tsx` (new)
- `apps/mobile/src/screens/more/MoreSettingsPopularityTrackingScreen.tsx`
- `apps/mobile/src/terms/TermsAcceptanceProvider.tsx`
- `apps/mobile/e2e/popularity-tracking.yaml`

## Reuse

- `ConfirmDialog` (`AppOverlay` based) for the Settings screen; the delete-account dialog in
  `apps/mobile/src/terms/AccountAccessPanel.tsx` shows the prop usage.
- `FormActions` for the inline panel, laid out per **mobile-screen-layout**: on a consent prompt
  the way out sits above the action that continues (Cancel above Turn Off and Delete).
  `ConfirmDialog` keeps its own order (confirm, then cancel).
- Copy from plan 90: `popularity_tracking.opt_out_confirm_title`, `.opt_out_confirm_body`,
  `.opt_out_confirm_action`, and `misc.cancel`.

## `ConfirmDialog.tsx` — destructive confirm styling

Add one optional prop so a destructive confirm uses the `danger` button:

- `import type { ButtonVariant } from '../primitives/Button';`
- `ConfirmDialogProps` gains `confirmVariant?: ButtonVariant;` right after `confirmLabel?`.
- Destructure it, and build `confirmAction` with `variant: confirmVariant` (omit the key when
  undefined, so existing callers keep the primary button):
  `{ label: confirmLabel, onPress: onConfirm, testID: confirmTestID, ...(confirmVariant === undefined ? {} : { variant: confirmVariant }) }`.

No other behavior changes. Plan 95 adds a second confirm action to this same component.

## New `PopularityTrackingOptOutPanel.tsx`

```tsx
type PopularityTrackingOptOutPanelProps = {
  onCancel: () => void;
  onConfirm: () => void;
};

export function PopularityTrackingOptOutPanel({ onCancel, onConfirm }: PopularityTrackingOptOutPanelProps)
```

- Root `<View testID="popularity-tracking-opt-out-panel">`.
- `<Text style={styles.body}>{t('popularity_tracking.opt_out_confirm_body')}</Text>` with
  `typography.prose` and `themeStyles.textSecondary.color`.
- `<FormActions style={styles.actions} actions={[…]} />` with `styles.actions.marginTop =
  formActionsTopGap(tokens.spacing)`, actions in this order:
  1. `{ label: t('misc.cancel'), onPress: onCancel, testID: 'popularity-tracking-opt-out-cancel', variant: 'secondary' }`
  2. `{ label: t('popularity_tracking.opt_out_confirm_action'), onPress: onConfirm, testID: 'popularity-tracking-opt-out-confirm', variant: 'danger' }`
- Styles through `useTheme()` + `useMemo(StyleSheet.create)`, as
  `MoreSettingsPopularityTrackingScreen` does. The heading is not part of the panel; the host's
  existing header `Text` shows the confirm title (one heading per surface).

## `TermsAcceptanceProvider.tsx`

- Import `isPopularityTrackingOptOutDestructive` from `@podverse/helpers` and
  `PopularityTrackingOptOutPanel` from `../popularityTracking/PopularityTrackingOptOutPanel`.
- New state next to the other popularity state:
  `const [popularityOptOutConfirming, setPopularityOptOutConfirming] = useState(false);`
- Reset it when the prompt is not showing popularity: a `useEffect` on `phase` that calls
  `setPopularityOptOutConfirming(false)` when `phase !== 'popularity'`.
- `ScrollView` key: change `key={contentPhase}` to
  ``key={`${contentPhase}-${popularityOptOutConfirming ? 'opt-out' : 'choice'}`}`` so the panel
  opens scrolled to the top even when No sat below the fold.
- In the `contentPhase === 'popularity'` branch:
  - The header `Text` shows `t('popularity_tracking.opt_out_confirm_title')` while
    `popularityOptOutConfirming`, otherwise `t('popularity_tracking.title')` as today.
  - While `popularityOptOutConfirming`, render `PopularityTrackingOptOutPanel` instead of
    `PopularityTrackingAgreementBody`:
    - `onCancel={() => { setPopularityOptOutConfirming(false); }}`
    - `onConfirm={() => { setPopularityOptOutConfirming(false); void handlePopularityDecision(false); }}`
  - `PopularityTrackingAgreementBody`'s `onDecision` becomes:

    ```tsx
    onDecision={(accepted) => {
      if (!accepted && isPopularityTrackingOptOutDestructive(account?.account_settings)) {
        setPopularityOptOutConfirming(true);
        AccessibilityInfo.announceForAccessibility(t('popularity_tracking.opt_out_confirm_title'));
        return;
      }
      void handlePopularityDecision(accepted);
    }}
    ```

`handlePopularityDecision` and `decidingRef` do not change. The modal's `testID`
(`popularity-tracking-prompt` from `consentTestId`) does not change.

## `MoreSettingsPopularityTrackingScreen.tsx`

- Import `isPopularityTrackingOptOutDestructive` from `@podverse/helpers` (same import line as
  `isPopularityTrackingAllowed`) and `ConfirmDialog` from `../../components/feedback/ConfirmDialog`.
- New state `const [optOutConfirmVisible, setOptOutConfirmVisible] = useState(false);`.
- `const optOutDestructive = isPopularityTrackingOptOutDestructive(account?.account_settings);`
- `SettingsSwitchRow` `onValueChange`, `!next` branch:

  ```tsx
  if (!next) {
    setReviewing(false);
    if (optOutDestructive) {
      setOptOutConfirmVisible(true);
      return;
    }
    void handleDecision(false);
    return;
  }
  ```

- `PopularityTrackingAgreementBody` `onDecision`:

  ```tsx
  onDecision={(accepted) => {
    setReviewing(false);
    if (!accepted && optOutDestructive) {
      setOptOutConfirmVisible(true);
      return;
    }
    void handleDecision(accepted);
  }}
  ```

- Render the dialog as the last element inside `MobileScreenContainer`, unconditionally (`visible`
  drives it, **mobile-modal-presentation-lifecycle**):

  ```tsx
  <ConfirmDialog
    body={t('popularity_tracking.opt_out_confirm_body')}
    cancelLabel={t('misc.cancel')}
    cancelTestID="more-settings-popularity-tracking-opt-out-cancel"
    confirmLabel={t('popularity_tracking.opt_out_confirm_action')}
    confirmTestID="more-settings-popularity-tracking-opt-out-confirm"
    confirmVariant="danger"
    onCancel={() => {
      setOptOutConfirmVisible(false);
    }}
    onConfirm={() => {
      setOptOutConfirmVisible(false);
      void handleDecision(false);
    }}
    testID="more-settings-popularity-tracking-opt-out-dialog"
    title={t('popularity_tracking.opt_out_confirm_title')}
    visible={optOutConfirmVisible}
  />
  ```

The switch value stays `allowed || reviewing`, so it reads on while the dialog is open and after
Cancel.

## Tests

`apps/mobile/e2e/popularity-tracking.yaml` — append after the final
`takeScreenshot: popularity-tracking-settings`. The account said Yes earlier in the flow, so the
switch is on and turning it off asks:

```yaml
- tapOn:
    id: more-settings-popularity-tracking-switch
- extendedWaitUntil:
    visible:
      id: more-settings-popularity-tracking-opt-out-dialog
    timeout: ${TIMEOUT_FAST}
- takeScreenshot: popularity-tracking-opt-out-dialog
- tapOn:
    id: more-settings-popularity-tracking-opt-out-cancel
- assertNotVisible:
    id: more-settings-popularity-tracking-opt-out-dialog
- takeScreenshot: popularity-tracking-opt-out-cancelled

- tapOn:
    id: more-settings-popularity-tracking-switch
- extendedWaitUntil:
    visible:
      id: more-settings-popularity-tracking-opt-out-dialog
    timeout: ${TIMEOUT_FAST}
- tapOn:
    id: more-settings-popularity-tracking-opt-out-confirm
- assertNotVisible:
    id: more-settings-popularity-tracking-opt-out-dialog
- takeScreenshot: popularity-tracking-opted-out
```

No flow in the repo asserts a switch's `checked` state yet, so the flow proves the dialog opens
and closes on both actions, and the screenshots show the switch state. The server effect of the
No is covered by plan 70's API tests and plan 92's web spec. `TIMEOUT_FAST` is in
`apps/mobile/e2e/shared/timeouts.env` (**mobile-maestro-timeouts**). Update the comment at the top
of the flow to say it also covers the opt-out confirmation in Settings.

The consent prompt's inline panel has no Maestro step: reaching it needs a stale acceptance
account and a version bump on the device run. The decision itself is plan 70's unit-tested helper.

## Release scratchpad

```markdown
## Mobile asks before Popularity Tracking is turned off

- Surfaces: mobile
- Change: turning off Popularity Tracking in More > Settings, or answering No after an earlier
  Yes (in Settings or at the full-screen agreement prompt), now asks "Turn Off Popularity
  Tracking?" first. The message says the Taste Profile, the Hidden From Taste Profile list, and
  stored listening history are deleted right away, and that recommendations start from scratch
  if tracking is turned on again. Cancel keeps tracking on; "Turn Off and Delete" sends the No.
  Settings shows a dialog; the agreement prompt shows the same message in place. A listener who
  never said Yes is not asked.
- Who notices: signed-in mobile listeners who had allowed Popularity Tracking
- Operator steps: none
```
