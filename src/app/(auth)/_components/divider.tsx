export function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3" role="presentation">
      <span className="bg-line h-px flex-1" />
      <span className="text-text-dim text-[11px] tracking-wide uppercase">
        {label}
      </span>
      <span className="bg-line h-px flex-1" />
    </div>
  );
}
