import { cn } from "@/lib/utils/cn";

export function AuthCard({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "glass rounded-xl p-7 shadow-2xl shadow-black/40 sm:p-8",
        className,
      )}
    >
      <h1 className="text-2xl font-semibold tracking-[-0.02em]">{title}</h1>
      <p className="text-text-mid mt-2 text-sm">{subtitle}</p>
      <div className="mt-7">{children}</div>
    </section>
  );
}
