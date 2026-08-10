"use client";

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const usernamePattern = /^[a-zA-Z0-9_]{3,20}$/;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState('');
  const [username, setUsername] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [bio, setBio] = useState('');
  const [gender, setGender] = useState('');
  const [messagePrivacy, setMessagePrivacy] = useState('connections');
  const [callPrivacy, setCallPrivacy] = useState('connections');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadSession = async () => {
      const result = await supabase.auth.getSession();
      const sessionData = result?.data;
      if (!sessionData?.session) {
        router.replace('/');
        return;
      }

      setSession(sessionData.session);

      const profileResponse = await fetch('/api/profile', {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`
        }
      });

      if (profileResponse.ok) {
        const profilePayload = await profileResponse.json();
        const nextProfile = profilePayload?.profile;

        if (nextProfile?.onboarding_completed_at) {
          router.replace('/feed');
          return;
        }

        if (nextProfile?.username) {
          setUsername(nextProfile.username);
          setUsernameAvailable(true);
        }
        if (nextProfile?.display_name) {
          setDisplayName(nextProfile.display_name);
        }
        if (nextProfile?.date_of_birth) {
          setDateOfBirth(nextProfile.date_of_birth);
        }
        if (nextProfile?.bio) {
          setBio(nextProfile.bio);
        }
        if (nextProfile?.gender) {
          setGender(nextProfile.gender);
        }
        if (nextProfile?.avatar_url) {
          setAvatarPreview(nextProfile.avatar_url);
        }

        const hasUsername = Boolean(nextProfile?.username);
        const hasProfileDetails = Boolean(nextProfile?.display_name || nextProfile?.date_of_birth || nextProfile?.bio || nextProfile?.gender || nextProfile?.avatar_url);
        const derivedStep = hasUsername ? (hasProfileDetails ? 3 : 2) : 1;
        setStep(derivedStep);
      }

      setLoading(false);
    };

    void loadSession();
  }, [router]);

  useEffect(() => {
    if (!username || !usernamePattern.test(username)) {
      setUsernameAvailable(null);
      return;
    }

    const timer = window.setTimeout(async () => {
      setCheckingUsername(true);
      const response = await fetch(`/api/profile/availability?username=${encodeURIComponent(username)}`);
      const data = await response.json();
      setUsernameAvailable(data?.available ?? false);
      setCheckingUsername(false);
    }, 500);

    return () => window.clearTimeout(timer);
  }, [username]);

  const canProceedStep1 = useMemo(
    () => usernamePattern.test(username) && usernameAvailable === true,
    [username, usernameAvailable]
  );

  const saveUsername = async () => {
    if (!session) return;
    setSaving(true);
    setError('');

    const response = await fetch('/api/profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ username })
    });

    if (!response.ok) {
      const result = await response.json();
      setError(result.error || 'Unable to reserve username.');
      setStatusMessage('');
      setSaving(false);
      return;
    }

    setStatusMessage('Username saved to Supabase.');
    setStep(2);
    setSaving(false);
  };

  const uploadAvatar = async () => {
    if (!session || !avatarFile) return;

    setUploadingAvatar(true);
    setError('');

    const formData = new FormData();
    formData.append('avatar', avatarFile);

    const response = await fetch('/api/upload-avatar', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`
      },
      body: formData
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.error || 'Unable to upload avatar.');
      setUploadingAvatar(false);
      return;
    }

    setAvatarPreview(payload.avatarUrl || null);
    setUploadingAvatar(false);
    setStatusMessage('Avatar uploaded.');
  };

  const completeOnboarding = async () => {
    if (!session) return;
    if (!displayName || !dateOfBirth) {
      setError('Display name and date of birth are required.');
      return;
    }

    if (avatarFile) {
      await uploadAvatar();
    }

    setSaving(true);
    setError('');

    const response = await fetch('/api/profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        display_name: displayName,
        date_of_birth: dateOfBirth,
        bio,
        gender,
        onboarding_completed_at: new Date().toISOString()
      })
    });

    if (!response.ok) {
      const result = await response.json();
      setError(result.error || 'Unable to complete onboarding.');
      setStatusMessage('');
      setSaving(false);
      return;
    }

    const privacyResponse = await fetch('/api/profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        message_privacy: messagePrivacy,
        call_privacy: callPrivacy
      })
    });

    if (!privacyResponse.ok) {
      setError('Profile saved, but privacy settings could not be updated.');
      setSaving(false);
      router.replace('/feed');
      return;
    }

    setStatusMessage('Profile saved to Supabase.');
    setSaving(false);
    router.replace('/feed');
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 text-slate-100">
        <p>Loading onboarding…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
      <div className="surface-veil mx-auto w-full max-w-3xl rounded-[2rem] bg-slate-900/85 p-8 shadow-2xl shadow-slate-950/40">
        <h1 className="text-display text-3xl text-white">Complete your WIMPEX profile</h1>
        <p className="mt-3 text-slate-400">Finish onboarding now so your profile is ready for friends and content.</p>

        {step === 1 ? (
          <section className="mt-10 space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-300">Choose a username</label>
              <div className="mt-2 flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3">
                <span className="text-slate-500">@</span>
                <input
                  className="w-full bg-transparent text-white outline-none placeholder:text-slate-500"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="your_username"
                />
              </div>
              <p className="mt-2 text-sm text-slate-400">3–20 characters; letters, numbers, and underscores only.</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
              <p className="text-sm text-slate-300">Availability</p>
              <p className="mt-2 text-base font-medium text-slate-100">
                {checkingUsername
                  ? 'Checking username…'
                  : username
                  ? usernameAvailable === null
                    ? 'Enter a valid username to check availability.'
                    : usernameAvailable
                    ? 'Great, that username is available.'
                    : 'That username is taken.'
                  : 'Start by entering a username.'}
              </p>
            </div>
            {error ? <p className="text-sm text-rose-400">{error}</p> : null}
            {statusMessage ? <p className="text-sm text-amber-200">{statusMessage}</p> : null}
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-2xl bg-sky-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={saveUsername}
              disabled={!canProceedStep1 || saving}
            >
              {saving ? 'Saving…' : 'Reserve username'}
            </button>
          </section>
        ) : (
          <section className="mt-10 space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-300">Display name</label>
                <input
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Your display name"
                />
              </div>
              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-300">Date of birth</label>
                <input
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none"
                  type="date"
                  value={dateOfBirth}
                  onChange={(event) => setDateOfBirth(event.target.value)}
                />
              </div>
            </div>
            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-300">Bio</label>
              <textarea
                className="min-h-[120px] w-full rounded-3xl border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none"
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                placeholder="Tell people a little about yourself"
              />
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
              <label className="block text-sm font-medium text-slate-300">Profile photo</label>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="cursor-pointer rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-200 transition hover:bg-slate-800">
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null;
                      if (file) {
                        setAvatarFile(file);
                        setAvatarPreview(URL.createObjectURL(file));
                      }
                    }}
                  />
                  {avatarFile ? `Selected: ${avatarFile.name}` : 'Upload photo'}
                </label>
                <button type="button" className="rounded-2xl border border-slate-700 px-4 py-2 text-sm text-slate-200" onClick={() => setAvatarFile(null)}>
                  Skip for now
                </button>
              </div>
              {avatarPreview ? <div className="mt-4 flex items-center gap-3"><Image src={avatarPreview} alt="Avatar preview" width={56} height={56} className="h-14 w-14 rounded-full object-cover" /><p className="text-sm text-slate-400">A generated initials fallback is used if you skip this step.</p></div> : null}
              <p className="mt-2 text-sm text-slate-400">Your avatar is optional; if you skip it, WIMPEX will fall back to initials.</p>
            </div>
            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-300">Gender (optional)</label>
              <select
                className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none"
                value={gender}
                onChange={(event) => setGender(event.target.value)}
              >
                <option value="">Prefer not to say</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="nonbinary">Non-binary</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300">Who can message you?</label>
                <select
                  className="mt-3 w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none"
                  value={messagePrivacy}
                  onChange={(event) => setMessagePrivacy(event.target.value)}
                >
                  <option value="connections">Accepted connections only</option>
                  <option value="everyone">Anyone</option>
                  <option value="no_one">No one</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">Who can call you?</label>
                <select
                  className="mt-3 w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none"
                  value={callPrivacy}
                  onChange={(event) => setCallPrivacy(event.target.value)}
                >
                  <option value="connections">Accepted connections only</option>
                  <option value="everyone">Anyone</option>
                  <option value="no_one">No one</option>
                </select>
              </div>
              <p className="text-sm text-slate-400">These privacy rules now gate both messaging and calls from the server side.</p>
            </div>
            {error ? <p className="text-sm text-rose-400">{error}</p> : null}
            {statusMessage ? <p className="text-sm text-amber-200">{statusMessage}</p> : null}
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-2xl bg-sky-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={completeOnboarding}
              disabled={saving || uploadingAvatar}
            >
              {saving ? 'Completing…' : uploadingAvatar ? 'Uploading avatar…' : 'Finish onboarding'}
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
