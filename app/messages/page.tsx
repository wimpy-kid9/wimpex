"use client";

export default function MessagesPage() {
  return (
    <div className="flex min-h-[420px] items-center justify-center rounded-3xl border border-dashed border-hairline bg-panel-2/70 p-8 text-center text-slate">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-gold">Thread preview</p>
        <h1 className="mt-4 text-3xl font-semibold text-ivory">Select a conversation</h1>
        <p className="mt-3 text-sm leading-7">
          Use the left panel to choose a chat. On desktop the thread appears beside the list; on mobile, the thread opens full screen.
        </p>
      </div>
    </div>
  );
}
