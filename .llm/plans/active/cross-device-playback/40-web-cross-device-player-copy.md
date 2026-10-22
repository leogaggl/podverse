**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# 40 — Player copy for cross-device playback (consumer catalog)

Adds every user-facing string the web player needs for cross-device playback: the device button
and menu, the "Playing on …" caption, the transfer failure notice, and the tap-to-play prompt.
Plans 42–46 read these keys; none of them adds catalog keys of its own.

The keys live in the **consumer** layer, which web and mobile both load, under
`media_player.cross_device`. The mobile player UI (area E) can reuse the device-menu, caption, and
failure keys as they are. `tap_to_play.*` is web-only wording ("this browser").

## Rows

R8, R12, R39, R41, R44, R62

## Runs after

none

## Files

packages/i18n-catalog/consumer/originals/en-US.json
packages/i18n-catalog/consumer/originals/es.json
packages/i18n-catalog/consumer/originals/fr.json
packages/i18n-catalog/consumer/originals/el-GR.json
packages/i18n-catalog/consumer/overrides/es.json
packages/i18n-catalog/consumer/overrides/fr.json
packages/i18n-catalog/consumer/overrides/el-GR.json

## Where to insert

The catalogs are large (**large-file-reading**). In each file, Grep for `"handoff": {` under
`"media_player"`, read a short window, and insert the new `"cross_device"` object **directly after
the closing `},` of `handoff`** (before `"step_back"`) with StrReplace. Never rewrite a catalog
file. Keep the same key order in all seven files: `i18n:validate` checks parity and order.

Each overrides file gets the same structure with every leaf set to `""`, the same way `handoff`
appears there. There is no `en-US` overrides file to edit.

If another plan already added a `media_player.cross_device` object (area E works at the same
time), merge into it: keep its keys, add the missing ones below in this order, and do not create a
second object. If a key below already exists with different text, keep the existing text and say
so in the final message.

## Keys

Placeholders are ICU arguments, as elsewhere in the catalog (`{device}`, `{name}`, `{number}`).
Use the Unicode ellipsis `…`, not three dots.

### en-US

```json
"cross_device": {
  "devices_button": "Playback Devices",
  "this_device": "This Device",
  "playing": "Playing",
  "sending": "Sending…",
  "device_with_number": "{name} ({number})",
  "unnamed_web_device": "Web Browser",
  "unnamed_mobile_device": "Mobile App",
  "unknown_device": "the other device",
  "playing_on_device": "Playing on {device}",
  "playing_in_another_tab": "Playing in Another Tab",
  "sending_to_device": "Sending to {device}…",
  "transfer_failed": {
    "autoplay_blocked": "Playback on {device} needs a tap first. Tap Play Here on that device.",
    "load_failed": "Could not start playback on {device}.",
    "no_response": "No response from {device}. Try again.",
    "not_connected": "Could not reach {device}. It may have closed.",
    "request_failed": "Could not send playback to {device}. Try again."
  },
  "tap_to_play": {
    "title": "Ready to Play Here",
    "body": "Playback moved to this browser. Your browser needs a tap before it can start audio.",
    "play_action": "Play Here",
    "dismiss_action": "Not Now"
  }
},
```

Casing follows **ui-copy-casing**: labels, captions, and buttons are title case; the failure
messages and the prompt body are sentences.

### es

```json
"cross_device": {
  "devices_button": "Dispositivos de reproducción",
  "this_device": "Este dispositivo",
  "playing": "Reproduciendo",
  "sending": "Enviando…",
  "device_with_number": "{name} ({number})",
  "unnamed_web_device": "Navegador web",
  "unnamed_mobile_device": "Aplicación móvil",
  "unknown_device": "el otro dispositivo",
  "playing_on_device": "Reproduciendo en {device}",
  "playing_in_another_tab": "Reproduciendo en otra pestaña",
  "sending_to_device": "Enviando a {device}…",
  "transfer_failed": {
    "autoplay_blocked": "La reproducción en {device} necesita un toque primero. Toca Reproducir aquí en ese dispositivo.",
    "load_failed": "No se pudo iniciar la reproducción en {device}.",
    "no_response": "Sin respuesta de {device}. Inténtalo de nuevo.",
    "not_connected": "No se pudo contactar con {device}. Puede que se haya cerrado.",
    "request_failed": "No se pudo enviar la reproducción a {device}. Inténtalo de nuevo."
  },
  "tap_to_play": {
    "title": "Listo para reproducir aquí",
    "body": "La reproducción se movió a este navegador. Tu navegador necesita un toque antes de poder iniciar el audio.",
    "play_action": "Reproducir aquí",
    "dismiss_action": "Ahora no"
  }
},
```

### fr

```json
"cross_device": {
  "devices_button": "Appareils de lecture",
  "this_device": "Cet appareil",
  "playing": "En lecture",
  "sending": "Envoi…",
  "device_with_number": "{name} ({number})",
  "unnamed_web_device": "Navigateur web",
  "unnamed_mobile_device": "Application mobile",
  "unknown_device": "l'autre appareil",
  "playing_on_device": "Lecture sur {device}",
  "playing_in_another_tab": "Lecture dans un autre onglet",
  "sending_to_device": "Envoi vers {device}…",
  "transfer_failed": {
    "autoplay_blocked": "La lecture sur {device} nécessite d'abord un appui. Appuyez sur Lire ici sur cet appareil.",
    "load_failed": "Impossible de lancer la lecture sur {device}.",
    "no_response": "Aucune réponse de {device}. Réessayez.",
    "not_connected": "Impossible de joindre {device}. Il a peut-être été fermé.",
    "request_failed": "Impossible d'envoyer la lecture vers {device}. Réessayez."
  },
  "tap_to_play": {
    "title": "Prêt à lire ici",
    "body": "La lecture a été déplacée vers ce navigateur. Votre navigateur a besoin d'un appui avant de pouvoir lancer l'audio.",
    "play_action": "Lire ici",
    "dismiss_action": "Pas maintenant"
  }
},
```

### el-GR

Greek device labels take different articles and cases, so the Greek strings put `{device}` after
a colon or in parentheses instead of inside a phrase.

```json
"cross_device": {
  "devices_button": "Συσκευές αναπαραγωγής",
  "this_device": "Αυτή η συσκευή",
  "playing": "Αναπαράγεται",
  "sending": "Αποστολή…",
  "device_with_number": "{name} ({number})",
  "unnamed_web_device": "Πρόγραμμα περιήγησης",
  "unnamed_mobile_device": "Εφαρμογή κινητού",
  "unknown_device": "άλλη συσκευή",
  "playing_on_device": "Αναπαραγωγή σε: {device}",
  "playing_in_another_tab": "Αναπαραγωγή σε άλλη καρτέλα",
  "sending_to_device": "Αποστολή σε: {device}…",
  "transfer_failed": {
    "autoplay_blocked": "Η αναπαραγωγή χρειάζεται πρώτα ένα πάτημα ({device}). Πατήστε «Αναπαραγωγή εδώ» σε εκείνη τη συσκευή.",
    "load_failed": "Δεν ήταν δυνατή η έναρξη της αναπαραγωγής ({device}).",
    "no_response": "Καμία απόκριση ({device}). Δοκιμάστε ξανά.",
    "not_connected": "Δεν ήταν δυνατή η σύνδεση ({device}). Ίσως έχει κλείσει.",
    "request_failed": "Δεν ήταν δυνατή η αποστολή της αναπαραγωγής ({device}). Δοκιμάστε ξανά."
  },
  "tap_to_play": {
    "title": "Έτοιμο για αναπαραγωγή εδώ",
    "body": "Η αναπαραγωγή μεταφέρθηκε σε αυτό το πρόγραμμα περιήγησης. Το πρόγραμμα περιήγησης χρειάζεται ένα πάτημα πριν ξεκινήσει τον ήχο.",
    "play_action": "Αναπαραγωγή εδώ",
    "dismiss_action": "Όχι τώρα"
  }
},
```

### Overrides (es, fr, el-GR)

```json
"cross_device": {
  "devices_button": "",
  "this_device": "",
  "playing": "",
  "sending": "",
  "device_with_number": "",
  "unnamed_web_device": "",
  "unnamed_mobile_device": "",
  "unknown_device": "",
  "playing_on_device": "",
  "playing_in_another_tab": "",
  "sending_to_device": "",
  "transfer_failed": {
    "autoplay_blocked": "",
    "load_failed": "",
    "no_response": "",
    "not_connected": "",
    "request_failed": ""
  },
  "tap_to_play": {
    "title": "",
    "body": "",
    "play_action": "",
    "dismiss_action": ""
  }
},
```

Match each file's existing indentation (the `handoff` block shows it); the blocks above show the
structure, not the indent depth.

## How later plans use the keys

- `useTranslations('media_player')` then `t('cross_device.playing_on_device', { device })`.
- `transfer_failed.<reason>` takes the reason values of plan 21's `TransferFailureReason`
  (`autoplay_blocked`, `load_failed`, `no_response`, `not_connected`, `request_failed`). Mobile's
  `timeout` maps to `no_response` and `send_failed` to `request_failed` if area E reuses them.
- `unknown_device` fills `{device}` when the session is not in the device list.

## Must stay true

- `npm run i18n:validate` passes: four locales, override structure equals originals, same key
  order in every locale, no key path duplicated in the `shared` or `mobile` layers.
- No empty string in any `originals/` file.

## Tests

None beyond catalog validation; the strings are exercised by plan 47's Playwright spec.

## Release scratchpad

none (the strings ship with the player changes in plans 42–46, whose entries describe them)
