import { NextRequest } from 'next/server';
import { isSupabaseServerConfigured, supabaseServer } from './supabase-server';

export interface AuthUserContext {
  user: { id: string };
  token: string;
}

export async function requireAuth(request: NextRequest): Promise<AuthUserContext> {
  if (!isSupabaseServerConfigured) {
    throw new Error('Supabase server environment is not configured.');
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Unauthorized');
  }

  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabaseServer.auth.getUser(token);

  if (error || !user) {
    throw new Error(error?.message || 'Unauthorized');
  }

  return { user, token };
}
