export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={className}>
      sunb
      <span className="relative inline-block">
        <span className="invisible">i</span>
        <span className="absolute inset-0" aria-hidden="true">
          ı
        </span>
        <span
          className="absolute left-1/2 -translate-x-1/2 top-[0.08em] block w-[0.22em] h-[0.22em] rounded-full bg-gold"
          aria-hidden="true"
        />
      </span>
      rd
    </span>
  );
}
