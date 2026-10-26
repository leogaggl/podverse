## Embed list rows show Live before the date

- Surfaces: web (embed player)
- Change: In list embeds (podcast, album, playlist), a currently live row moves the Live badge
  off the title line onto the date line, to the right of Play and before the date, in place of
  the duration. The title line shows only the title. Row height is unchanged.
- Who notices: sites that embed a Podverse list whose channel is live
- Operator steps: none

## Mobile livestream rows show their status where the duration sits

- Surfaces: mobile
- Change: Livestream item rows on Home, Browse, a podcast's episode list, and the Add by RSS
  library and feed pages show the Live, Scheduled, or Ended badge in the play band, beside Play
  where an episode shows its duration (or at the start of that band when there is no Play). The
  badge no longer sits on the artwork, before the show name, or on the date line, and it
  replaces the duration. The date stays under the title. Rows that had no play band before,
  such as Scheduled and Ended rows in the Add by RSS library and on Add by RSS feed pages, now
  show one with the badge and, where the row has any, the More button. Show rows and grid tiles
  keep Live on the artwork. On a podcast or album list, a livestream row's More menu is Share
  only: no queue, playlist, or mark as played.
- Who notices: listeners browsing livestreams on mobile
- Operator steps: none

## Mobile livestream rows inside a podcast show a date

- Surfaces: mobile
- Change: On a podcast's episode list and an Add by RSS feed's episode list, a livestream row with
  no publish date shows its start date under the title, as the Home and Browse livestream lists
  already do. Ended Add by RSS streams now show their start date too. Live rows in a podcast's
  episode list no longer show the new-content dot, since a scheduled start lies in the future.
- Who notices: listeners opening a podcast that has livestreams
- Operator steps: none

## Mobile scheduled and ended livestreams cannot start from a podcast's episode list

- Surfaces: mobile
- Change: On a podcast's episode list and an album's track list, a Scheduled or Ended livestream
  row no longer shows Play and cannot be started from the list. Only a Live row has Play.
  Pressing the row opens the livestream page. Home, Browse, and Add by RSS lists already worked
  this way.
- Who notices: listeners opening a podcast or album that has scheduled or ended livestreams
- Operator steps: none

## Mobile album livestreams use the livestream row

- Surfaces: mobile
- Change: A livestream in an album's track list renders like a podcast's livestream: the date
  (the start date when there is no publish date) and description under the title, and a play band
  with the Live, Scheduled, or Ended badge. Pressing the row opens the livestream page instead of
  starting playback. Only a Live stream has Play. Ordinary tracks keep the compact track row. The
  livestream row's More menu is Share only: no queue, playlist, or mark as played.
- Who notices: listeners opening an album that has livestreams
- Operator steps: none

## A livestream without a status is not saved

- Surfaces: parser, workers
- Change: A podcast:liveItem whose status is missing or not pending, live, or ended is not saved
  and is not returned in a mapped feed. The parser used to store that item as Scheduled. A live
  item already in the database is left in place when a later parse skips it for this reason.
- Who notices: feeds that publish a liveItem tag without a status; those items no longer appear
  as Scheduled
- Operator steps: none
