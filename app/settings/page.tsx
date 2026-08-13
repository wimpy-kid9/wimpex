"use client";

import { ChangeEvent, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authedFetch } from '@/lib/api-client';

const WIMPEX_PLAN_NAME = 'Wimpex Pro';

function formatNaira(amount: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0
  }).format(amount);
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [gender, setGender] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [subscription, setSubscription] = useState<any | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [billingInterval, setBillingInterval] = useState('monthly');
  const [walletShortfall, setWalletShortfall] = useState<number | null>(null);
  const [redirectingAfterWalletTopup, setRedirectingAfterWalletTopup] = useState(false);
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

  const loadPlanPrice = async () => {
    try {
      const response = await authedFetch(`/api/wimpypay?product_name=wimpex&plan_name=${encodeURIComponent(WIMPEX_PLAN_NAME)}`);
      if (!response.ok) return;
      const payload = await response.json();
      setPrice(Number(payload.price ?? 0));
      setBillingInterval(payload.billing_interval || payload.billingInterval || 'monthly');
    } catch {
      setPrice(null);
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
      setUsername(result.profile?.username ?? '');
      setBio(result.profile?.bio ?? '');
      setGender(result.profile?.gender ?? '');
      setAvatarUrl(result.profile?.avatar_url ?? '');
      await Promise.all([loadSubscription(), loadPlanPrice()]);
      setLoading(false);
    };

    loadProfile();
  }, []);

  const performAvatarUpload = async (file: File) => {
    const { data } = await supabase.auth.getSession();
    if (!data?.session) {
      setMessage('Unable to authenticate.');
      return;
    }

    setUploadingAvatar(true);
    setMessage('');

    const formData = new FormData();
    formData.append('avatar', file);

    const response = await fetch('/api/upload-avatar', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${data.session.access_token}`
      },
      body: formData
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(result.error || 'Unable to upload avatar.');
      setUploadingAvatar(false);
      return;
    }

    setAvatarUrl(result.avatarUrl || '');
    setMessage('Avatar updated.');
    setUploadingAvatar(false);
  };

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    await performAvatarUpload(file);
    event.target.value = '';
  };

  const saveSettings = async () => {
    setSaving(true);
    const { data } = await supabase.auth.getSession();
    if (!data?.session) {
      setMessage('Unable to authenticate.');
      setSaving(false);
      return;
    }

    const response = await fetch('/api/profile', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${data.session.access_token}`
      },
      body: JSON.stringify({ username, display_name: displayName, bio, gender, avatar_url: avatarUrl })
    });

    if (response.ok) {
      setMessage('Profile updated.');
    } else {
      const result = await response.json();
      setMessage(result.error || 'Unable to save profile.');
    }

    setSaving(false);
  };

  const runUpgradePurchase = async () => {
    setNotice('');
    try {
      const response = await authedFetch('/api/wimpypay', {
        method: 'POST',
        body: JSON.stringify({ product_name: 'wimpex', plan_name: WIMPEX_PLAN_NAME })
      });
      const payload = await response.json();

      if (!response.ok) {
        if (payload.error === 'insufficient_funds') {
          setWalletShortfall(Number(payload.requiredAmount || 0));
          setNotice(`You need ${formatNaira(Number(payload.requiredAmount || 0))} more in your WimpyPay wallet`);
          return;
        }

        setNotice(payload.error || 'Unable to purchase Gold.');
        return;
      }

      setWalletShortfall(null);
      setSubscription(payload.subscription || null);
      setNotice('WIMPEX Gold is now active!');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to complete purchase.');
    }
  };

  const fundWallet = async () => {
    const requiredAmount = walletShortfall ?? (price ?? 0);
    if (!requiredAmount || !window) {
      return;
    }

    const paystackScript = 'https://js.paystack.co/v1/inline.js';
    const script = document.createElement('script');
    script.src = paystackScript;
    script.async = true;

    await new Promise<void>((resolve, reject) => {
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Unable to load Paystack.'));
      document.body.appendChild(script);
    }).catch((error) => {
      setNotice(error instanceof Error ? error.message : 'Unable to open wallet funding flow.');
      return;
    });

    const paystackKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
    if (!paystackKey || !(window as any).PaystackPop) {
      setNotice('Paystack is not configured for wallet funding.');
      return;
    }

    const { data } = await supabase.auth.getSession();
    const email = data?.session?.user?.email || 'user@example.com';

    const paystack = (window as any).PaystackPop.setup({
      key: paystackKey,
      email,
      amount: Math.max(Math.ceil(requiredAmount), 1) * 100,
      currency: 'NGN',
      ref: `wimpex-wallet-${Date.now()}`,
      onClose: () => {
        setNotice('Wallet funding cancelled.');
      },
      callback: async (response: any) => {
        setNotice('Wallet funded. Completing your upgrade…');
        setRedirectingAfterWalletTopup(true);
        await new Promise((resolve) => setTimeout(resolve, 1200));
        await runUpgradePurchase();
        setRedirectingAfterWalletTopup(false);
        if (!response || !response.reference) {
          setNotice('Wallet funding did not complete.');
        }
      }
    });

    paystack.openIframe();
  };

  const purchaseGold = async () => {
    await runUpgradePurchase();
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
              <p className="text-sm text-ivory">{price ? `Upgrade to WIMPEX Gold for ${formatNaira(price)} per ${billingInterval}.` : 'Upgrade to WIMPEX Gold for streak rewards, premium filters, and improved visibility.'}</p>
              <div className="flex flex-wrap items-center gap-3">
                <button onClick={purchaseGold} className="rounded-2xl bg-gold px-5 py-3 text-sm font-semibold text-obsidian transition hover:bg-gold-deep">Subscribe to Gold</button>
                {walletShortfall ? (
                  <button onClick={fundWallet} className="rounded-2xl border border-gold/60 bg-gold/10 px-5 py-3 text-sm font-semibold text-gold transition hover:bg-gold/20">
                    {redirectingAfterWalletTopup ? 'Completing purchase…' : 'Fund Wallet'}
                  </button>
                ) : null}
              </div>
            </div>
          )}
          {notice ? <p className="mt-3 text-sm text-gold">{notice}</p> : null}
        </div>

        <div className="mt-8 space-y-6">
          <div className="flex items-center gap-4 rounded-3xl border border-hairline bg-panel-2/80 p-4">
            <div className="relative">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile avatar" className="h-20 w-20 rounded-full object-cover" />
              ) : (
                <div className="grid h-20 w-20 place-items-center rounded-full bg-panel text-lg font-semibold text-ivory">
                  {displayName?.charAt(0)?.toUpperCase() || username?.charAt(0)?.toUpperCase() || 'U'}
                </div>
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate">Profile photo</p>
              <label className="mt-2 inline-flex cursor-pointer items-center rounded-2xl bg-gold px-4 py-2 text-sm font-semibold text-obsidian transition hover:bg-gold-deep">
                <span>{uploadingAvatar ? 'Uploading…' : 'Change photo'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} disabled={uploadingAvatar} />
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate">Username</label>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-hairline bg-panel-2 px-4 py-3 text-ivory outline-none"
              placeholder="your_username"
            />
          </div>

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
