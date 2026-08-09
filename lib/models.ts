export interface UserProfile {
  id: string;
  name: string;
  email?: string;
}

export interface Post {
  id: string;
  title: string;
  content: string;
}

export type FeedVisibility = 'public' | 'connections' | 'private';

export interface FeedPost {
  id: string;
  author: string;
  handle: string;
  caption: string;
  visibility: FeedVisibility;
  createdAt: string;
  accent: string;
}

const FEED_STORAGE_KEY = 'wimpex-demo-posts';

const demoPosts: FeedPost[] = [
  {
    id: 'demo-1',
    author: 'Ayo',
    handle: '@ayo',
    caption: 'A short clip from tonight’s studio session and the first draft of the Adire-inspired feed.',
    visibility: 'public',
    createdAt: '2026-08-09T10:00:00.000Z',
    accent: 'from-fuchsia-500 to-cyan-500'
  },
  {
    id: 'demo-2',
    author: 'Lina',
    handle: '@lina',
    caption: 'Private rehearsal clip for trusted connections only.',
    visibility: 'connections',
    createdAt: '2026-08-09T08:30:00.000Z',
    accent: 'from-amber-500 to-rose-500'
  }
];

export function getFeedPosts(): FeedPost[] {
  if (typeof window === 'undefined') {
    return demoPosts;
  }

  const stored = window.localStorage.getItem(FEED_STORAGE_KEY);
  if (!stored) {
    window.localStorage.setItem(FEED_STORAGE_KEY, JSON.stringify(demoPosts));
    return demoPosts;
  }

  try {
    return JSON.parse(stored) as FeedPost[];
  } catch {
    window.localStorage.setItem(FEED_STORAGE_KEY, JSON.stringify(demoPosts));
    return demoPosts;
  }
}

export function saveFeedPosts(posts: FeedPost[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(FEED_STORAGE_KEY, JSON.stringify(posts));
}

export function createFeedPost(input: { caption: string; visibility: FeedVisibility }): FeedPost {
  const accent = ['from-fuchsia-500 to-cyan-500', 'from-emerald-500 to-lime-500', 'from-amber-500 to-rose-500'][
    Math.floor(Math.random() * 3)
  ];

  return {
    id: `post-${Date.now()}`,
    author: 'You',
    handle: '@you',
    caption: input.caption,
    visibility: input.visibility,
    createdAt: new Date().toISOString(),
    accent
  };
}
