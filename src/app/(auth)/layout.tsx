import Link from "next/link";

import { Logo } from "@/components/brand/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="aurora flex min-h-dvh flex-col">
      <header className="px-6 pt-8 sm:px-10">
        <Link href="/" className="rounded-sm focus-visible:outline-none">
          <Logo />
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-[26rem]">{children}</div>
      </main>

      <footer className="text-text-dim px-6 pb-8 text-center text-xs sm:px-10">
        Seus dados ficam isolados por workspace, com Row Level Security no
        banco.
      </footer>
    </div>
  );
}
