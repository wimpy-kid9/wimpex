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
        fill="currentColor"
        className={`${sizeClasses[size]} drop-shadow-lg`}
      >
        {/* Star icon representing gold/verified status */}
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    </div>
  );
}

export default GoldBadge;
