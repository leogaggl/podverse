import type { Response } from 'express';

export type MergedIntoKind = 'channel' | 'item';

export function sendMergedInto(res: Response, kind: MergedIntoKind, idText: string): void {
  res.status(410).json({
    merged_into: {
      kind,
      id_text: idText,
    },
  });
}
