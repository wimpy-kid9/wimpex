"use client";

import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent, SVGProps } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authedFetch } from '@/lib/api-client';

function IconClose(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function IconType(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 7V5h16v2M9 20h6M12 5v15" />
    </svg>
  );
}

// ---- Fonts -----------------------------------------------------------
// Ids are validated server-side too (see ALLOWED_FONTS in the API route).
// Kept to system/web-safe stacks so nothing extra needs to load.
const FONT_OPTIONS = [
  { id: 'sans', label: 'Sans', family: '"Inter", "Helvetica Neue", Arial, sans-serif' },
  { id: 'serif', label: 'Serif', family: 'Georgia, "Times New Roman", serif' },
  { id: 'mono', label: 'Mono', family: '"SFMono-Regular", ui-monospace, Menlo, monospace' },
  { id: 'display', label: 'Bold', family: '"Arial Black", "Helvetica Neue", sans-serif' },
  { id: 'script', label: 'Script', family: '"Segoe Script", "Bradley Hand", cursive' }
] as const;

type FontId = (typeof FONT_OPTIONS)[number]['id'];

function fontFamilyFor(id: string) {
  return FONT_OPTIONS.find((f) => f.id === id)?.family || FONT_OPTIONS[0].family;
}

// ---- Backgrounds (for pure text stories) ------------------------------
// Solid hex values are stored as-is; gradients are stored as a short
// "grad-*" token and resolved to CSS here and on any story viewer.
const BACKGROUND_OPTIONS = [
  { token: '#141014', css: '#141014' }, // obsidian
  { token: '#D4AF37', css: '#D4AF37' }, // gold
  { token: '#7C6A46', css: '#7C6A46' }, // gold-deep-ish
  { token: '#1F2937', css: '#1F2937' }, // slate
  { token: '#7F1D1D', css: '#7F1D1D' }, // rose-deep
  { token: 'grad-gold-obsidian', css: 'linear-gradient(160deg, #D4AF37 0%, #141014 70%)' },
  { token: 'grad-rose-obsidian', css: 'linear-gradient(160deg, #E11D48 0%, #141014 75%)' },
  { token: 'grad-slate-gold', css: 'linear-gradient(160deg, #1F2937 0%, #D4AF37 100%)' }
] as const;

function backgroundCssFor(token: string) {
  return BACKGROUND_OPTIONS.find((b) => b.token === token)?.css || token;
}

const TEXT_COLOR_SWATCHES = ['#FDF6E3', '#141014', '#D4AF37', '#E11D48', '#93C5FD'];

type Mode = 'media' | 'text';
type OverlayPos = { x: number; y: number };

export default function CreateStoryPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);

  const [mode, setMode] = useState<Mode>('media');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // --- media mode state ---
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [mediaType, setMediaType] = useState<'video' | 'image'>('image');
  const [caption, setCaption] = useState('');

  // --- overlay state (applies on top of media) ---
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [overlayText, setOverlayText] = useState('');
  const [overlayFont, setOverlayFont] = useState<FontId>('sans');
  const [overlayTextColor, setOverlayTextColor] = useState('#FDF6E3');
  const [overlayBgColor, setOverlayBgColor] = useState<string | null>(null);
  const [overlayPos, setOverlayPos] = useState<OverlayPos>({ x: 50, y: 50 });
  const [overlayScale, setOverlayScaleState] = useState(1);
  const [overlayRotation, setOverlayRotationState] = useState(0);
  const dragging = useRef(false);

  // Refs mirror the scale/rotation state so pointer-event closures always
  // read the latest value instead of a stale one captured at render time.
  const scaleRef = useRef(1);
  const rotationRef = useRef(0);
  const setOverlayScale = (value: number) => {
    const clamped = Math.min(3, Math.max(0.5, value));
    scaleRef.current = clamped;
    setOverlayScaleState(clamped);
  };
  const setOverlayRotation = (value: number) => {
    // wrap into -180..180 rather than clamp, so spinning past 180 keeps going
    let wrapped = value;
    while (wrapped > 180) wrapped -= 360;
    while (wrapped < -180) wrapped += 360;
    rotationRef.current = wrapped;
    setOverlayRotationState(wrapped);
  };

  // Active pointers on the overlay text (for one-finger drag vs. two-finger
  // pinch/rotate) and the gesture's starting values.
  const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const gestureStart = useRef<{ dist: number; angle: number; scale: number; rotation: number } | null>(null);

  // --- text-story mode state ---
  const [textContent, setTextContent] = useState('');
  const [textBackground, setTextBackground] = useState<string>(BACKGROUND_OPTIONS[0].token);
  const [textFont, setTextFont] = useState<FontId>('display');

  const handleFile = (file: File | null) => {
    if (!file) return;
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    if (!isVideo && !isImage) {
      setError('Please choose a photo or video.');
      return;
    }
    setError('');
    setMediaFile(file);
    setMediaType(isVideo ? 'video' : 'image');
    setPreviewUrl(URL.createObjectURL(file));
  };

  const movePointerToOverlay = (clientX: number, clientY: number) => {
    const box = previewRef.current?.getBoundingClientRect();
    if (!box) return;
    const x = Math.min(100, Math.max(0, ((clientX - box.left) / box.width) * 100));
    const y = Math.min(100, Math.max(0, ((clientY - box.top) / box.height) * 100));
    setOverlayPos({ x, y });
  };

  const pointerDistanceAndAngle = () => {
    const pts = Array.from(activePointers.current.values());
    if (pts.length < 2) return null;
    const [a, b] = pts;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return { dist: Math.hypot(dx, dy), angle: (Math.atan2(dy, dx) * 180) / Math.PI };
  };

  const onOverlayPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.current.size === 1) {
      dragging.current = true;
      gestureStart.current = null;
    } else if (activePointers.current.size === 2) {
      // Second finger landed — switch from drag to pinch/rotate.
      dragging.current = false;
      const da = pointerDistanceAndAngle();
      if (da) {
        gestureStart.current = { dist: da.dist, angle: da.angle, scale: scaleRef.current, rotation: rotationRef.current };
      }
    }
  };

  const onOverlayPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!activePointers.current.has(e.pointerId)) return;
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.current.size >= 2 && gestureStart.current) {
      const da = pointerDistanceAndAngle();
      if (!da || da.dist === 0) return;
      const nextScale = gestureStart.current.scale * (da.dist / gestureStart.current.dist);
      const nextRotation = gestureStart.current.rotation + (da.angle - gestureStart.current.angle);
      setOverlayScale(nextScale);
      setOverlayRotation(nextRotation);
      return;
    }

    if (dragging.current && activePointers.current.size === 1) {
      movePointerToOverlay(e.clientX, e.clientY);
    }
  };

  const endOverlayPointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    activePointers.current.delete(e.pointerId);
    if (activePointers.current.size < 2) gestureStart.current = null;
    if (activePointers.current.size === 0) dragging.current = false;
    else if (activePointers.current.size === 1) {
      // Dropped back to one finger — resume dragging from here.
      dragging.current = true;
    }
  };

  // Desktop trackpad pinch (Chrome/Firefox report this as wheel + ctrlKey).
  const onOverlayWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    setOverlayScale(scaleRef.current - e.deltaY * 0.01);
  };

  const resetOverlay = () => {
    setOverlayText('');
    setOverlayOpen(false);
    setOverlayPos({ x: 50, y: 50 });
    setOverlayBgColor(null);
    setOverlayScale(1);
    setOverlayRotation(0);
  };

  const submitMedia = async () => {
    if (!mediaFile) {
      setError('Add a photo or video first.');
      return;
    }
    setBusy(true);
    setError('');

    const formData = new FormData();
    formData.append('type', 'media');
    formData.append(mediaType === 'image' ? 'image' : 'video', mediaFile, mediaType === 'image' ? 'story-image' : 'story-video');
    formData.append('caption', caption.trim());

    if (overlayText.trim()) {
      formData.append('overlayText', overlayText.trim());
      formData.append('overlayFont', overlayFont);
      formData.append('overlayTextColor', overlayTextColor);
      if (overlayBgColor) formData.append('overlayBgColor', overlayBgColor);
      formData.append('overlayPosX', String(overlayPos.x));
      formData.append('overlayPosY', String(overlayPos.y));
      formData.append('overlayScale', String(overlayScale));
      formData.append('overlayRotation', String(overlayRotation));
    }

    try {
      const response = await authedFetch('/api/stories', { method: 'POST', body: formData });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error || 'Unable to share your story.');
        setBusy(false);
        return;
      }
      router.push('/stories?created=1');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to share your story.');
      setBusy(false);
    }
  };

  const submitText = async () => {
    if (!textContent.trim()) {
      setError('Write something for your story first.');
      return;
    }
    setBusy(true);
    setError('');

    const formData = new FormData();
    formData.append('type', 'text');
    formData.append('textContent', textContent.trim());
    formData.append('backgroundColor', textBackground);
    formData.append('font', textFont);

    try {
      const response = await authedFetch('/api/stories', { method: 'POST', body: formData });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error || 'Unable to share your story.');
        setBusy(false);
        return;
      }
      router.push('/stories?created=1');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to share your story.');
      setBusy(false);
    }
  };

  const submit = () => (mode === 'media' ? submitMedia() : submitText());

  return (
    <main className="mx-auto max-w-md space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-display text-2xl text-ivory">New story</h1>
        <Link href="/stories" aria-label="Cancel" className="grid h-9 w-9 place-items-center rounded-full bg-ivory/5 text-ivory hover:bg-ivory/10">
          <IconClose className="h-4 w-4" />
        </Link>
      </div>

      {/* Mode switcher */}
      <div className="flex gap-2 rounded-full bg-panel-2/70 p-1">
        <button
          type="button"
          onClick={() => setMode('media')}
          className={`flex-1 rounded-full py-2 text-sm font-medium transition ${
            mode === 'media' ? 'bg-gold text-obsidian' : 'text-slate hover:text-ivory'
          }`}
        >
          Photo / Video
        </button>
        <button
          type="button"
          onClick={() => setMode('text')}
          className={`flex-1 rounded-full py-2 text-sm font-medium transition ${
            mode === 'text' ? 'bg-gold text-obsidian' : 'text-slate hover:text-ivory'
          }`}
        >
          Text
        </button>
      </div>

      <p className="text-sm text-slate">
        {mode === 'media'
          ? 'One photo or clip, visible to people who follow you back, gone after 24 hours.'
          : 'A text-only story on a background of your choice, gone after 24 hours.'}
      </p>

      {mode === 'media' ? (
        <>
          <div
            ref={previewRef}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFile(e.dataTransfer.files?.[0] ?? null);
            }}
            onClick={() => {
              if (!previewUrl) fileInputRef.current?.click();
            }}
            className="surface-veil relative flex aspect-[9/16] w-full cursor-pointer select-none items-center justify-center overflow-hidden rounded-2xl border border-dashed border-hairline bg-panel-2/70"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              className="sr-only"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
            {previewUrl ? (
              mediaType === 'video' ? (
                <video src={previewUrl} className="h-full w-full object-cover" muted autoPlay loop playsInline />
              ) : (
                <img src={previewUrl} alt="Story preview" className="h-full w-full object-cover" />
              )
            ) : (
              <p className="px-6 text-center text-sm text-slate">Tap to choose a photo or video, or drop one here</p>
            )}

            {/* Draggable text overlay, only shown once there's media + overlay text */}
            {previewUrl && overlayText.trim() ? (
              <div
                onPointerDown={onOverlayPointerDown}
                onPointerMove={onOverlayPointerMove}
                onPointerUp={endOverlayPointer}
                onPointerCancel={endOverlayPointer}
                onWheel={onOverlayWheel}
                style={{
                  position: 'absolute',
                  left: `${overlayPos.x}%`,
                  top: `${overlayPos.y}%`,
                  transform: `translate(-50%, -50%) rotate(${overlayRotation}deg) scale(${overlayScale})`,
                  fontFamily: fontFamilyFor(overlayFont),
                  color: overlayTextColor,
                  backgroundColor: overlayBgColor || 'transparent',
                  padding: overlayBgColor ? '0.35em 0.6em' : 0,
                  borderRadius: overlayBgColor ? '0.5em' : 0,
                  maxWidth: '85%',
                  touchAction: 'none',
                  cursor: 'grab',
                  fontSize: '1.15rem',
                  fontWeight: 600,
                  textAlign: 'center',
                  lineHeight: 1.25,
                  wordBreak: 'break-word'
                }}
              >
                {overlayText}
              </div>
            ) : null}
          </div>

          {previewUrl && (
            <div className="space-y-3 rounded-2xl border border-hairline bg-panel-2/70 p-4">
              <button
                type="button"
                onClick={() => setOverlayOpen((v) => !v)}
                className="flex items-center gap-2 text-sm font-medium text-ivory"
              >
                <IconType className="h-4 w-4 text-gold" />
                {overlayOpen ? 'Hide text overlay' : overlayText.trim() ? 'Edit text overlay' : 'Add text overlay'}
              </button>

              {overlayOpen && (
                <div className="space-y-3 pt-1">
                  <input
                    type="text"
                    value={overlayText}
                    onChange={(e) => setOverlayText(e.target.value)}
                    maxLength={120}
                    placeholder="Type something…"
                    className="w-full rounded-xl border border-hairline bg-panel-2 px-3 py-2 text-sm text-ivory placeholder:text-slate focus:border-gold/40 focus:outline-none"
                  />

                  <div className="flex flex-wrap gap-2">
                    {FONT_OPTIONS.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setOverlayFont(f.id)}
                        style={{ fontFamily: f.family }}
                        className={`rounded-full border px-3 py-1 text-xs ${
                          overlayFont === f.id ? 'border-gold bg-gold/10 text-gold' : 'border-hairline text-slate hover:text-ivory'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate">Text</span>
                    {TEXT_COLOR_SWATCHES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-label={`Text colour ${c}`}
                        onClick={() => setOverlayTextColor(c)}
                        style={{ backgroundColor: c }}
                        className={`h-6 w-6 rounded-full border-2 ${
                          overlayTextColor === c ? 'border-gold' : 'border-transparent'
                        }`}
                      />
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate">Backdrop</span>
                    <button
                      type="button"
                      onClick={() => setOverlayBgColor(null)}
                      className={`rounded-full border px-2 py-1 text-xs ${
                        overlayBgColor === null ? 'border-gold text-gold' : 'border-hairline text-slate'
                      }`}
                    >
                      None
                    </button>
                    {['#000000', '#141014', '#FDF6E3'].map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-label={`Backdrop ${c}`}
                        onClick={() => setOverlayBgColor(c)}
                        style={{ backgroundColor: c }}
                        className={`h-6 w-6 rounded-full border-2 ${
                          overlayBgColor === c ? 'border-gold' : 'border-hairline'
                        }`}
                      />
                    ))}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-slate">
                      <span>Size</span>
                      <span>{Math.round(overlayScale * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0.5}
                      max={3}
                      step={0.05}
                      value={overlayScale}
                      onChange={(e) => setOverlayScale(Number(e.target.value))}
                      className="w-full accent-gold"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-slate">
                      <span>Rotate</span>
                      <span>{Math.round(overlayRotation)}°</span>
                    </div>
                    <input
                      type="range"
                      min={-180}
                      max={180}
                      step={1}
                      value={overlayRotation}
                      onChange={(e) => setOverlayRotation(Number(e.target.value))}
                      className="w-full accent-gold"
                    />
                  </div>

                  <p className="text-xs text-slate">
                    Drag the text to place it. On touch, pinch with two fingers to resize and twist to rotate — the sliders above work too.
                  </p>

                  {overlayText.trim() && (
                    <button type="button" onClick={resetOverlay} className="text-xs text-rose-300 underline">
                      Remove overlay text
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Add a caption (optional)"
            rows={2}
            maxLength={200}
            className="w-full rounded-2xl border border-hairline bg-panel-2/70 px-4 py-3 text-sm text-ivory placeholder:text-slate focus:border-gold/40 focus:outline-none"
          />
        </>
      ) : (
        <>
          <div
            className="relative flex aspect-[9/16] w-full items-center justify-center overflow-hidden rounded-2xl p-8 text-center"
            style={{ background: backgroundCssFor(textBackground) }}
          >
            <p
              style={{ fontFamily: fontFamilyFor(textFont) }}
              className="whitespace-pre-wrap break-words text-2xl font-semibold text-ivory"
            >
              {textContent.trim() || 'Your story text will show up here'}
            </p>
          </div>

          <textarea
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
            placeholder="What's on your mind?"
            rows={4}
            maxLength={500}
            className="w-full rounded-2xl border border-hairline bg-panel-2/70 px-4 py-3 text-sm text-ivory placeholder:text-slate focus:border-gold/40 focus:outline-none"
          />

          <div className="space-y-2">
            <p className="text-xs text-slate">Background</p>
            <div className="flex flex-wrap gap-2">
              {BACKGROUND_OPTIONS.map((b) => (
                <button
                  key={b.token}
                  type="button"
                  aria-label={`Background ${b.token}`}
                  onClick={() => setTextBackground(b.token)}
                  style={{ background: b.css }}
                  className={`h-9 w-9 rounded-full border-2 ${
                    textBackground === b.token ? 'border-gold' : 'border-hairline'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-slate">Font</p>
            <div className="flex flex-wrap gap-2">
              {FONT_OPTIONS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setTextFont(f.id)}
                  style={{ fontFamily: f.family }}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    textFont === f.id ? 'border-gold bg-gold/10 text-gold' : 'border-hairline text-slate hover:text-ivory'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      <button
        type="button"
        onClick={submit}
        disabled={busy || (mode === 'media' ? !mediaFile : !textContent.trim())}
        className="w-full rounded-2xl bg-gold px-6 py-3 text-sm font-semibold text-obsidian transition hover:bg-gold-deep disabled:opacity-50"
      >
        {busy ? 'Sharing…' : 'Share to your story'}
      </button>
    </main>
  );
}