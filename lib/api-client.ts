import { supabase } from './supabase';

export async function authedFetch(path: string, init: any = {}) {
  const { data } = await supabase.auth.getSession();
  const token = (data as any)?.session?.access_token;

  const headers = new Headers(init.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const body = init.body;
  const bodyIsFormData = typeof body !== 'string' && body instanceof FormData;
  if ((body !== undefined && body !== null) && !bodyIsFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(path, {
    ...init,
    headers
  });

  if (response.status === 401 && typeof window !== 'undefined') {
    window.dispatchEvent(new Event('wimpex-auth-required'));
  }

  return response;
}
