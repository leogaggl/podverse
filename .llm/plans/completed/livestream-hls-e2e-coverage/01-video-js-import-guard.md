**Cursor model:** Cursor Grok 4.7 · **Reasoning:** low

# 01 — Block video.js imports

## Rows

Guard against reintroducing video.js after its removal.

## Runs after

none

## Files

- `eslint.config.mjs`

## Change

Add one config object to the array in `eslint.config.mjs`, next to the existing
`files: ['apps/web/src/**/*.{ts,tsx}']` block that holds the `mediaRef` `no-restricted-syntax`
rules. Do not merge it into that block: that block has `ignores` for the bridge files, and this
guard has no exceptions.

```js
{
  files: ['apps/web/src/**/*.{ts,tsx}', 'apps/management-web/src/**/*.{ts,tsx}'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: 'video.js',
            message:
              'Livestreams play through MediaElement with hls.js; do not add video.js (see .cursor/skills/media-player-architecture/SKILL.md).',
          },
        ],
        patterns: [
          {
            group: ['video.js/*', '@videojs/*'],
            message:
              'Livestreams play through MediaElement with hls.js; do not add Video.js packages (see .cursor/skills/media-player-architecture/SKILL.md).',
          },
        ],
      },
    ],
  },
},
```

Before adding it, grep `eslint.config.mjs` for another `no-restricted-imports` that already
matches these files. A later config object replaces an earlier one's options for the same rule,
so if one exists, add these `paths` and `patterns` entries to that existing rule instead of
creating a second object.

## Tests

None. `npm run lint` covers it.

## Release scratchpad

none
