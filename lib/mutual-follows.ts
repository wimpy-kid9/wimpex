import { supabaseServer } from './supabase-server';

export async function getMutualFollows(userId: string) {
  // Fetch followers (who follow userId)
  const { data: followers } = await supabaseServer.from('wpx_follows').select('follower_id').eq('followed_id', userId);
  const { data: following } = await supabaseServer.from('wpx_follows').select('followed_id').eq('follower_id', userId);

  const followerIds = new Set((followers || []).map((r: any) => r.follower_id));
  const followingIds = new Set((following || []).map((r: any) => r.followed_id));

  const mutual: string[] = [];
  followerIds.forEach((id) => {
    if (typeof id === 'string' && followingIds.has(id)) mutual.push(id);
  });

  return mutual;
}
