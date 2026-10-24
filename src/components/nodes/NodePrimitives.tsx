import type { ReactNode } from 'react';

/* ========================================================================== *
 * Shared visual chrome for the custom PON nodes.
 * ========================================================================== */

interface LedProps {
  color: string;
  pulse?: boolean;
  size?: number;
}

export function Led({ color, pulse = false, size = 9 }: LedProps) {
  return (
    <span
      className={`inline-block shrink-0 rounded-full ${pulse ? 'animate-pulse' : ''}`}
      style={{
        width: size,
        height: size,
        background: color,
        boxShadow: `0 0 ${size + 4}px ${color}, 0 0 2px ${color}`,
      }}
    />
  );
}

interface StatProps {
  label: string;
  value: ReactNode;
  tone?: string;
}

export function Stat({ label, value, tone = 'text-noc-200' }: StatProps) {
  return (
    <div className="metric flex flex-col gap-1">
      <span className="text-caption font-medium uppercase tracking-[0.1em] text-noc-400">{label}</span>
      <span className={`font-mono text-body font-semibold leading-tight ${tone}`}>{value}</span>
    </div>
  );
}

interface BadgeProps {
  children: ReactNode;
  className?: string;
}

export function Badge({ children, className = 'bg-noc-700/70 text-noc-300 border-noc-600' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-caption font-semibold uppercase tracking-wide ${className}`}
    >
      {children}
    </span>
  );
}
