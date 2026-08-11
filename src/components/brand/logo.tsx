import { cn } from "@/lib/utils/cn";

/**
 * Marca do app. O "A" fica no gradiente ciano→violeta; o restante do wordmark
 * é texto normal — se tudo brilhasse, nada brilharia (§7).
 */
export function Logo({
  className,
  showWordmark = true,
}: {
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        aria-hidden
        className="brand-gradient text-bg grid size-8 place-items-center rounded-[var(--r-sm)] font-mono text-base font-semibold"
      >
        A
      </span>
      {showWordmark && (
        <span className="text-lg font-semibold tracking-[-0.02em]">Aurum</span>
      )}
      <span className="sr-only">Aurum</span>
    </span>
  );
}
