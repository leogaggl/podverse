import { NextResponse } from 'next/server';

import { getConfig } from '../../../config';
import { buildAndroidAssetLinks } from '../../../lib/mobileAppLinks';

export const dynamic = 'force-dynamic';

const ASSOCIATION_HEADERS = {
  'Cache-Control': 'public, max-age=300',
};

export function GET() {
  const { androidPackageName, androidSha256CertFingerprints } = getConfig().public.mobileAppLinks;
  const body = buildAndroidAssetLinks(androidPackageName, androidSha256CertFingerprints);
  if (body === null) {
    return new NextResponse(null, { status: 404 });
  }
  return NextResponse.json(body, { headers: ASSOCIATION_HEADERS });
}
