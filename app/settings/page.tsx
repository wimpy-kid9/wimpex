"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authedFetch } from '@/lib/api-client';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [gender, setGender] = useState('');
  const [subscription, setSubscription] = useState<any | null>(null);
  const [notice, setNotice] = useState('');
  const [message, setMessage] = useState('');

  const loadSubscription = async () => {
    try {
      const response = await authedFetch('/api/wimpypay');
      if (!response.ok) return;
      const payload = await response.json();
      setSubscription(payload.subscription || null);
    } catch {
      setSubscription(null);
    }
  };

  useEffect(() => {
    const loadProfile = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data?.session) {
        setLoading(false);
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
      await loadSubscription();
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

  const purchaseGold = async () => {
    setNotice('');
    try {
      const response = await authedFetch('/api/wimpypay', {
        method: 'POST',
        body: JSON.stringify({ product_name: 'wimpex', plan_name: 'Wimpex Pro' })
      });
      const payload = await response.json();
      if (!response.ok) {
        setNotice(payload.error || 'Unable to purchase Gold.');
        return;
      }
      setSubscription(payload.subscription || null);
      setNotice('WIMPEX Gold is now active!');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to complete purchase.');
    }
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
      <div className="surface-veil rounded-md bg-panel-2/80 p-8 shadow-xl shadow-obsidian/20">
        <h1 className="text-display text-3xl text-ivory">Account Settings</h1>
        <p className="mt-2 text-slate">Edit the profile data you submitted during onboarding.</p>

        <div className="mt-6 space-y-4 rounded-3xl border border-gold/30 bg-gold/5 p-4 text-sm text-slate">
          <p className="text-sm font-semibold text-ivory">WIMPEX Gold</p>
          {subscription ? (
            <div className="space-y-2">
              <p className="text-sm text-ivory">Your Gold membership is active until {new Date(subscription.active_until).toLocaleDateString()}.</p>
              <p className="text-xs text-slate">Enjoy higher streak banking, premium ranking boosts, and exclusive experience enhancements.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-ivory">Upgrade to WIMPEX Gold for streak rewards, premium filters, and improved visibility.</p>
              <button onClick={purchaseGold} className="rounded-2xl bg-gold px-5 py-3 text-sm font-semibold text-obsidian transition hover:bg-gold-deep">Subscribe to Gold</button>
            </div>
          )}
          {notice ? <p className="mt-3 text-sm text-gold">{notice}</p> : null}
        </div>

        <div className="mt-8 space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate">Display name</label>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-hairline bg-panel-2 px-4 py-3 text-ivory outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate">Bio</label>
            <textarea
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              className="mt-2 w-full rounded-3xl border border-hairline bg-panel-2 px-4 py-3 text-ivory outline-none"
              rows={5}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate">Gender</label>
            <select
              value={gender}
              onChange={(event) => setGender(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-hairline bg-panel-2 px-4 py-3 text-ivory outline-none"
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
            className="rounded-2xl bg-gold px-6 py-3 text-sm font-semibold text-obsidian transition hover:bg-gold-deep disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>

          {message ? <p className="text-sm text-slate">{message}</p> : null}
        </div>
      </div>
    </main>
  );
}
