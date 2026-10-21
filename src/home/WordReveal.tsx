import { cx } from '@/ui/primitives';

/**
 * A sentence whose words light up one after the other as `reveal` goes from
 * 0 to 1 (the reader's scroll); dim words stay readable. `reveal` 1 shows it
 * all (reduced motion, phones).
 */
export function WordReveal({ text, reveal, light, className }: { text: string; reveal: number; light: boolean; className?: string }) {
  const words = text.split(/\s+/).filter(Boolean);
  const lit = Math.round(reveal * words.length);
  return (
    <p className={className}>
      {words.map((w, i) => (
        <span
          key={i}
          data-lit={i < lit}
          className={cx('transition-colors duration-300 ease-out', i < lit ? (light ? 'text-[#1d1d1f]' : 'text-white') : light ? 'text-[#1d1d1f]/30' : 'text-white/30')}
        >
          {w}{' '}
        </span>
      ))}
    </p>
  );
}
