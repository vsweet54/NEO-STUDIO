import { NextRequest, NextResponse } from 'next/server';
import { VERIFIED_MODELS } from '@/lib/providers/registry';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const providerId = searchParams.get('providerId');

  let models = VERIFIED_MODELS;
  if (providerId) {
    models = models.filter((m) => m.providerId === providerId);
  }

  return NextResponse.json({ success: true, models });
}
