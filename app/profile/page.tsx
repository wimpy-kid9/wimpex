"use client";

// Link not used here; keep for future actions
import { useEffect, useState } from 'react';
import { getUserAccent } from '@/lib/ui-theme';
import { authedFetch } from '@/lib/api-client';
import ProfileHeader from '@/app/components/ProfileHeader';

export default function ProfilePage() {
  const accent = getUserAccent('profile-shell');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await authedFetch('/api/profile');
        if (!response.ok) {
          setProfile(null);
          setLoading(false);
          return;
        }
        const payload = await response.json();
        setProfile(payload.profile || null);
      } catch (err) {
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  if (loading) {
    return (
      <main className="p-8">
        <p>Loading profile…</p>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <ProfileHeader profile={profile} />

      <section className="mt-8 grid gap-4 md:grid-cols-[1.25fr_0.75fr]">
        <div className="thread-card rounded-[1.5rem] border border-white/10 bg-slate-950/70 p-5">
          <div className="flex items-center gap-4">
            <div className={`flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br ${accent.gradient} text-xl font-semibold text-white shadow-lg shadow-amber-500/20`}>
              {profile?.display_name?.[0] ?? profile?.username?.[0] ?? 'U'}
            </div>
            <div>
              <p className="text-xl font-semibold text-white">{profile?.display_name ?? profile?.username ?? 'Unknown'}</p>
              <p className="text-sm text-slate-400">{profile?.username ? `@${profile.username}` : null}</p>
            </div>
          </div>
          {profile?.bio ? <p className="mt-5 text-sm leading-7 text-slate-300">{profile.bio}</p> : null}
        </div>

        <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/70 p-5">
          <div className="text-sm text-slate-400">Profile stats will appear here when available.</div>
        </div>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={async () => {
            const response = await authedFetch('/api/reports', {
              method: 'POST',
              body: JSON.stringify({ reported_user_id: profile?.user_id, report_type: 'user', reason: 'Harassment' })
            });
            const payload = await response.json();
            setMessage(payload.ok ? 'Report recorded.' : payload.error || 'Unable to submit report.');
          }} className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20">
            Report profile
          </button>
          <button type="button" className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10">
            Block user
          </button>
        </div>
        {message ? <p className="mt-3 text-sm text-amber-200">{message}</p> : null}
      </section>
    </main>
  );
}
