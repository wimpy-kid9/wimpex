"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [gender, setGender] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const loadProfile = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data?.session) {
        return;
      }

      const response = await fetch('/api/profile', {
        headers: {
          Authorization: `Bearer ${data.session.access_token}`
        }
      });

      const result = await response.json();
      setDisplayName(result.profile?.display_name ?? '');
      setBio(result.profile?.bio ?? '');
      setGender(result.profile?.gender ?? '');
      setLoading(false);
    };

    loadProfile();
  }, []);

  const saveSettings = async () => {
    setSaving(true);
    const { data } = await supabase.auth.getSession();
    if (!data?.session) {
      setMessage('Unable to authenticate.');
      setSaving(false);
      return;
    }

    const response = await fetch('/api/profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${data.session.access_token}`
      },
      body: JSON.stringify({ display_name: displayName, bio, gender })
    });

    if (response.ok) {
      setMessage('Profile updated.');
    } else {
      const result = await response.json();
      setMessage(result.error || 'Unable to save profile.');
    }

    setSaving(false);
  };

  if (loading) {
    return (
      <main className="p-8">
        <p>Loading account settings…</p>
      </main>
    );
  }

  return (
    <main className="p-8">
      <div className="surface-veil rounded-[2rem] bg-slate-900/80 p-8 shadow-xl shadow-slate-950/20">
        <h1 className="text-display text-3xl text-slate-100">Account Settings</h1>
        <p className="mt-2 text-slate-400">Edit the profile data you submitted during onboarding.</p>

        <div className="mt-8 space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300">Display name</label>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300">Bio</label>
            <textarea
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              className="mt-2 w-full rounded-3xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 outline-none"
              rows={5}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300">Gender</label>
            <select
              value={gender}
              onChange={(event) => setGender(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 outline-none"
            >
              <option value="">Prefer not to say</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="nonbinary">Non-binary</option>
              <option value="other">Other</option>
            </select>
          </div>

          <button
            onClick={saveSettings}
            disabled={saving}
            className="rounded-2xl bg-sky-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>

          {message ? <p className="text-sm text-slate-300">{message}</p> : null}
        </div>
      </div>
    </main>
  );
}
