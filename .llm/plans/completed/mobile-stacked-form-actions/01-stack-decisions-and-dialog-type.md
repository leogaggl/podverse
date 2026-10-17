# Stack form decisions and dialog type

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

Read [00-SUMMARY.md](00-SUMMARY.md) first. Those choices are locked.

## FormActions

`apps/mobile/src/components/form/FormActions.tsx`

- Remove `stacked` and the row branch (`styles.row`, `styles.slot`).
- Always render two or more actions in `styles.column`. Keep each `Button` at `fullWidth` and
  `size="form"`.
- Column `gap` is `formActionsGap(tokens.spacing)` from `screenLayout.ts`, not `spacing.md`.
- Render `actions` in array order, first on top.
- Update the type comment and the function comment so they describe a column. Do not mention a
  row, a right edge, or `stacked`.

`AgreementChoices` is the only caller that passes `stacked`. Delete that prop. Its array stays
`[reject, accept]`.

The working tree already routes those buttons through `FormActions` with `stacked`, and
`FormActions` already sets `size="form"`. Keep that. Do not put the buttons back in a row.

The accordion under those buttons has no space today. Wrap it and set
`marginTop: formActionsTopGap(...)`. Terms acceptance uses the same component, so it picks up
the same gap. Its title is already `terms_acceptance.full_agreement` ("View Terms of Service").
Do not change that title. Popularity Tracking's accordion title is a different plan.

In the static-form section of `mobile-screen-layout`, also say: the disclosure accordion under
`AgreementChoices` uses `formActionsTopGap`, and Terms acceptance uses that same seam.

## ConfirmDialog

`apps/mobile/src/components/feedback/ConfirmDialog.tsx`

Every two-action dialog inherits this, including the premium gate. Do not edit each caller.

- Remove the `stacked` prop.
- With both actions, pass `[confirm, cancel]` into `FormActions`. Cancel-only stays one action.
- Title: `...typography.heading` and `fontWeight: '700'`. No raw `fontSize`.
- Body: `...typography.prose`. Color stays `themeStyles.textSecondary.color`.
- Do not use one `gap` on `dialog` for title, body, and actions.
  - Title `marginBottom`: `tokens.spacing.md` (same 8pt seam as today).
  - `FormActions` `style` `marginTop`: `formActionsTopGap(tokens.spacing)` (20).
- Dialog padding stays `tokens.spacing.xl`.

## Rows to move onto FormActions

Preserve left-to-right as top-to-bottom. Keep every `testID`. Pass `fullWidth` only through
`FormActions` (it already sets it). Delete the row style when nothing else uses it.

Paths, in table order:

- `apps/mobile/src/screens/clip/ClipDetailScreen.tsx`
- `apps/mobile/src/screens/more/MoreErrorLogScreen.tsx`
- `apps/mobile/src/screens/more/MoreErrorLogDetailScreen.tsx`
- `apps/mobile/src/screens/library/useAddToPlaylist.tsx`
- `apps/mobile/src/terms/AccountAccessPanel.tsx`
- `apps/mobile/src/components/membership/MembershipStrikeCheckout.tsx`

| Place                           | Today                                  | Top to bottom                                      |
|---------------------------------|----------------------------------------|----------------------------------------------------|
| Clip detail owner actions       | Edit and Delete in a row               | Edit secondary, then Delete danger                 |
| Error log Export / Clear        | `size="sm"`, one row                   | Export, then Clear secondary                       |
| Error log detail Copy / Email   | Copy, Email, and status in one row     | Copy, then Email secondary. Status under the block |
| Add to playlist sheet           | Create and Close, label width          | Create secondary when shown, then Close secondary  |
| Account access primary actions  | Review Terms and Sign Out, label width | Review Terms, then Sign Out secondary              |
| Strike checkout invoice actions | Copy and Open Wallet, gap `spacing.sm` | Copy primary, then Open Wallet outline             |

Above each of those blocks, set `marginTop` to `formActionsTopGap`. On the error-log list
header, keep the actions' existing `marginBottom` so the first row does not move up into the
buttons.

These already use `FormActions` and pick up the column with no array edit:

- `MoreCustomApiScreen` Cancel + Save, and the Reset block under it
- `PlaylistFormScreen` Cancel + Save, and Delete under it
- `MakeClipScreen` How To + FAQ, and Delete above that pair
- `BoostSheet` Cancel + Submit
- Login, Sign up, Add by RSS, and credentials screens (one button; layout unchanged)

`MakeClipScreen` `followingActions`, playlist `deleteAction`, and custom-api `reset` already
use `formActionsGap` as `marginTop`. Leave those margins.

## OPML rate-limit sheet

`MoreOpmlScreen` is a bottom sheet with one Close button. Leave it a sheet. Do not convert it
to `ConfirmDialog`.

- `sheetMessage`: `...typography.prose` instead of `fontSize: 15`.
- Close becomes one `FormActions` action (`variant: 'secondary'`, testID
  `opml-rate-limit-close`).
- `sheetActions.marginTop` becomes `formActionsTopGap`.

## Guidance

The current rule is why the row exists. Update it in the same change.

`.cursor/rules/mobile-screen-layout.mdc`, section **Static form-style screens**:

- Replace the sentence that puts two or more actions in equal slots on one row.
- Say: `FormActions` is a column. Every action is full width. Array order is top to bottom.
  Page and sheet forms pass dismiss or secondary first and confirm last, so confirm sits at
  the bottom. `ConfirmDialog` passes confirm then cancel, so confirm sits on top. A
  destructive action stays its own `FormActions` under the column, with `formActionsGap`
  above it.
- Say: the paragraph in a dialog, sheet, or form starts at `typography.prose`. Do not
  hardcode `fontSize`, and do not start that paragraph at `caption` or `body`.
- Say: `formActionsTopGap` is the seam above the action block. Do not reuse the body's
  `spacing.md` / `spacing.base` gap for that seam. `formActionsGap` is the gap between those
  buttons.
- Keep the `size="form"` / `FORM_BUTTON_MIN_HEIGHT` bullet. Keep header, row, and
  identity-block actions on `sm` or `md`.
- Delete "do not put the confirm action on the left." That sentence describes a row.

`.cursor/skills/mobile-reusable-components/SKILL.md`, the **Static form-style screens**
paragraph: same column, type, and gap. Point at `mobile-screen-layout`. Do not leave the
"share the row equally, confirm on the right" sentence in place.

`formActionsGap` in `screenLayout.ts`: extend the comment so it also names the gap inside
`FormActions`. No behavior change in that helper.

No product comment may point at this plan.

## Reviewed and left

| Surface                                  | Why it stays                                          |
|------------------------------------------|-------------------------------------------------------|
| Clip time card Play / Clear              | `sm` tools inside a time card, not a decision footer  |
| Playlist detail Share / Subscribe / Edit | `sm` identity actions on the header                   |
| Player transport, row actions, chips     | Not a form. Header actions stay `sm` or `md`          |
| Call to action fills                     | Already a full-width column. Message is `subheading`  |
| Membership checkout Terms / Privacy      | Text links. Purchase is already one full-width button |
| Search preview and HelperNote            | Other plan. Do not edit                               |
| Sign-up success screen                   | Already a replacement screen. Do not put the form back |
| Sign-up terms accordion `spacing.xl`     | Already the seam under the agreement date             |
| Web modal and management form footers    | Desktop. Right-aligned row stays                      |

## Out of scope

- New strings, catalog edits, API, or web.
- The type ramp and the spacing scale.
- Restyling every raw `fontSize` on screens that are not in the tables above.
- Maestro flow edits. Flows tap `testID`s, which stay put.

## Verify

Do not run these during implementation. **Mobile Maestro**, after **Mobile E2E Metro**,
**Mobile E2E API**, and **Mobile E2E iOS** / **Mobile E2E Android** are already up:

```bash
npm run mobile:e2e:test -- membership-gate
npm run mobile:e2e:test -- subscriptions-anonymous
npm run mobile:e2e:test -- library-playlists
npm run mobile:e2e:test -- custom-api
npm run mobile:e2e:test -- podcast-episode
open .artifacts/mobile-e2e-reports/latest/failures.json
open .artifacts/mobile-e2e-reports/latest/ios-phone/index.html
open .artifacts/mobile-e2e-reports/latest/android-phone/index.html
```

On the premium gate shot, the confirm label is one full-width button with Cancel under it,
the body is larger than the old 15pt line, and there is a clear band between that body and
the buttons. Phase 2 changes that confirm label to Buy Membership for a Trial account. Do
not rename it in this step.
