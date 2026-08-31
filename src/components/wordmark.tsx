export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`text-[1.32rem] font-extrabold tracking-[-0.035em] text-ink ${className}`}
    >
      OA<span className="text-brand-500">Base</span>
    </span>
  );
}
