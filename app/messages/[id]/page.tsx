"use client";

import { useParams } from 'next/navigation';
import ChatThread from '@/app/messages/ChatThread';

export default function ThreadPage() {
  const params = useParams();
  const conversationId = params?.id as string;

  return <ChatThread conversationId={conversationId} showBackButton />;
}
