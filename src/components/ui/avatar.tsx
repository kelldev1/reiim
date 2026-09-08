import React from 'react';

// Palette stable pour les avatars "initiales" (pas de photo).
const COLORS = [
  '#6366f1',
  '#ec4899',
  '#14b8a6',
  '#f59e0b',
  '#8b5cf6',
  '#ef4444',
  '#0ea5e9',
  '#84cc16',
];

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '?';

const colorFor = (key: string) => {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
};

export interface AvatarProps {
  name?: string;
  src?: string;
  size?: number;
  className?: string;
}

/** Photo de profil, ou cercle coloré avec les initiales en repli. */
export const Avatar: React.FC<AvatarProps> = ({ name = '', src, size = 36, className = '' }) => (
  <span
    className={`inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-semibold ${className}`}
    style={{
      width: size,
      height: size,
      fontSize: Math.round(size * 0.4),
      backgroundColor: src ? 'rgb(var(--color-fg) / 0.08)' : colorFor(name || '?'),
      color: '#ffffff',
    }}
    aria-label={name || undefined}
  >
    {src ? (
      <img src={src} alt="" className="h-full w-full object-cover" />
    ) : (
      <span>{initials(name)}</span>
    )}
  </span>
);

export interface AvatarGroupProps {
  people: { name?: string; src?: string }[];
  size?: number;
  limit?: number;
}

/** Avatars empilés avec un « +N » quand ça dépasse. */
export const AvatarGroup: React.FC<AvatarGroupProps> = ({ people, size = 28, limit = 4 }) => {
  const shown = people.length > limit ? people.slice(0, limit - 1) : people;
  const extra = people.length - shown.length;
  const ring: React.CSSProperties = {
    boxShadow: '0 0 0 2px rgb(var(--color-surface))',
  };
  return (
    <div className="flex items-center">
      {shown.map((p, i) => (
        <span
          key={i}
          className={i ? '-ml-2' : ''}
          style={{ ...ring, borderRadius: '9999px', zIndex: i }}
        >
          <Avatar name={p.name} src={p.src} size={size} />
        </span>
      ))}
      {extra > 0 && (
        <span
          className="-ml-2 flex items-center justify-center rounded-full font-semibold"
          style={{
            ...ring,
            width: size,
            height: size,
            fontSize: Math.round(size * 0.36),
            backgroundColor: 'rgb(var(--color-fg) / 0.1)',
            color: 'rgb(var(--color-fg))',
            zIndex: shown.length,
          }}
        >
          +{extra}
        </span>
      )}
    </div>
  );
};
