/**
 * Digits on a count badge. With no max, the digits are the count. With a max, a count above it
 * reads as that max followed by "+".
 */
export function formatCountBadgeFace(count: number, max?: number): string {
  if (max !== undefined && count > max) {
    return `${max}+`;
  }
  return String(count);
}
