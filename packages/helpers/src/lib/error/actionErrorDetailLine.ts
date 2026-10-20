/**
 * Machine detail a user can screenshot for the host or for support. Empty parts are omitted.
 */
export const actionErrorDetailLine = (parts: {
  code: string;
  httpStatus?: number;
  message: string;
  reason: string;
}): string => {
  const status = parts.httpStatus === undefined ? '' : `HTTP ${parts.httpStatus}`;
  return [parts.reason, status, parts.code, parts.message]
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join(' · ');
};
