import React from 'react';

export interface GoldBadgeProps {
  size?: 'sm' | 'md' | 'lg';
  inline?: boolean;
}

/**
 * GoldBadge component showing verification icon for verified/subscriber users
 */
export function GoldBadge({ size = 'md', inline = false }: GoldBadgeProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6'
  };

  const container = inline ? 'inline-block' : 'block';

  return (
    <div className={`${container} text-gold`} title="Verified subscriber">
      <svg
        viewBox="0 0 24 24"
        className={`${sizeClasses[size]} drop-shadow-lg`}
      >
        {/* Scalloped seal shape, in the style of TikTok/Twitter verification badges */}
        <path
          fill="currentColor"
          d="M 12 1.7 Q 15.12 4.47 19.28 4.72 Q 19.53 8.88 22.3 12 Q 19.53 15.12 19.28 19.28 Q 15.12 19.53 12 22.3 Q 8.88 19.53 4.72 19.28 Q 4.47 15.12 1.7 12 Q 4.47 8.88 4.72 4.72 Q 8.88 4.47 12 1.7 Z"
        />
        {/* Checkmark in white, matching standard verification badge styling */}
        <path
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7.5 12.3l3 3 6-6.1"
        />
      </svg>
    </div>
  );
}

export default GoldBadge;
