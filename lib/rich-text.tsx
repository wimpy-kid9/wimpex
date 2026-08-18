import Link from 'next/link';
import type { ReactNode } from 'react';

const DEFAULT_LINK_CLASSNAME = 'text-sky-400 underline decoration-sky-400/80 underline-offset-2 hover:text-sky-300';
const TOKEN_PATTERN = /(#[A-Za-z0-9_]+|@[A-Za-z0-9_]{3,20})/g;

export type RichTextRenderOptions = {
  className?: string;
  linkClassName?: string;
};

export function renderRichText(rawText: string, options: RichTextRenderOptions = {}): ReactNode[] | null {
  if (!rawText) return null;

  const { className = 'break-words', linkClassName = DEFAULT_LINK_CLASSNAME } = options;
  const parts = rawText.split(TOKEN_PATTERN);

  return parts.map((part, index) => {
    if (!part) return null;

    if (part.startsWith('#')) {
      return (
        <Link
          key={`${part}-${index}`}
          href={`/search?q=${encodeURIComponent(part)}`}
          className={linkClassName}
          onClick={(event) => event.stopPropagation()}
        >
          {part}
        </Link>
      );
    }

    if (part.startsWith('@')) {
      const username = part.slice(1);
      return (
        <Link
          key={`${part}-${index}`}
          href={`/u/${encodeURIComponent(username)}`}
          className={linkClassName}
          onClick={(event) => event.stopPropagation()}
        >
          {part}
        </Link>
      );
    }

    return <span key={`${part}-${index}`} className={className}>{part}</span>;
  });
}
