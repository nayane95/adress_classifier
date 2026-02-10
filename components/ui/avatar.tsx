import React from 'react';
import { cn } from '@/lib/utils';

interface AvatarProps {
  base64Svg?: string;
  fallbackText?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-xs',
  lg: 'h-10 w-10 text-sm',
  xl: 'h-14 w-14 text-base',
};

export function Avatar({ base64Svg, fallbackText, size = 'md', className }: AvatarProps) {
  // If we have a valid base64 SVG, render it
  if (base64Svg && base64Svg.trim()) {
    try {
      // Check if it's already a data URI
      const dataUri = base64Svg.startsWith('data:') 
        ? base64Svg 
        : `data:image/svg+xml;base64,${base64Svg}`;
      
      return (
        <div className={cn('relative rounded-full overflow-hidden shrink-0', sizeClasses[size], className)}>
          <img 
            src={dataUri} 
            alt={fallbackText || 'Avatar'} 
            className="w-full h-full object-cover"
            onError={(e) => {
              // If image fails to load, hide it and show fallback
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
      );
    } catch (error) {
      // Fall through to fallback if there's any error
      console.warn('Failed to render avatar:', error);
    }
  }

  // Fallback: show initials or icon
  const initials = fallbackText
    ? fallbackText
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  return (
    <div 
      className={cn(
        'relative rounded-full flex items-center justify-center font-semibold bg-linear-to-br from-indigo-400 to-purple-500 text-white shrink-0',
        sizeClasses[size],
        className
      )}
    >
      {initials}
    </div>
  );
}
