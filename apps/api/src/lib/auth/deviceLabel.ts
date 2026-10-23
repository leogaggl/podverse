/**
 * Session device labels are brand names only (`Chrome · macOS`, `iOS`), so a stored label reads
 * the same in every locale. Order matters: several user agents name more than one browser or OS
 * (Edge and Opera also say `Chrome/`; iOS says `Mac OS X`; Android says `Linux`).
 */
const BROWSER_MARKERS: ReadonlyArray<{ label: string; markers: readonly string[] }> = [
  { label: 'Edge', markers: ['Edg/'] },
  { label: 'Opera', markers: ['OPR/'] },
  { label: 'Samsung Internet', markers: ['SamsungBrowser/'] },
  { label: 'Firefox', markers: ['Firefox/', 'FxiOS/'] },
  { label: 'Chrome', markers: ['Chrome/', 'CriOS/'] },
  { label: 'Safari', markers: ['Safari/'] },
];

const OS_MARKERS: ReadonlyArray<{ label: string; markers: readonly string[] }> = [
  { label: 'iOS', markers: ['iPhone', 'iPad'] },
  { label: 'Android', markers: ['Android'] },
  { label: 'ChromeOS', markers: ['CrOS'] },
  { label: 'Windows', markers: ['Windows'] },
  { label: 'macOS', markers: ['Mac OS X'] },
  { label: 'Linux', markers: ['Linux'] },
];

const MOBILE_PLATFORM_LABELS: ReadonlyMap<string, string> = new Map([
  ['ios', 'iOS'],
  ['android', 'Android'],
]);

function firstMatchingLabel(
  userAgent: string,
  table: ReadonlyArray<{ label: string; markers: readonly string[] }>
): string | null {
  const match = table.find((entry) => entry.markers.some((marker) => userAgent.includes(marker)));
  return match?.label ?? null;
}

/** `"<Browser> · <OS>"`, or whichever half is recognized, or null. */
export function deviceLabelFromUserAgent(userAgent: string | undefined): string | null {
  if (userAgent === undefined || userAgent === '') {
    return null;
  }
  const browser = firstMatchingLabel(userAgent, BROWSER_MARKERS);
  const os = firstMatchingLabel(userAgent, OS_MARKERS);
  if (browser !== null && os !== null) {
    return `${browser} · ${os}`;
  }
  return browser ?? os;
}

/** The app's own `device_label` when it sends one, else the platform from the client header. */
export function deviceLabelForMobile(input: {
  bodyLabel: unknown;
  platformHeader: string | undefined;
}): string | null {
  if (typeof input.bodyLabel === 'string' && input.bodyLabel.trim() !== '') {
    return input.bodyLabel;
  }
  const platform = input.platformHeader?.trim().toLowerCase() ?? '';
  return MOBILE_PLATFORM_LABELS.get(platform) ?? null;
}
