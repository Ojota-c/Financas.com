"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils/cn";

import { NAV, rotaAtiva } from "./nav-items";

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegação principal" className="grid gap-0.5">
      {NAV.map((item) => {
        const Icon = item.icon;
        const ativo = rotaAtiva(pathname, item.href);

        const classes = cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-(--dur-fast)",
          ativo
            ? "bg-surface-2 text-text"
            : "text-text-mid hover:bg-surface-2/60 hover:text-text",
        );

        if (!item.disponivel) {
          return (
            <span
              key={item.href}
              aria-disabled
              className={cn(
                classes,
                "text-text-dim hover:text-text-dim cursor-not-allowed hover:bg-transparent",
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="flex-1">{item.label}</span>
              <span className="border-line text-text-dim rounded-full border px-1.5 py-px text-[10px]">
                em breve
              </span>
            </span>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={ativo ? "page" : undefined}
            className={classes}
          >
            <Icon
              className={cn("size-4 shrink-0", ativo && "text-brand")}
              aria-hidden
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
