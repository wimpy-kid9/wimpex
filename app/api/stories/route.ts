import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { isSupabaseServerConfigured, supabaseServer } from '@/lib/supabase-server';
import { getMutualFollows } from '@/lib/mutual-follows';

const VIDEO_BUCKET = 'wpx-videos';
const IMAGE_BUCKET = 'wpx-images';

const MAX_TEXT_STORY_LENGTH = 500;
const MAX_OVERLAY_TEXT_LENGTH = 120;

// Keep this list in sync with the FONT_OPTIONS ids in stories-create-page.tsx.
// Validated server-side too, since font/background are just stored strings
// and we don't want arbitrary CSS sneaking into the column.
const ALLOWED_FONTS = new Set(['sans', 'serif', 'mono', 'display', 'script']);

function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);
}

function isGradientToken(value: unknown): value is string {
  // Background presets are sent as short tokens like "grad-gold-obsidian"
  // rather than raw CSS, and resolved to a gradient on the client. Accept
  // either a validated token or a plain hex.
  return typeof value === 'string' && /^grad-[a-z0-9-]+$/.test(value);
}

function clampPercent(value: unknown): number | null {
  const num = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN;
  if (Number.isNaN(num)) return null;
  return Math.min(100, Math.max(0, num));
}

function clampScale(value: unknown): number | null {
  const num = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN;
  if (Number.isNaN(num)) return null;
  return Math.min(3, Math.max(0.5, num));
}

function clampRotation(value: unknown): number | null {
  const num = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN;
  if (Number.isNaN(num)) return null;
  return Math.min(180, Math.max(-180, num));
}

async function loadAuthors(authorIds: string[]) {
  if (authorIds.length === 0) return {};
  const { data: authors } = await supabaseServer
    .from('wpx_profiles')
    .select('user_id, display_name, username, avatar_url')
    .in('user_id', authorIds);
  return (authors || []).reduce((acc: Record<string, any>, author: any) => {
    if (author?.user_id) acc[author.user_id] = author;
    return acc;
  }, {});
}

function serializeStory(story: any, authorMap: Record<string, any>, viewedIds: Set<string>) {
  return {
    id: story.id,
    authorId: story.author_id,
    author: authorMap[story.author_id]?.display_name || authorMap[story.author_id]?.username || 'WIMPEX user',
    avatarUrl: authorMap[story.author_id]?.avatar_url || null,
    mediaType: story.media_type,
    videoUrl: story.video_url,
    imageUrl: story.image_url,
    thumbnailUrl: story.thumbnail_url,
    caption: story.caption || '',
    // Text-story fields (null for video/image stories)
    textContent: story.text_content,
    backgroundColor: story.background_color,
    font: story.font,
    // Overlay fields (null when the author didn't add a text layer)
    overlay: story.overlay_text
      ? {
          text: story.overlay_text,
          font: story.overlay_font,
          textColor: story.overlay_text_color,
          bgColor: story.overlay_bg_color,
          posX: story.overlay_pos_x,
          posY: story.overlay_pos_y,
          scale: story.overlay_scale,
          rotation: story.overlay_rotation
        }
      : null,
    createdAt: story.created_at,
    expiresAt: story.expires_at,
    viewedByMe: viewedIds.has(story.id)
  };
}

const STORY_SELECT =
  'id, author_id, media_type, video_url, image_url, thumbnail_url, caption, text_content, background_color, font, ' +
  'overlay_text, overlay_font, overlay_text_color, overlay_bg_color, overlay_pos_x, overlay_pos_y, ' +
  'overlay_scale, overlay_rotation, created_at, expires_at';

// GET /api/stories — every non-expired story from people you mutually
// follow (plus your own), grouped isn't done here; the client groups by
// author. Includes which of those stories the caller has already viewed.
export async function GET(request: NextRequest) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ stories: [] });
  }

  let authContext;
  try {
    authContext = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const mutualIds = await getMutualFollows(authContext.user.id);
  const authorIds = Array.from(new Set([...mutualIds, authContext.user.id]));

  const { data: stories, error } = await supabaseServer
    .from('wpx_stories')
    .select(STORY_SELECT)
    .in('author_id', authorIds)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: views } = await supabaseServer
    .from('wpx_story_views')
    .select('story_id')
    .eq('viewer_id', authContext.user.id);
  const viewedIds = new Set((views || []).map((v: any) => v.story_id));

  const authorMap = await loadAuthors(authorIds);

  return NextResponse.json({
    stories: (stories || []).map((story: any) => serializeStory(story, authorMap, viewedIds))
  });
}

// POST /api/stories — create a story. Deliberately separate from
// /api/posts: single media item (or pure text), no caption-required rule,
// no drafts, no visibility setting, expires automatically in 24h.
//
// Three shapes of request body (all multipart/form-data):
//   - text story:      type=text, textContent, backgroundColor, font
//   - image/video story: video|image file, optional overlayText + overlay*
export async function POST(request: NextRequest) {
  if (!isSupabaseServerConfigured) {
    return NextResponse.json({ story: null });
  }

  let authContext;
  try {
    authContext = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json({ error: 'Expected multipart/form-data.' }, { status: 400 });
  }

  const formData = await request.formData();
  const type = (formData.get('type')?.toString() || 'media').toLowerCase();

  if (type === 'text') {
    return handleTextStory(authContext, formData);
  }
  return handleMediaStory(authContext, formData);
}

async function handleTextStory(authContext: any, formData: FormData) {
  const textContent = formData.get('textContent')?.toString().trim() || '';
  const backgroundColorRaw = formData.get('backgroundColor')?.toString() || '';
  const fontRaw = formData.get('font')?.toString() || 'sans';

  if (!textContent) {
    return NextResponse.json({ error: 'Write something for your story first.' }, { status: 400 });
  }
  if (textContent.length > MAX_TEXT_STORY_LENGTH) {
    return NextResponse.json({ error: `Text stories are limited to ${MAX_TEXT_STORY_LENGTH} characters.` }, { status: 400 });
  }
  if (!isHexColor(backgroundColorRaw) && !isGradientToken(backgroundColorRaw)) {
    return NextResponse.json({ error: 'Pick a valid background.' }, { status: 400 });
  }
  if (!ALLOWED_FONTS.has(fontRaw)) {
    return NextResponse.json({ error: 'Pick a valid font.' }, { status: 400 });
  }

  const { data: story, error: insertError } = await supabaseServer
    .from('wpx_stories')
    .insert({
      author_id: authContext.user.id,
      media_type: 'text',
      text_content: textContent,
      background_color: backgroundColorRaw,
      font: fontRaw
    })
    .select(STORY_SELECT)
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ story: serializeStory(story, {}, new Set()) });
}

async function handleMediaStory(authContext: any, formData: FormData) {
  const caption = formData.get('caption')?.toString() || '';
  const videoFile = formData.get('video');
  const imageFile = formData.get('image');

  if (videoFile && imageFile) {
    return NextResponse.json({ error: 'Please upload either a video or an image, not both.' }, { status: 400 });
  }

  const uploadFile = videoFile || imageFile;
  if (!uploadFile || typeof uploadFile === 'string' || !('arrayBuffer' in uploadFile)) {
    return NextResponse.json({ error: 'Please attach a photo or video for your story.' }, { status: 400 });
  }

  const file = uploadFile as File;
  const isVideo = file.type.startsWith('video/');
  const isImage = file.type.startsWith('image/');
  if (!isVideo && !isImage) {
    return NextResponse.json({ error: 'Unsupported media type. Upload an image or video.' }, { status: 400 });
  }

  // Optional text overlay drawn on top of the media in the viewer.
  const overlayTextRaw = formData.get('overlayText')?.toString().trim() || '';
  let overlayFields: Record<string, any> = {
    overlay_text: null,
    overlay_font: null,
    overlay_text_color: null,
    overlay_bg_color: null,
    overlay_pos_x: null,
    overlay_pos_y: null,
    overlay_scale: 1,
    overlay_rotation: 0
  };

  if (overlayTextRaw) {
    if (overlayTextRaw.length > MAX_OVERLAY_TEXT_LENGTH) {
      return NextResponse.json({ error: `Overlay text is limited to ${MAX_OVERLAY_TEXT_LENGTH} characters.` }, { status: 400 });
    }
    const overlayFontRaw = formData.get('overlayFont')?.toString() || 'sans';
    const overlayTextColorRaw = formData.get('overlayTextColor')?.toString() || '#ffffff';
    const overlayBgColorRaw = formData.get('overlayBgColor')?.toString() || '';

    if (!ALLOWED_FONTS.has(overlayFontRaw)) {
      return NextResponse.json({ error: 'Pick a valid overlay font.' }, { status: 400 });
    }
    if (!isHexColor(overlayTextColorRaw)) {
      return NextResponse.json({ error: 'Pick a valid overlay text colour.' }, { status: 400 });
    }
    if (overlayBgColorRaw && !isHexColor(overlayBgColorRaw)) {
      return NextResponse.json({ error: 'Pick a valid overlay background colour.' }, { status: 400 });
    }

    const posX = clampPercent(formData.get('overlayPosX'));
    const posY = clampPercent(formData.get('overlayPosY'));
    const scale = clampScale(formData.get('overlayScale'));
    const rotation = clampRotation(formData.get('overlayRotation'));

    overlayFields = {
      overlay_text: overlayTextRaw,
      overlay_font: overlayFontRaw,
      overlay_text_color: overlayTextColorRaw,
      overlay_bg_color: overlayBgColorRaw || null,
      overlay_pos_x: posX ?? 50,
      overlay_pos_y: posY ?? 50,
      overlay_scale: scale ?? 1,
      overlay_rotation: rotation ?? 0
    };
  }

  const bucket = isImage ? IMAGE_BUCKET : VIDEO_BUCKET;
  const pathPrefix = isImage ? 'stories/images' : 'stories/videos';
  const allowedMimeTypes = isImage
    ? ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
    : ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v', 'video/ogg'];

  try {
    await supabaseServer.storage.createBucket(bucket, {
      public: true,
      allowedMimeTypes,
      fileSizeLimit: '104857600'
    });
  } catch {
    // ignore bucket-create failures (bucket already exists)
  }

  const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
  const { data: uploadData, error: uploadError } = await supabaseServer.storage
    .from(bucket)
    .upload(`${pathPrefix}/${authContext.user.id}/${fileName}`, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || (isImage ? 'image/png' : 'video/mp4')
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: publicUrlData } = supabaseServer.storage.from(bucket).getPublicUrl(uploadData?.path || fileName);
  const mediaUrl = publicUrlData?.publicUrl || '';

  const { data: story, error: insertError } = await supabaseServer
    .from('wpx_stories')
    .insert({
      author_id: authContext.user.id,
      media_type: isImage ? 'image' : 'video',
      video_url: isImage ? null : mediaUrl,
      image_url: isImage ? mediaUrl : null,
      caption: caption.trim(),
      ...overlayFields
    })
    .select(STORY_SELECT)
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ story: serializeStory(story, {}, new Set()) });
}