// Minimal stroke icons, currentColor, sized by `size`. No emoji anywhere.

interface IconProps {
  size?: number;
  className?: string;
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export function Check({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function Dash({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d="M5 12h14" />
    </svg>
  );
}

export function ArrowUpRight({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d="M7 17 17 7M8 7h9v9" />
    </svg>
  );
}

export function Upload({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d="M12 16V4M7 9l5-5 5 5" />
      <path d="M5 20h14" />
    </svg>
  );
}

export function Link({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d="M10 13a5 5 0 0 0 7 0l1-1a5 5 0 0 0-7-7l-1 1" />
      <path d="M14 11a5 5 0 0 0-7 0l-1 1a5 5 0 0 0 7 7l1-1" />
    </svg>
  );
}

export function Plus({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function Close({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function Chevron({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function Play({ size = 15, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d="M7 5v14l11-7z" />
    </svg>
  );
}

export function CircleOpen({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <circle cx="12" cy="12" r="8" />
    </svg>
  );
}
