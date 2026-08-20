import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { isSupabaseServerConfigured, supabaseServer } from '@/lib/supabase-server';
import { isGoldSubscription } from '@/lib/subscription';

const CHAT_BUCKET = 'wpx-chat-media';
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

async function requireGold(userId: string) {
  const { data: subscription } = await supabaseServer
    .from('subscriptions')
    .select('status, current_period_end, plan_id, plans!plan_id(id, product_name, name)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('current_period_end', { ascending: false })
    .limit(1)
    .maybeSingle();
  return isGoldSubscription(subscription);
}

export async function PATCH(request: NextRequest) {
  if (!isSupabaseServerConfigured) return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 500 });
  let authContext;
  try {
    authContext = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!(await requireGold(authContext.user.id))) {
    return NextResponse.json({ error: 'Gold membership is required for chat wallpapers.' }, { status: 403 });
  }

  const contentType = request.headers.get('content-type') || '';
  let body: any = {};
  let wallpaperUrl: string | null | undefined;
  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    body = Object.fromEntries(formData.entries());
    const file = formData.get('wallpaper');
    if (file && typeof file !== 'string' && 'arrayBuffer' in file) {
      const image = file as File;
      if (!IMAGE_TYPES.includes(image.type)) return NextResponse.json({ error: 'Unsupported wallpaper image.' }, { status: 400 });
      const fileName = `${Date.now()}-${image.name.replace(/\s+/g, '-')}`;
      const { data: upload, error: uploadError } = await supabaseServer.storage
        .from(CHAT_BUCKET)
        .upload(`wallpapers/${authContext.user.id}/${fileName}`, image, { contentType: image.type, upsert: false });
      if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });
      wallpaperUrl = supabaseServer.storage.from(CHAT_BUCKET).getPublicUrl(upload.path).data.publicUrl;
    }
  } else {
    body = await request.json().catch(() => ({}));
  }

  if (typeof body.conversationId !== 'string') return NextResponse.json({ error: 'conversationId is required.' }, { status: 400 });
  const wallpaperColor = body.wallpaperColor == null || body.wallpaperColor === '' ? null : String(body.wallpaperColor);
  if (wallpaperColor && !/^#[0-9a-f]{6}$/i.test(wallpaperColor)) return NextResponse.json({ error: 'Invalid wallpaper color.' }, { status: 400 });
  if (body.reset === true) wallpaperUrl = null;
  if (wallpaperUrl === undefined && body.wallpaperUrl !== undefined) wallpaperUrl = body.wallpaperUrl || null;

  const { data: membership } = await supabaseServer
    .from('wpx_conversation_members')
    .select('conversation_id')
    .eq('conversation_id', body.conversationId)
    .eq('user_id', authContext.user.id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const updates: Record<string, string | null> = { wallpaper_color: wallpaperColor };
  if (wallpaperUrl !== undefined) updates.wallpaper_url = wallpaperUrl;
  if (body.reset === true) updates.wallpaper_color = null;
  const { error } = await supabaseServer
    .from('wpx_conversation_members')
    .update(updates)
    .eq('conversation_id', body.conversationId)
    .eq('user_id', authContext.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, wallpaperUrl: wallpaperUrl ?? null, wallpaperColor: updates.wallpaper_color });
}
