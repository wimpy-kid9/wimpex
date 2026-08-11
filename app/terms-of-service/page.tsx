import Link from 'next/link';

export default function TermsOfServicePage() {
  return (
    <main className="space-y-8 px-4 py-10 sm:px-6 lg:px-8">
      <section className="surface-veil rounded-[2rem] bg-slate-900/80 p-8 shadow-2xl shadow-black/30 backdrop-blur-xl text-slate-100">
        <p className="text-sm uppercase tracking-[0.3em] text-amber-300">Terms of Service</p>
        <h1 className="mt-3 text-4xl font-semibold text-white">WIMPEX Terms of Service</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400">
          These terms govern your use of WIMPEX. By using the service, you agree to follow the rules for posting, sharing, and interacting with other users.
        </p>
      </section>

      <section className="space-y-6 rounded-[2rem] border border-white/10 bg-slate-950/80 p-8 text-slate-200">
        <div>
          <h2 className="text-2xl font-semibold text-white">User conduct</h2>
          <p className="mt-3 text-sm leading-7 text-slate-400">
            You are responsible for the content you publish. Do not post harmful, illegal, or abusive material. Respect other members and use the platform in good faith.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold text-white">Account access</h2>
          <p className="mt-3 text-sm leading-7 text-slate-400">
            Access is provided through WimpyID. Keep your credentials secure and use the standard login/signup flows to manage your account.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold text-white">Content ownership</h2>
          <p className="mt-3 text-sm leading-7 text-slate-400">
            You retain ownership of your original content. By publishing on WIMPEX, you grant the service permission to store and display your content publicly or to your selected audience.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold text-white">Termination</h2>
          <p className="mt-3 text-sm leading-7 text-slate-400">
            WIMPEX may suspend or close accounts that violate these terms or engage in abusive behavior. We reserve the right to remove content that violates the community guidelines.
          </p>
        </div>
      </section>

      <div className="rounded-[1.5rem] border border-white/10 bg-slate-900/80 p-6 text-sm text-slate-400">
        <p>
          Back to <Link href="/profile" className="text-amber-300 hover:text-amber-200">Profile</Link> or read the <Link href="/privacy-policy" className="text-amber-300 hover:text-amber-200">Privacy Policy</Link>.
        </p>
      </div>
    </main>
  );
}
