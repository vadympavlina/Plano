import { cn } from '@/lib/utils/cn';

const QUOTES = [
  ['Progress,', 'not perfection.'],
  ['Small steps,', 'big results.'],
  ['Focus on', 'what matters.'],
  ['One thing', 'at a time.'],
];

/** A calm, decorative card with a rotating daily line and a mountain silhouette. */
export function MotivationCard({ className }: { className?: string }) {
  const day = Math.floor(Date.now() / 86_400_000);
  const [a, b] = QUOTES[day % QUOTES.length];
  return (
    <div className={cn('relative min-h-[260px] flex-col justify-between overflow-hidden rounded-card bg-[#141821] p-6 text-white', className)}>
      <svg className="absolute inset-x-0 bottom-0 h-[70%] w-full" viewBox="0 0 300 220" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#E8A26A" stopOpacity="0.32" />
            <stop offset="1" stopColor="#141821" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="300" height="120" fill="url(#sky)" />
        <path d="M0 150 L60 95 L95 120 L150 60 L205 115 L240 90 L300 135 L300 220 L0 220 Z" fill="#232a37" />
        <path d="M0 175 L45 140 L90 165 L140 120 L190 160 L235 135 L300 170 L300 220 L0 220 Z" fill="#1b212c" />
        <path d="M0 200 L70 175 L130 195 L200 170 L300 198 L300 220 L0 220 Z" fill="#141821" />
      </svg>
      <p className="relative text-[17px] font-medium leading-snug">
        {a}
        <br />
        {b}
      </p>
      <p className="relative text-xs leading-relaxed text-white/60">A little progress each day adds up to big results.</p>
    </div>
  );
}
