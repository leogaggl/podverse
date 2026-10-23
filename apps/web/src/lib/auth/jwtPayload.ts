function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function decodeBase64Url(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * Reads a JWT's payload without verifying its signature. Only for decisions the API re-checks:
 * when to ask for a renewal, and which local data to clear on sign-out.
 */
export function decodeJwtPayloadUnverified(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }
  const payloadSegment = parts[1];
  if (payloadSegment === undefined) {
    return null;
  }
  try {
    const payload: unknown = JSON.parse(decodeBase64Url(payloadSegment));
    return isRecord(payload) ? payload : null;
  } catch {
    return null;
  }
}
