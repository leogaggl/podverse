## Restore returns to Membership

- Surfaces: mobile
- Change: A restore that extends membership shows the result, then opens Membership after a few seconds, the same way a completed purchase does.
- Who notices: someone restoring a store purchase on Extend Membership

## Billing setup without management

- Surfaces: workers, api, management-api, k8s ops
- Change: `billingProcessorProductAdd` and `billingCheckoutChannelEnable` insert a missing
  Premium store-product row or turn a checkout channel on. They never update, reactivate, or
  remove an existing row. The same commands run locally or as a one-off Job from the suspended
  CronJob `ops-billing-setup` (`npm run billing:setup:k8s`). Apple and Google adapters map a
  purchase from `billing_processor_product` instead of `BILLING_PRODUCT_*` env. PayPal and
  Strike product ids stay the fixed ids in code (`--defaults`).
- Who notices: operators who set up billing without the management app; an Apple or Google
  purchase maps when the row exists in the database
- Operator steps: bump the alpha ops ref in `k.podcastdj.com` so the CronJob syncs

## Full player bar

- Surfaces: mobile
- Change: The scrubber clocks for position and duration are 14 and use the link color. The item
  title is 28 and the chapter or clip name is 22. The band under the art is reserved when the
  item has chapters or the target is a clip; otherwise the artwork takes that height. A long
  chapter or clip name scrolls. Music transport is previous, play, and next. Shuffle and repeat
  sit with sleep and More. Music plays at 1x, and the last audio or video speed returns when
  that kind of item plays again. The music player has no Clips chip and no create-clip action.
  An Add by RSS item from a music-medium feed follows those rules, including the music queue.
  The item title and the channel name open their screens. Add by RSS opens the local feed from
  the channel name, and its title is not a link. A seek that is still settling keeps the
  position the listener chose.
- Who notices: someone using the full player, including music and items without chapters

## List rows and the mini player

- Surfaces: mobile
- Change: List artwork is 78. Mini-player art stays 60. The lines in a show row use the base
  gap, and the padding around a Home row hairline uses the large spacing token. A Home show row
  is the date, the title, then how many episodes are downloaded, including zero. A Browse
  podcast or album row is the date, the title, then the author. The date has no "Latest
  episode" prefix and uses the link color. Add by RSS show rows have no download count. Chips
  above a list, including the option chips on Queue, History, and Search, keep one gap under
  the chips. Header action icons are 26pt. The chapter strip above the mini player scrolls when
  the name is long. Episode, clip, and track rows stay show name, title, then date.
- Who notices: someone browsing Home, Browse, Queue, History, or Search, or glancing at the
  mini player

## People chip

- Surfaces: mobile, web
- Change: People are their own chip, and on desktop channel pages their own side column. About
  and Summary no longer include people. The chip shows when that channel or item has people,
  even when the description is empty. Channel screens use the channel's people. Item screens
  use the item's people.
- Who notices: someone opening About, Summary, or People on a podcast, album, artist, episode,
  or track

## Image viewer

- Surfaces: mobile
- Change: Opening artwork slides up a full-screen viewer on the root stack and dismisses from
  the top edge. Add by RSS artwork loads with headers resolved from the feed URL. The route
  carries that URL and never an Authorization value. Download stays off the menu when those
  headers are required.
- Who notices: someone tapping artwork, including protected Add by RSS art

## Artist chips and list hairlines

- Surfaces: mobile
- Change: An artist always offers Albums, Tracks, and About. Tracks stays when the list is
  empty. Album rows and podroll rows draw a top hairline, including the first row. Settings
  cards do not use that hairline.
- Who notices: someone on an artist, or looking at an album list or a podroll

## Downloads reveal

- Surfaces: mobile
- Change: Swiping an in-progress download still reveals Remove. A progress tick updates the bar
  inside the sliding row and does not relayout the reveal. The bar stops at the row edge.
- Who notices: someone swiping a download that is still in progress

## Settings chrome

- Surfaces: mobile
- Change: A label beside a switch uses the menu title size. Groups inside a settings card
  separate with a hairline that has equal space above and below and no extra horizontal inset.
  The group is not a bordered box. Cards use a wider gap between them, and one gap from a
  heading to its description to its button. Option rows match menu rows. Help, warnings, feed
  status lines such as "Last Parsed", and menu subtitles use body type. A count, or the
  agreement date under an accordion title, stays caption. The Terms of Service "Valid since"
  line is heading size in the link color.
- Who notices: someone in Settings, Notifications, Terms of Service, or on a screen that shows
  a feed status line
