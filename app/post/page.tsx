"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getUserAccent } from '@/lib/ui-theme';
import { authedFetch } from '@/lib/api-client';
import AuthActionPrompt from '@/app/components/AuthActionPrompt';
import { useAudioMixer } from '@/lib/use-audio-mixer';
import { isGoldSubscription } from '@/lib/subscription';
import { usePaidUpgradeFlow } from '@/app/components/PaidUpgradeFlow';
import GoldUpgradeHint from '@/app/components/GoldUpgradeHint';

const FILTER_PRESETS: { key: string; label: string; description: string; gold?: boolean }[] = [
  { key: 'none', label: 'None', description: 'Natural colors' },
  { key: 'vivid', label: 'Vivid', description: 'High contrast and saturation' },
  { key: 'mono', label: 'Mono', description: 'Black and white' },
  { key: 'warm', label: 'Warm', description: 'Soft golden tones' },
  { key: 'cool', label: 'Cool', description: 'Crisp blue shadows' },
  { key: 'neon', label: 'Neon', description: 'Bright, punchy glow' },
  { key: 'dreamy', label: 'Dreamy', description: 'Soft glow and pastel highlights' },
  { key: 'noir', label: 'Noir', description: 'High contrast black and white' },
  { key: 'retro', label: 'Retro', description: 'Warm vintage saturation' },
  { key: 'duotone', label: 'Duotone', description: 'Bold color contrast' },
  { key: 'golden', label: 'Golden Hour', description: 'Warm evening tones' },
  { key: 'cyberpunk', label: 'Cyberpunk', description: 'Neon pink and blue lighting' },
  { key: 'pastel', label: 'Pastel', description: 'Soft color wash' },
  { key: 'infrared', label: 'Infrared', description: 'Dreamy magenta tint' },
  { key: 'chrome', label: 'Chrome', description: 'Metallic high contrast', gold: true },
  { key: 'velvet', label: 'Velvet', description: 'Deep warm shadows', gold: true },
  { key: 'arctic', label: 'Arctic', description: 'Cool desaturated tone', gold: true },
  { key: 'sunset', label: 'Sunset', description: 'Warm evening tint', gold: true }
];

const filterClasses: Record<string, string> = {
  none: '',
  vivid: 'filter saturate-150 contrast-110',
  mono: 'filter grayscale contrast-110',
  warm: 'filter sepia contrast-105 saturate-110',
  cool: 'filter hue-rotate-190 saturate-120 contrast-105',
  neon: 'filter saturate-200 drop-shadow-[0_0_20px_rgba(56,189,248,0.45)]',
  dreamy: 'filter saturate-110 contrast-105 brightness-110 drop-shadow-[0_0_20px_rgba(255,255,255,0.12)]',
  noir: 'filter grayscale contrast-130 brightness-90',
  retro: 'filter sepia contrast-110 saturate-110',
  duotone: 'filter contrast-125 saturate-150',
  golden: 'filter sepia brightness-110 contrast-105',
  cyberpunk: 'filter hue-rotate-280 saturate-180 contrast-120',
  pastel: 'filter brightness-110 saturate-120 contrast-95',
  infrared: 'filter hue-rotate-310 saturate-140 contrast-115',
  chrome: 'filter contrast-125 saturate-150 brightness-110',
  velvet: 'filter sepia contrast-125 saturate-125 brightness-90',
  arctic: 'filter grayscale-[35%] hue-rotate-180 saturate-75 contrast-110',
  sunset: 'filter sepia saturate-150 hue-rotate-[-15deg] contrast-110'
};

const DURATION_OPTIONS = [
  { key: '3m', seconds: 180, label: '3m', gold: true },
  { key: '60s', seconds: 60, label: '60s', gold: false },
  { key: '15s', seconds: 15, label: '15s', gold: false },
  { key: 'photo', seconds: 0, label: 'Photo', gold: false }
] as const;

type DurationKey = (typeof DURATION_OPTIONS)[number]['key'];

type AudioTrack = {
  id: string;
  title: string;
  artist: string;
  preview_url?: string;
  cover_art_url?: string;
};

function IconX({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
      <path d="M6 6l12 12M18 6L6 18" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconMusic({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M9 18V5l12-2v13" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

function IconFlip({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
      <path d="M4 9a8 8 0 0 1 14-4.5M20 15a8 8 0 0 1-14 4.5" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M18 4v4.5H13.5M6 20v-4.5H10.5" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconFlash({ className = 'h-6 w-6', filled = false }: { className?: string; filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" className={className}>
      <path d="M13 2 4 14h6l-1 8 9-12h-6z" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconTimer({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
      <circle cx="12" cy="13" r="8" strokeWidth="1.6" />
      <path d="M12 9v4l3 2M10 2h4" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconSpeed({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
      <path d="M4 15a8 8 0 0 1 16 0" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 15l4-5" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="15" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconFilters({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
      <circle cx="9" cy="9" r="5.5" strokeWidth="1.5" />
      <circle cx="15" cy="15" r="5.5" strokeWidth="1.5" />
    </svg>
  );
}

function IconSparkles({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2l1.6 5.4L19 9l-5.4 1.6L12 16l-1.6-5.4L5 9l5.4-1.6z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
    </svg>
  );
}

function IconImage({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
      <rect x="3" y="4" width="18" height="16" rx="2.5" strokeWidth="1.6" />
      <circle cx="8.5" cy="9.5" r="1.6" strokeWidth="1.6" />
      <path d="M21 16l-5.5-5.5a2 2 0 0 0-2.8 0L4 19" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChevronLeft({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
      <path d="M15 5l-7 7 7 7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconArrowRight({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
      <path d="M5 12h14M13 6l6 6-6 6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RailButton({
  icon,
  label,
  onClick,
  active = false
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-1 text-ivory drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)]">
      <span className={`flex h-8 w-8 items-center justify-center ${active ? 'text-gold' : 'text-ivory'}`}>{icon}</span>
      <span className={`text-[0.65rem] font-semibold ${active ? 'text-gold' : 'text-ivory/90'}`}>{label}</span>
    </button>
  );
}

export default function CreatePostPage() {
  const router = useRouter();
  const [draft, setDraft] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'connections' | 'private'>('public');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<'video' | 'image'>('video');
  const [filterPreset, setFilterPreset] = useState('none');
  const [trackQuery, setTrackQuery] = useState('');
  const [trackResults, setTrackResults] = useState<AudioTrack[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<AudioTrack | null>(null);
  const [session, setSession] = useState<any | null | undefined>(undefined);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [step, setStep] = useState<'media' | 'details'>('media');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderStreamRef = useRef<MediaStream | null>(null);
  const cameraPreviewRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const recorderTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [audioTime, setAudioTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isGold, setIsGold] = useState(false);
  const [goldStatusLoaded, setGoldStatusLoaded] = useState(false);
  const [goldLimitNotice, setGoldLimitNotice] = useState(false);
  const [scheduledFor, setScheduledFor] = useState('');
  const upgrade = usePaidUpgradeFlow({ productName: 'wimpex', planName: 'Wimpex Pro', onSuccess: (subscription) => setIsGold(isGoldSubscription(subscription)) });
  const [cameraArmed, setCameraArmed] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const { mixAudio, isProcessing: isMixing, progress: mixProgress, error: mixError } = useAudioMixer();

  // --- Snapchat-style capture UI state ---
  const [showSoundsSheet, setShowSoundsSheet] = useState(false);
  const [showFiltersSheet, setShowFiltersSheet] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState<DurationKey>('photo');
  const [flashOn, setFlashOn] = useState(false);
  const [timerOption, setTimerOption] = useState<0 | 3 | 10>(0);
  const [speedOption, setSpeedOption] = useState<number>(1);
  const [beautifyOn, setBeautifyOn] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setEditingId(params.get('edit'));
  }, []);

  useEffect(() => {
    void authedFetch('/api/wimpypay')
      .then((response) => response.json())
      .then((payload) => setIsGold(isGoldSubscription(payload.subscription)))
      .catch(() => setIsGold(false))
      .finally(() => setGoldStatusLoaded(true));
  }, []);

  const maxRecordingSeconds = isGold ? 180 : 60;

  useEffect(() => {
    supabase.auth.getSession().then((result: { data: { session: any } | null }) => {
      setSession(result?.data?.session ?? null);
    });
  }, []);

  useEffect(() => {
    if (!editingId) return;

    const loadPost = async () => {
      try {
        const response = await authedFetch(`/api/posts/${editingId}`);
        if (!response.ok) return;
        const payload = await response.json();
        const post = payload.post;
        if (!post) return;

        setDraft(post.caption || '');
        setVisibility(post.visibility || 'public');
        setFilterPreset(post.filter_preset || 'none');

        if (post.imageUrl) {
          setMediaType('image');
          setMediaFile(null);
          setPreviewUrl(post.imageUrl);
        } else if (post.videoUrl) {
          setMediaType('video');
          setMediaFile(null);
          setPreviewUrl(post.videoUrl);
        }

        if (post.audio_track_id) {
          setSelectedTrack({
            id: post.audio_track_id,
            title: post.audio_track_name || 'Unknown track',
            artist: post.audio_artist_name || 'Unknown artist',
            preview_url: post.audio_preview_url || undefined,
            cover_art_url: post.audio_cover_art_url || undefined
          });
        }

        setStep('details');
      } catch {
        // ignore
      }
    };

    void loadPost();
  }, [editingId]);

  useEffect(() => {
    if (!mediaFile) return;
    const objectUrl = URL.createObjectURL(mediaFile);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [mediaFile]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setAudioTime(audio.currentTime);
    const handleLoadedMeta = () => setAudioDuration(audio.duration || 0);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMeta);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMeta);
    };
  }, [selectedTrack]);

  useEffect(() => {
    if (!trackQuery.trim()) {
      setTrackResults([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/audio/search?q=${encodeURIComponent(trackQuery.trim())}`);
        const payload = await response.json();
        if (response.ok) {
          setTrackResults(payload.tracks || []);
        }
      } catch {
        // ignore
      }
    }, 240);

    return () => window.clearTimeout(timer);
  }, [trackQuery]);

  const accent = useMemo(() => getUserAccent(session?.user?.id ?? 'post-creator'), [session?.user?.id]);
  const characterCount = draft.length;

  const handleMediaChange = async (file: File | null) => {
    setError('');
    if (!file) {
      setMediaFile(null);
      setPreviewUrl(null);
      return;
    }

    if (file.type.startsWith('image/')) {
      setMediaType('image');
      setMediaFile(file);
      return;
    }

    if (file.type.startsWith('video/')) {
      if (goldStatusLoaded) {
        const probe = document.createElement('video');
        const objectUrl = URL.createObjectURL(file);
        probe.src = objectUrl;
        const duration = await new Promise<number>((resolve) => {
          probe.onloadedmetadata = () => resolve(probe.duration || 0);
          probe.onerror = () => resolve(0);
        });
        URL.revokeObjectURL(objectUrl);
        if (duration > maxRecordingSeconds) {
          setError(`Videos longer than ${maxRecordingSeconds} seconds are not supported for this account.`);
          setMediaFile(null);
          setPreviewUrl(null);
          return;
        }
      }
      setMediaType('video');
      setMediaFile(file);
      return;
    }

    setError('Unsupported file type. Choose an image or video.');
    setMediaFile(null);
  };

  const openFilePicker = () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    setCameraArmed(false);
    fileInputRef.current?.click();
  };

  const armCamera = async (requestedFacingMode = facingMode) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera access is not available on this device.');
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: requestedFacingMode }, audio: true });
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = stream;
      setCameraArmed(true);
      if (cameraPreviewRef.current) {
        cameraPreviewRef.current.srcObject = stream;
        await cameraPreviewRef.current.play().catch(() => undefined);
      }
      return true;
    } catch (cameraError) {
      setError(cameraError instanceof Error ? cameraError.message : 'Unable to access the camera and microphone.');
      return false;
    }
  };

  useEffect(() => {
    const preview = cameraPreviewRef.current;
    if (!preview) return;
    preview.srcObject = cameraStreamRef.current;
    if (cameraStreamRef.current) void preview.play().catch(() => undefined);
  }, [cameraArmed]);

  // Auto-arm the camera on load, Snapchat-style, unless we're editing an
  // existing post (which already has media) or media has been captured.
  useEffect(() => {
    if (!session) return;
    if (editingId) return;
    if (previewUrl) return;
    if (cameraArmed) return;
    void armCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, editingId, previewUrl]);

  const toggleCamera = async () => {
    if (isRecording) return;
    const nextFacingMode = facingMode === 'user' ? 'environment' : 'user';
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    setFacingMode(nextFacingMode);
    await armCamera(nextFacingMode);
  };

  const toggleFlash = async () => {
    const next = !flashOn;
    setFlashOn(next);
    const track = cameraStreamRef.current?.getVideoTracks()[0];
    if (track && 'applyConstraints' in track) {
      try {
        await track.applyConstraints({ advanced: [{ torch: next } as any] });
      } catch {
        // Torch isn't supported on this device/browser; the UI toggle still works.
      }
    }
  };

  const cycleTimer = () => {
    setTimerOption((current) => (current === 0 ? 3 : current === 3 ? 10 : 0));
  };

  const cycleSpeed = () => {
    setSpeedOption((current) => (current === 1 ? 2 : current === 2 ? 3 : current === 3 ? 0.5 : 1));
  };

  const selectDuration = (option: (typeof DURATION_OPTIONS)[number]) => {
    if (isRecording) return;
    if (option.gold && !isGold) {
      void upgrade.attemptPurchase();
      return;
    }
    setSelectedDuration(option.key);
  };

  const takePhoto = async () => {
    if (!cameraStreamRef.current && !(await armCamera())) return;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const preview = cameraPreviewRef.current;
    if (!preview) return;
    if (preview.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      await new Promise<void>((resolve) => {
        const handleLoaded = () => {
          preview.removeEventListener('loadeddata', handleLoaded);
          resolve();
        };
        preview.addEventListener('loadeddata', handleLoaded, { once: true });
      });
    }
    const canvas = document.createElement('canvas');
    canvas.width = preview.videoWidth || 1080;
    canvas.height = preview.videoHeight || 1920;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      if (facingMode === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(preview, 0, 0, canvas.width, canvas.height);
    }
    canvas.toBlob((blob) => {
      if (!blob) return;
      handleMediaChange(new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' }));
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
      setCameraArmed(false);
    }, 'image/jpeg', 0.92);
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Camera recording is not available on this device.');
      return;
    }
    try {
      if (!cameraStreamRef.current && !(await armCamera())) return;
      const stream = cameraStreamRef.current;
      if (!stream) return;
      const capSeconds = DURATION_OPTIONS.find((option) => option.key === selectedDuration)?.seconds || maxRecordingSeconds;
      const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm', 'video/mp4'].find((type) => MediaRecorder.isTypeSupported(type)) || '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        recorderStreamRef.current = null;
        cameraStreamRef.current = null;
        recorderRef.current = null;
        if (recorderTimerRef.current) clearInterval(recorderTimerRef.current);
        setIsRecording(false);
        setCameraArmed(false);
        const type = recorder.mimeType || 'video/webm';
        handleMediaChange(new File([new Blob(chunks, { type })], `recording-${Date.now()}.webm`, { type }));
      };
      recorderStreamRef.current = stream;
      recorderRef.current = recorder;
      setRecordingSeconds(0);
      setIsRecording(true);
      recorder.start();
      recorderTimerRef.current = setInterval(() => {
        setRecordingSeconds((seconds) => {
          if (seconds + 1 >= capSeconds) {
            stopRecording();
            if (!isGold) setGoldLimitNotice(true);
          }
          return seconds + 1;
        });
      }, 1000);
    } catch (recordingError) {
      setError(recordingError instanceof Error ? recordingError.message : 'Unable to access the camera and microphone.');
    }
  };

  const runCaptureAction = () => {
    if (selectedDuration === 'photo') {
      void takePhoto();
    } else {
      void startRecording();
    }
  };

  const handleCaptureTap = () => {
    if (isRecording) {
      stopRecording();
      return;
    }
    if (timerOption > 0) {
      setCountdown(timerOption);
      countdownTimerRef.current = setInterval(() => {
        setCountdown((current) => {
          if (current === null) return null;
          if (current <= 1) {
            if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
            runCaptureAction();
            return null;
          }
          return current - 1;
        });
      }, 1000);
      return;
    }
    runCaptureAction();
  };

  useEffect(() => () => {
    recorderStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    if (recorderTimerRef.current) clearInterval(recorderTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
  }, []);

  const removeMedia = async () => {
    setMediaFile(null);
    setPreviewUrl(null);
    setSelectedTrack(null);
    setTrackQuery('');
    setTrackResults([]);
    setError('');
    await armCamera();
  };

  const selectTrack = (track: AudioTrack) => {
    setSelectedTrack(track);
    setTrackQuery('');
    setTrackResults([]);
    setShowSoundsSheet(false);
  };

  const submitPost = async (desiredStatus: 'published' | 'draft') => {
    if (!session) {
      return;
    }

    if (desiredStatus === 'published' && !draft.trim() && !previewUrl) {
      setError('Add a caption and media before publishing.');
      return;
    }

    setBusy(true);
    setError('');

    let mediaToUpload: File | Blob = mediaFile ?? new Blob();
    if (mediaFile && mediaType === 'video' && selectedTrack?.preview_url) {
      try {
        const mixedBlob = await mixAudio(mediaFile, selectedTrack.preview_url, 0.7);
        if (mixedBlob.type.startsWith('video/')) {
          mediaToUpload = new File([mixedBlob], mediaFile.name, { type: mixedBlob.type });
        } else {
          setError('Audio mixing returned no video container; the original video will be uploaded.');
        }
      } catch (mixingError) {
        setError(mixingError instanceof Error ? mixingError.message : 'Unable to mix the selected audio track.');
        setBusy(false);
        return;
      }
    }

    const formData = new FormData();
    if (mediaToUpload && mediaToUpload.size > 0) {
      formData.append(mediaType === 'image' ? 'image' : 'video', mediaToUpload, mediaType === 'image' ? 'image-upload' : 'video-upload');
      formData.append('media_type', mediaType);
    }

    formData.append('caption', draft.trim());
    formData.append('visibility', visibility);
    formData.append('status', desiredStatus);
    formData.append('filter_preset', filterPreset);
    if (scheduledFor) formData.append('scheduled_for', new Date(scheduledFor).toISOString());
    if (mediaFile && mediaType === 'video') {
      const probe = document.createElement('video');
      probe.src = URL.createObjectURL(mediaFile);
      await new Promise<void>((resolve) => { probe.onloadedmetadata = () => { formData.append('duration_seconds', String(probe.duration || 0)); URL.revokeObjectURL(probe.src); resolve(); }; probe.onerror = () => resolve(); });
    }

    if (selectedTrack) {
      formData.append('audio_track_id', selectedTrack.id);
      formData.append('audio_track_name', selectedTrack.title);
      formData.append('audio_artist_name', selectedTrack.artist);
      formData.append('audio_preview_url', selectedTrack.preview_url || '');
      formData.append('audio_cover_art_url', selectedTrack.cover_art_url || '');
    }

    const endpoint = editingId ? `/api/posts/${editingId}` : '/api/posts';
    const method = editingId ? 'PATCH' : 'POST';
    const body = editingId ? JSON.stringify({ caption: draft.trim(), visibility, filter_preset: filterPreset, status: desiredStatus, scheduled_for: scheduledFor ? new Date(scheduledFor).toISOString() : null }) : formData;

    const response = await authedFetch(endpoint, { method, body });
    setBusy(false);

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error || (editingId ? 'Unable to update post.' : 'Unable to publish post.'));
      return;
    }

    router.push(editingId ? `/post/${editingId}?edited=1` : '/feed?created=1');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submitPost('published');
  };

  const goToDetails = () => {
    if (!previewUrl) {
      setError('Upload an image or video before continuing.');
      return;
    }
    setError('');
    setStep('details');
  };

  const closeToFeed = () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    router.push('/feed');
  };

  if (session === undefined) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center bg-obsidian px-4 py-6">
        <p className="text-sm text-slate">Loading...</p>
      </main>
    );
  }

  if (!session) {
    return (
      <AuthActionPrompt
        title="Sign in to publish a post"
        description="You can browse public posts, but publishing requires a WimpyID login or signup."
      />
    );
  }

  const mediaFilterClass = `${filterClasses[filterPreset]} ${beautifyOn ? 'brightness-105 contrast-95 saturate-105' : ''}`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-black text-ivory">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="sr-only"
        onChange={(event) => void handleMediaChange(event.target.files?.[0] ?? null)}
      />

      {step === 'details' ? (
        /* ---------------- SHARE / DETAILS SCREEN ---------------- */
        <div className="flex h-full flex-col bg-obsidian">
          <div className="flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3">
            <button type="button" onClick={() => setStep('media')} aria-label="Back" className="flex h-10 w-10 items-center justify-center rounded-full text-ivory">
              <IconChevronLeft />
            </button>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-slate">{editingId ? 'Edit post' : 'New post'}</p>
            <div className="h-10 w-10" />
          </div>

          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-4">
              <div className="flex gap-4">
                <div className="h-28 w-20 flex-shrink-0 overflow-hidden rounded-2xl bg-panel-2">
                  {previewUrl ? (
                    mediaType === 'image' ? (
                      <img src={previewUrl} alt="Preview" className={`h-full w-full object-cover ${mediaFilterClass}`} />
                    ) : (
                      <video src={previewUrl} className={`h-full w-full object-cover ${mediaFilterClass}`} muted />
                    )
                  ) : null}
                </div>
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  maxLength={280}
                  placeholder="What are you sharing today?"
                  className="min-h-[112px] flex-1 rounded-2xl border border-hairline bg-panel-2 px-4 py-3 text-sm text-ivory outline-none"
                />
              </div>
              <div className="flex items-center justify-between text-xs text-slate">
                <span>Keep it concise and intimate.</span>
                <span>{characterCount}/280</span>
              </div>

              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.3em] text-slate">Who can see this</p>
                <div className="flex gap-2">
                  {(['public', 'connections', 'private'] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setVisibility(option)}
                      className={`flex-1 rounded-full border px-3 py-2 text-xs font-semibold capitalize transition ${visibility === option ? 'border-gold bg-gold/10 text-gold' : 'border-hairline text-slate hover:border-hairline-strong'}`}
                    >
                      {option === 'connections' ? 'Connections' : option}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowSoundsSheet(true)}
                className="flex w-full items-center gap-3 rounded-2xl border border-hairline bg-panel/70 px-4 py-3 text-left"
              >
                {selectedTrack?.cover_art_url ? (
                  <img src={selectedTrack.cover_art_url} alt="" className="h-10 w-10 rounded-xl object-cover" />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-panel-2 text-slate"><IconMusic className="h-4 w-4" /></span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ivory">{selectedTrack ? selectedTrack.title : 'Add a sound'}</span>
                  <span className="block truncate text-xs text-slate">{selectedTrack ? selectedTrack.artist : 'Search tracks to attach'}</span>
                </span>
                <IconChevronLeft className="h-4 w-4 rotate-180 text-slate" />
              </button>

              {isGold ? (
                <label className="block text-sm font-medium text-slate">
                  Schedule for later
                  <input type="datetime-local" value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} min={new Date(Date.now() + 60000).toISOString().slice(0, 16)} className="mt-2 w-full rounded-xl border border-hairline bg-panel-2 px-3 py-2 text-sm text-ivory" />
                </label>
              ) : (
                <GoldUpgradeHint compact perk="Scheduled posts" detail="Choose a future publish time with Gold." />
              )}

              {error ? <p className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}
              {mixError ? <p className="text-sm text-rose-200">{mixError}</p> : null}
              {isMixing ? <p className="text-sm text-gold">Mixing audio… {mixProgress}%</p> : null}
            </div>

            <div className="flex items-center gap-3 border-t border-hairline px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => void submitPost('draft')}
                className="flex-1 rounded-full border border-hairline bg-panel px-5 py-3 text-sm font-semibold text-ivory transition hover:bg-ivory/10"
              >
                Save draft
              </button>
              <button
                type="submit"
                className={`flex-1 rounded-full bg-gradient-to-r ${accent.gradient} px-5 py-3 text-sm font-semibold text-obsidian transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50`}
                disabled={busy || isMixing}
              >
                {busy ? 'Publishing…' : editingId ? 'Update post' : 'Publish post'}
              </button>
            </div>
          </form>
        </div>
      ) : previewUrl ? (
        /* ---------------- CAPTURED PREVIEW SCREEN ---------------- */
        <div className="relative flex-1 overflow-hidden bg-black">
          <div className={`absolute inset-0 ${mediaFilterClass}`}>
            {mediaType === 'image' ? (
              <img src={previewUrl} alt="Captured" className="h-full w-full object-cover" />
            ) : (
              <video src={previewUrl} controls autoPlay loop playsInline className="h-full w-full object-cover" />
            )}
          </div>

          <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))]">
            <button type="button" onClick={() => void removeMedia()} aria-label="Discard" className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-ivory">
              <IconX className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => setShowFiltersSheet(true)} className="flex items-center gap-2 rounded-full bg-black/45 px-4 py-2 text-sm font-semibold text-ivory backdrop-blur">
              <IconFilters className="h-4 w-4" />
              Filters
            </button>
          </div>

          {error ? (
            <div className="absolute inset-x-4 top-20 z-10 rounded-2xl border border-rose-500/20 bg-black/70 px-4 py-3 text-sm text-rose-200">{error}</div>
          ) : null}

          <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-between px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={() => setShowSoundsSheet(true)}
              className="flex items-center gap-2 rounded-full bg-black/45 px-4 py-2 text-sm font-semibold text-ivory backdrop-blur"
            >
              <IconMusic className="h-4 w-4" />
              {selectedTrack ? selectedTrack.title.slice(0, 14) : 'Sounds'}
            </button>
            <button
              type="button"
              onClick={goToDetails}
              aria-label="Next"
              className="flex h-14 w-14 items-center justify-center rounded-full bg-ivory text-obsidian shadow-lg"
            >
              <IconArrowRight className="h-6 w-6" />
            </button>
          </div>
        </div>
      ) : (
        /* ---------------- LIVE CAMERA SCREEN ---------------- */
        <div className="relative flex-1 overflow-hidden bg-black">
          <video
            ref={cameraPreviewRef}
            autoPlay
            playsInline
            muted
            className={`absolute inset-0 h-full w-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''} ${mediaFilterClass}`}
          />

          {!cameraArmed ? (
            <div className="absolute inset-0 flex items-center justify-center bg-obsidian/95 px-8 text-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-gold">Camera</p>
                <p className="mt-3 text-lg font-semibold text-ivory">Tap to enable your camera</p>
                <p className="mt-2 text-sm text-slate">We need camera and microphone access to record.</p>
                <button type="button" onClick={() => void armCamera()} className="mt-5 rounded-full bg-ivory px-6 py-3 text-sm font-semibold text-obsidian">
                  Enable camera
                </button>
                <button type="button" onClick={openFilePicker} className="mt-3 block w-full text-sm font-semibold text-slate underline underline-offset-4">
                  Upload from device instead
                </button>
              </div>
            </div>
          ) : null}

          {countdown !== null ? (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/30">
              <span className="text-8xl font-bold text-ivory drop-shadow-lg">{countdown}</span>
            </div>
          ) : null}

          {error ? (
            <div className="absolute inset-x-4 top-20 z-10 rounded-2xl border border-rose-500/20 bg-black/70 px-4 py-3 text-sm text-rose-200">{error}</div>
          ) : null}

          {/* Top bar: close, sounds pill, right-hand tool rail */}
          <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))]">
            <button type="button" onClick={closeToFeed} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-full text-ivory drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)]">
              <IconX />
            </button>

            <button
              type="button"
              onClick={() => setShowSoundsSheet(true)}
              className="flex items-center gap-2 rounded-full bg-black/45 px-4 py-2 text-sm font-semibold text-ivory backdrop-blur"
            >
              <IconMusic className="h-4 w-4" />
              {selectedTrack ? selectedTrack.title.slice(0, 14) : 'Sounds'}
            </button>

            <div className="flex flex-col items-center gap-4 pt-1">
              <RailButton icon={<IconFlip />} label="Flip" onClick={() => void toggleCamera()} />
              <RailButton icon={<IconFlash filled={flashOn} />} label={flashOn ? 'On' : 'Off'} onClick={() => void toggleFlash()} active={flashOn} />
              <RailButton icon={<IconTimer />} label={timerOption === 0 ? 'Timer' : `${timerOption}s`} onClick={cycleTimer} active={timerOption > 0} />
              <RailButton icon={<IconSpeed />} label={`${speedOption}x`} onClick={cycleSpeed} active={speedOption !== 1} />
              <RailButton icon={<IconFilters />} label="Filters" onClick={() => setShowFiltersSheet(true)} active={filterPreset !== 'none'} />
              <RailButton
                icon={<IconSparkles />}
                label="Beautify"
                active={beautifyOn}
                onClick={() => {
                  if (!isGold) {
                    void upgrade.attemptPurchase();
                    return;
                  }
                  setBeautifyOn((value) => !value);
                }}
              />
            </div>
          </div>

          {/* Bottom bar: duration pills + effects / shutter / upload */}
          <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center gap-4 text-sm font-semibold">
              {DURATION_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => selectDuration(option)}
                  className={selectedDuration === option.key ? 'rounded-full bg-ivory px-4 py-1.5 text-obsidian' : 'px-2 py-1.5 text-ivory/85 drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)]'}
                >
                  {option.gold && !isGold ? `🔒 ${option.label}` : option.label}
                </button>
              ))}
            </div>

            <div className="flex w-full items-center justify-between px-8">
              <button type="button" onClick={() => setShowFiltersSheet(true)} className="flex flex-col items-center gap-1.5">
                <span className="h-12 w-12 overflow-hidden rounded-2xl border-2 border-ivory/70 bg-gradient-to-br from-panel-2 to-panel" />
                <span className="text-xs font-medium text-ivory/85">Effects</span>
              </button>

              <button
                type="button"
                onClick={handleCaptureTap}
                disabled={!cameraArmed && !isRecording}
                className="relative flex h-[4.6rem] w-[4.6rem] items-center justify-center rounded-full border-[3px] border-ivory disabled:opacity-40"
                aria-label={selectedDuration === 'photo' ? 'Take photo' : isRecording ? 'Stop recording' : 'Start recording'}
              >
                <span className={`h-14 w-14 rounded-full transition-all ${isRecording ? 'scale-75 rounded-2xl bg-rose-500' : 'bg-ivory'}`} />
                {isRecording ? (
                  <span className="absolute -bottom-6 whitespace-nowrap text-xs font-semibold text-ivory">
                    {recordingSeconds}s
                  </span>
                ) : null}
              </button>

              <button type="button" onClick={openFilePicker} className="flex flex-col items-center gap-1.5">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ivory/15">
                  <IconImage className="h-6 w-6 text-ivory" />
                </span>
                <span className="text-xs font-medium text-ivory/85">Upload</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- SOUNDS BOTTOM SHEET ---------------- */}
      {showSoundsSheet ? (
        <div className="absolute inset-0 z-30 flex flex-col justify-end bg-black/60" onClick={() => setShowSoundsSheet(false)}>
          <div
            className="max-h-[72vh] overflow-y-auto rounded-t-3xl border-t border-hairline bg-panel/95 p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] backdrop-blur-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ivory/20" />
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-slate">Sounds</p>
              <button type="button" onClick={() => setShowSoundsSheet(false)} aria-label="Close" className="text-slate"><IconX className="h-5 w-5" /></button>
            </div>

            <input
              value={trackQuery}
              onChange={(event) => {
                setTrackQuery(event.target.value);
                setSelectedTrack(null);
              }}
              placeholder="Search for a track to attach"
              className="w-full rounded-xl border border-hairline bg-panel px-4 py-3 text-sm text-ivory outline-none"
              autoFocus
            />

            {trackResults.length > 0 ? (
              <div className="mt-3 space-y-2">
                {trackResults.map((track) => (
                  <button
                    key={track.id}
                    type="button"
                    onClick={() => selectTrack(track)}
                    className="w-full rounded-2xl border border-hairline bg-panel/80 px-4 py-3 text-left text-sm text-ivory transition hover:border-hairline-strong hover:bg-panel-2"
                  >
                    <p className="font-semibold">{track.title}</p>
                    <p className="text-xs text-slate">{track.artist}</p>
                  </button>
                ))}
              </div>
            ) : null}

            {selectedTrack ? (
              <div className="mt-4 rounded-2xl border border-amber-400/20 bg-panel/90 p-4 text-sm text-ivory">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {selectedTrack.cover_art_url ? (
                      <img src={selectedTrack.cover_art_url} alt={`${selectedTrack.title} cover`} className="h-14 w-14 rounded-2xl object-cover" />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-panel-2 text-xs uppercase tracking-[0.25em] text-slate">Audio</div>
                    )}
                    <div>
                      <p className="font-semibold text-ivory">{selectedTrack.title}</p>
                      <p className="text-xs text-slate">{selectedTrack.artist}</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setSelectedTrack(null)} className="rounded-full bg-ivory/10 px-3 py-1.5 text-xs font-semibold text-ivory">Remove</button>
                </div>

                {selectedTrack.preview_url ? (
                  <div className="mt-4">
                    <audio ref={audioRef} src={selectedTrack.preview_url} className="w-full" controls />
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={audioDuration || 0}
                        step={0.01}
                        value={audioTime}
                        onChange={(event) => {
                          const nextTime = Number(event.target.value);
                          if (audioRef.current) {
                            audioRef.current.currentTime = nextTime;
                          }
                          setAudioTime(nextTime);
                        }}
                        className="w-full"
                      />
                      <div className="text-xs text-slate">{new Date(audioTime * 1000).toISOString().substr(14, 5)}</div>
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-xs text-slate">No preview available for this track.</p>
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* ---------------- FILTERS BOTTOM SHEET ---------------- */}
      {showFiltersSheet ? (
        <div className="absolute inset-0 z-30 flex flex-col justify-end bg-black/60" onClick={() => setShowFiltersSheet(false)}>
          <div
            className="max-h-[60vh] overflow-y-auto rounded-t-3xl border-t border-hairline bg-panel/95 p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] backdrop-blur-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ivory/20" />
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-slate">Filters</p>
              <button type="button" onClick={() => setShowFiltersSheet(false)} aria-label="Close" className="text-slate"><IconX className="h-5 w-5" /></button>
            </div>

            <div className="flex flex-wrap gap-2">
              {FILTER_PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => {
                    if (preset.gold && !isGold) {
                      void upgrade.attemptPurchase();
                      return;
                    }
                    setFilterPreset(preset.key);
                    setShowFiltersSheet(false);
                  }}
                  aria-disabled={preset.gold && !isGold}
                  className={`rounded-full border px-3 py-2 text-left text-sm ${filterPreset === preset.key ? 'border-amber-400 bg-gold/10 text-ivory' : 'border-hairline text-slate hover:border-white/20 hover:bg-ivory/5'} ${preset.gold && !isGold ? 'opacity-60' : ''}`}
                >
                  <span className="font-semibold">{preset.gold && !isGold ? '🔒 ' : ''}{preset.label}</span>
                </button>
              ))}
            </div>
            {!isGold ? <div className="mt-3"><GoldUpgradeHint perk="Unlock 4 exclusive filters + 3-minute posts with Gold" detail="Tap any locked filter or upgrade here to open the Gold membership flow." /></div> : null}
            {goldLimitNotice ? (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-gold/25 bg-gold/5 px-4 py-3 text-sm text-slate">
                <span>Free limit reached — Gold posts up to 3 minutes.</span>
                <GoldUpgradeHint compact perk="Gold posts" detail="Record up to 3 minutes instead of 1 minute." />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
