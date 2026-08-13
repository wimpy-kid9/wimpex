import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { isSupabaseServerConfigured, supabaseServer } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 500 });
  }

  try {
    const authContext = await requireAuth(request);
    const formData = await request.formData();
    const file = formData.get('avatar') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No avatar file provided.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const extension = file.name.split('.').pop()?.toLowerCase() || 'png';
    const path = `${authContext.user.id}/avatar.${extension}`;

    const { error: uploadError } = await supabaseServer.storage.from('wpx-avatars').upload(path, buffer, {
      contentType: file.type || 'image/png',
      upsert: true
    });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data } = supabaseServer.storage.from('wpx-avatars').getPublicUrl(path);
    const avatarUrl = data.publicUrl;

    return NextResponse.json({ ok: true, avatarUrl });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
