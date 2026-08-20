import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { isSupabaseServerConfigured, supabaseServer } from '@/lib/supabase-server';
import { isUserGold } from '@/lib/gold';

const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);

export async function POST(request: NextRequest) {
  if (!isSupabaseServerConfigured) return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 500 });
  let authContext;
  try { authContext = await requireAuth(request); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  if (!(await isUserGold(authContext.user.id))) return NextResponse.json({ error: 'Gold membership is required for profile customization.' }, { status: 403 });

  const formData = await request.formData();
  const file = formData.get('file');
  const kind = formData.get('kind')?.toString();
  if (!file || typeof file === 'string' || !['banner'].includes(kind || '')) return NextResponse.json({ error: 'A banner image is required.' }, { status: 400 });
  if (!allowedTypes.has(file.type)) return NextResponse.json({ error: 'Unsupported image type.' }, { status: 400 });
  if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: 'Banner images must be 8 MB or smaller.' }, { status: 400 });

  const path = `${authContext.user.id}/banner-${Date.now()}`;
  const { error: uploadError } = await supabaseServer.storage.from('wpx-avatars').upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });
  const bannerUrl = supabaseServer.storage.from('wpx-avatars').getPublicUrl(path).data.publicUrl;
  const { error: profileError } = await supabaseServer.from('wpx_profiles').update({ banner_url: bannerUrl }).eq('user_id', authContext.user.id);
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  return NextResponse.json({ ok: true, bannerUrl });
}
