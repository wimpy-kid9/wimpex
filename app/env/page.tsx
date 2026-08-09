const envItems = [
  { key: 'NEXT_PUBLIC_SUPABASE_URL', description: 'Your Supabase project URL' },
  { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', description: 'Your Supabase anonymous public key' },
  { key: 'SUPABASE_SERVICE_ROLE_KEY', description: 'Supabase service role key for server-side requests' },
  { key: 'WIMPYPAY_API_URL', description: 'WimpyPay API endpoint' },
  { key: 'WIMPYPAY_INTERNAL_API_KEY', description: 'Internal API key for WimpyPay integration' },
  { key: 'CALLING_PLATFORM_API_KEY', description: 'API key for your chosen calling provider' },
  { key: 'PORT', description: 'Application port for local development' },
  { key: 'NODE_ENV', description: 'Node environment mode' }
];

export default function EnvPage() {
  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-10 shadow-xl">
        <h1 className="text-4xl font-semibold text-slate-900">Environment Configuration</h1>
        <p className="mt-4 text-slate-600">Copy these values into <code className="rounded bg-slate-100 px-1 py-0.5">.env.local</code> for local development.</p>

        <div className="mt-8 space-y-4">
          {envItems.map((item) => (
            <div key={item.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="font-medium text-slate-900">{item.key}</p>
              <p className="mt-1 text-sm text-slate-600">{item.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-3xl bg-slate-950 p-6 text-slate-100">
          <h2 className="text-2xl font-semibold">Example</h2>
          <pre className="mt-4 overflow-x-auto text-sm leading-6">
            {`NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

WIMPYPAY_API_URL=https://pay.wimpy-corp.com.ng
WIMPYPAY_INTERNAL_API_KEY=replace-with-real-internal-key

CALLING_PLATFORM_API_KEY=

PORT=3000
NODE_ENV=development`}
          </pre>
        </div>
      </div>
    </main>
  );
}
