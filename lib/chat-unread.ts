const CHAT_UNREAD_KEY = 'wimpex_chat_unread_by_conversation';
const CHAT_TOTAL_UNREAD_KEY = 'wimpex_chat_total_unread';

export function readConversationReadState(): Record<string, string> {
  if (typeof window === 'undefined') return {};

  try {
    const value = window.localStorage.getItem(CHAT_UNREAD_KEY);
    return value ? JSON.parse(value) : {};
  } catch {
    return {};
  }
}

export function markConversationRead(conversationId: string) {
  if (typeof window === 'undefined' || !conversationId) return;

  const nextState = readConversationReadState();
  nextState[conversationId] = new Date().toISOString();
  window.localStorage.setItem(CHAT_UNREAD_KEY, JSON.stringify(nextState));
  window.dispatchEvent(new CustomEvent('wimpex-chat-unread-updated'));
}

export function getConversationUnreadCount(
  conversationId: string,
  lastMessageAt: string | null | undefined,
  lastMessageFromMe: boolean
) {
  if (!conversationId || !lastMessageAt || lastMessageFromMe) return 0;

  const lastOpenedAt = readConversationReadState()[conversationId];
  if (!lastOpenedAt) return 1;

  return new Date(lastMessageAt).getTime() > new Date(lastOpenedAt).getTime() ? 1 : 0;
}

export function syncTotalUnreadCount(totalUnread: number) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CHAT_TOTAL_UNREAD_KEY, String(totalUnread));
  window.dispatchEvent(new CustomEvent('wimpex-chat-unread-updated'));
}

export function getTotalUnreadCount() {
  if (typeof window === 'undefined') return 0;

  try {
    const value = Number(window.localStorage.getItem(CHAT_TOTAL_UNREAD_KEY) || '0');
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}
