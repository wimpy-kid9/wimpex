import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getMutualFollows } from '@/lib/mutual-follows';

export async function GET(request: NextRequest) {
  let authContext;
  try {
    authContext = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const mutual = await getMutualFollows(authContext.user.id);
  return NextResponse.json({ mutual });
}
