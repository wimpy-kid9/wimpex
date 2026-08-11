import Link from 'next/link';

export default function PrivacyPolicyPage() {
  return (
    <main className="space-y-8 px-4 py-10 sm:px-6 lg:px-8">
      <section className="surface-veil rounded-[2rem] bg-slate-900/80 p-8 shadow-2xl shadow-black/30 backdrop-blur-xl text-slate-100">
        <p className="text-sm uppercase tracking-[0.3em] text-amber-300">Privacy Policy</p>
        <h1 className="mt-3 text-4xl font-semibold text-white">WIMPEX Privacy Policy</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400">
          Your privacy matters. This policy explains what data we collect, how it is used, and how you can control it while using WIMPEX.
        </p>
      </section>

      <section className="space-y-6 rounded-[2rem] border border-white/10 bg-slate-950/80 p-8 text-slate-200">
        <div>
          <h2 className="text-2xl font-semibold text-white">Information we collect</h2>
          <p className="mt-3 text-sm leading-7 text-slate-400">
            We collect the minimum data needed to make the app work: account identifiers from WimpyID, your public profile information, media uploads, and content you choose to publish.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold text-white">How we use your data</h2>
          <p className="mt-3 text-sm leading-7 text-slate-400">
            Data is used to render your feed, enable social interactions, store media in the appropriate buckets, and honor your privacy settings for messaging, calls, and followers.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold text-white">Storage and security</h2>
          <p className="mt-3 text-sm leading-7 text-slate-400">
            Uploaded avatars and videos are stored in dedicated buckets. Access is granted through public URLs for avatars and videos that are part of published posts.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold text-white">Your choices</h2>
          <p className="mt-3 text-sm leading-7 text-slate-400">
            You can control your profile, visibility, messaging privacy, and call privacy from your settings. If you want to remove your account, use the WimpyID service that issued your login.
          </p>
        </div>
      </section>

      <div className="rounded-[1.5rem] border border-white/10 bg-slate-900/80 p-6 text-sm text-slate-400">
        <p>
          Back to <Link href="/profile" className="text-amber-300 hover:text-amber-200">Profile</Link> or view the <Link href="/terms-of-service" className="text-amber-300 hover:text-amber-200">Terms of Service</Link>.
        </p>
      </div>
    </main>
  );
}
