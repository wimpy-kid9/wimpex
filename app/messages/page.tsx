"use client";

import MessageList from './MessageList';

export default function MessagesPage() {
  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <MessageList />
      </div>
    </main>
  );
}
