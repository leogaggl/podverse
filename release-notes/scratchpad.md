## Playback starts after the media address is ready

- Surfaces: web
- Change: Starting playback waits until the episode file URL is on the player, or until HLS playback is attached, before deciding the address is invalid. A new episode keeps its file list in that first update, so play no longer reports "The media address is not valid" and then stays stuck. HLS playback can start while the element has no `src`.
- Who notices: listeners on web, especially when pressing Play on an episode, chapter, music track, or stream handoff

## Removed content rows read as one paragraph

- Surfaces: web
- Change: Each removed-content row is one paragraph of its sentences in order, separated by spaces.
  A screen reader reads that paragraph once.
- Who notices: people reading Settings → Advanced → Removed Content, including with a screen reader

## Queue row clicks play the episode

- Surfaces: web
- Change: The queue reorder grip is the drag handle. Pressing an episode, clip, track, or Add by
  RSS row plays it. A handle on the whole row was canceling that press.
- Who notices: anyone playing from the queue on web

## Archived and merged shows stay out of the dev error overlay

- Surfaces: web, mobile
- Change: A feed request that returns 410 because the show left the directory, or because it was
  merged into another show or episode, is no longer written with `console.error`. The apps already
  drop or remap that follow. Any other 410 still logs.
- Who notices: developers, and device tests that sign in to an account still following an archived
  show. The red error overlay was covering the screen.

## Playlist entries show on the phone

- Surfaces: api, mobile
- Change: A playlist entry response includes `playlist_id`. The phone stores that id with the
  entry. Without it, opening a playlist kept the title and showed no episodes, clips, or removed
  rows.
- Who notices: listeners opening a playlist on the phone

## Add by RSS now-playing keeps the listen time

- Surfaces: api
- Change: Making an Add by RSS episode now-playing or history stores `last_played_at` and
  `last_played_received_at`, and ignores a write older than the row already stored. Catalog
  episodes already did this. Without the timestamp, another device could not offer to switch to
  that episode.
- Who notices: listeners who play an Add by RSS episode on one device and open the app on another

## Switch Episode closes the other-device prompt

- Surfaces: mobile
- Change: Choosing Switch Episode records that other device's episode, so the same prompt
  cannot open again while the phone is starting it. Continue Here already did this.
- Who notices: listeners who switch to the episode playing on another device
