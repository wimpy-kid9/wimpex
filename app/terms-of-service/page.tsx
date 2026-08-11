import Link from 'next/link';

export default function TermsOfServicePage() {
  return (
    <main className="space-y-8 px-4 py-10 sm:px-6 lg:px-8">
      <section className="surface-veil rounded-md bg-panel-2/80 p-8 shadow-2xl shadow-black/30 backdrop-blur-xl text-ivory">
        <p className="text-sm uppercase tracking-[0.3em] text-gold">Terms of Service</p>
        <h1 className="mt-3 text-4xl font-semibold text-ivory">WIMPEX Terms of Service</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate">
          These terms govern your use of WIMPEX. By using the service, you agree to follow the rules for posting, sharing, and interacting with other users.
        </p>
      </section>

      <section className="space-y-6 rounded-md border border-hairline bg-panel/80 p-8 text-ivory">
        <div>
          <h2 className="text-2xl font-semibold text-ivory">User conduct</h2>
          <p className="mt-3 text-sm leading-7 text-slate">
            You are responsible for the content you publish. Do not post harmful, illegal, or abusive material. Respect other members and use the platform in good faith.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold text-ivory">Account access</h2>
          <p className="mt-3 text-sm leading-7 text-slate">
            Access is provided through WimpyID. Keep your credentials secure and use the standard login/signup flows to manage your account.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold text-ivory">Content ownership</h2>
          <p className="mt-3 text-sm leading-7 text-slate">
            You retain ownership of your original content. By publishing on WIMPEX, you grant the service permission to store and display your content publicly or to your selected audience.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold text-ivory">Termination</h2>
          <p className="mt-3 text-sm leading-7 text-slate">
            WIMPEX may suspend or close accounts that violate these terms or engage in abusive behavior. We reserve the right to remove content that violates the community guidelines.
          </p>
        </div>
      </section>

      <div className="rounded-md border border-hairline bg-panel-2/80 p-6 text-sm text-slate">
        <p>
          Back to <Link href="/profile" className="text-gold hover:text-gold">Profile</Link> or read the <Link href="/privacy-policy" className="text-gold hover:text-gold">Privacy Policy</Link>.
        </p>
      </div>
    </main>
  );
}
