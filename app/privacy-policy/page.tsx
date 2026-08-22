import Link from 'next/link';

export default function PrivacyPolicyPage() {
  return (
    <main className="space-y-8 px-4 py-10 sm:px-6 lg:px-8">
      <section className="surface-veil rounded-md bg-panel-2/80 p-8 shadow-2xl shadow-black/30 backdrop-blur-xl text-ivory">
        <p className="text-sm uppercase tracking-[0.3em] text-gold">Privacy Policy</p>
        <h1 className="mt-3 text-4xl font-semibold text-ivory">WIMPEX Privacy Policy</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate">
          Your privacy matters. This policy explains what data we collect, how it is used, and how you can control it while using WIMPEX.
        </p>
      </section>

      <section className="space-y-6 rounded-md border border-hairline bg-panel/80 p-8 text-ivory">
        <div>
          <h2 className="text-2xl font-semibold text-ivory">Information we collect</h2>
          <p className="mt-3 text-sm leading-7 text-slate">
            We collect the minimum data needed to make the app work: account identifiers from WimpyID, your public profile information, media uploads, and content you choose to publish.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold text-ivory">How we use your data</h2>
          <p className="mt-3 text-sm leading-7 text-slate">
            Data is used to render your feed, enable social interactions, store media in the appropriate buckets, and honor your privacy settings for messaging, calls, and followers.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold text-ivory">Storage and security</h2>
          <p className="mt-3 text-sm leading-7 text-slate">
            Uploaded avatars and videos are stored in dedicated buckets. Access is granted through public URLs for avatars and videos that are part of published posts.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold text-ivory">Your choices</h2>
          <p className="mt-3 text-sm leading-7 text-slate">
            You can control your profile, visibility, messaging privacy, and call privacy from your settings.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold text-ivory">Deleting your data</h2>
          <p className="mt-3 text-sm leading-7 text-slate">
            You can permanently delete your WIMPEX profile, posts, messages, connections, calls, and uploaded media at any time from Settings → Danger zone → &quot;Delete my WIMPEX data.&quot; This action is immediate and cannot be undone.
          </p>
          <p className="mt-3 text-sm leading-7 text-slate">
            WIMPEX uses WimpyID as its identity provider, and your WimpyID account is shared across other Wimpy Cooperations products. Deleting your WIMPEX data does not delete your WimpyID account. To delete your WimpyID account entirely, manage it directly at{' '}
            <a href="https://id.wimpy-corp.com.ng" className="text-gold hover:text-gold">id.wimpy-corp.com.ng</a>.
          </p>
          <p className="mt-3 text-sm leading-7 text-slate">
            Some records — reports made about you or by you, and billing/subscription history — are retained after deletion for fraud-prevention, moderation, and legal/accounting purposes, consistent with applicable law.
          </p>
        </div>
      </section>

      <div className="rounded-md border border-hairline bg-panel-2/80 p-6 text-sm text-slate">
        <p>
          Back to <Link href="/profile" className="text-gold hover:text-gold">Profile</Link> or view the <Link href="/terms-of-service" className="text-gold hover:text-gold">Terms of Service</Link>.
        </p>
      </div>
    </main>
  );
}