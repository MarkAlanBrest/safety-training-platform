"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode } from "react";
import {
  BookOpen,
  ExternalLink,
  LogOut,
  Mic,
  Plus,
  ShieldCheck,
} from "lucide-react";

type Props = {
  children: ReactNode;
  title?: string;
  eyebrow?: string;
  actions?: ReactNode;
};

const navItems = [
  { href: "/admin/courses", label: "Training programs", icon: BookOpen },
  { href: "/admin/classroom/new", label: "New video course", icon: Plus },
  { href: "/admin/slide-narration", label: "Slide narration", icon: Mic },
];

function NavLink({
  item,
  currentPath,
  compact = false,
}: {
  item: (typeof navItems)[number];
  currentPath: string;
  compact?: boolean;
}) {
  const Icon = item.icon;
  const active =
    currentPath === item.href ||
    (item.href === "/admin/courses" && currentPath.startsWith("/admin/courses/"));

  return (
    <Link
      href={item.href}
      className={`flex shrink-0 items-center gap-3 rounded-xl font-semibold transition ${
        compact ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm"
      } ${
        active
          ? "bg-white text-[#10283f]"
          : "text-slate-300 hover:bg-white/10 hover:text-white"
      }`}
    >
      <Icon size={compact ? 16 : 18} />
      <span className={compact ? "whitespace-nowrap" : undefined}>{item.label}</span>
    </Link>
  );
}

export default function AdminShell({
  children,
  title = "Training administration",
  eyebrow = "Course operations",
  actions,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const currentPath = pathname || "";

  async function logout() {
    await fetch("/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <div className="admin-shell">
      <div className="admin-shell-inner flex min-h-screen w-full min-w-0 bg-[#edf1f2] text-[#17202b]">
        <aside className="hidden w-56 shrink-0 flex-col bg-[#10283f] text-white xl:flex">
          <div className="border-b border-white/10 px-5 py-6">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#f2b744] text-[#10283f]">
                <ShieldCheck size={21} />
              </span>
              <div className="min-w-0">
                <p className="truncate font-serif text-lg font-semibold">Training Studio</p>
                <p className="text-xs text-slate-400">Administration</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 space-y-1 p-3">
            {navItems.map((item) => (
              <NavLink key={item.href} item={item} currentPath={currentPath} />
            ))}
          </nav>

          <div className="space-y-2 border-t border-white/10 p-3">
            <Link
              href="/"
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white"
            >
              <ExternalLink size={17} /> View learner site
            </Link>
            <button
              onClick={logout}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white"
            >
              <LogOut size={17} /> Sign out
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="border-b border-white/10 bg-[#10283f] xl:hidden">
            <div className="flex items-center gap-3 px-4 py-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#f2b744] text-[#10283f]">
                <ShieldCheck size={18} />
              </span>
              <p className="min-w-0 truncate font-serif text-base font-semibold text-white">
                Training Studio
              </p>
            </div>
            <nav className="flex gap-1 overflow-x-auto px-3 pb-3">
              {navItems.map((item) => (
                <NavLink key={item.href} item={item} currentPath={currentPath} compact />
              ))}
            </nav>
          </div>

          <header className="border-b border-[#10283f]/10 bg-white">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[.18em] text-[#a06e16]">
                  {eyebrow}
                </p>
                <h1 className="mt-1 truncate font-serif text-2xl font-semibold text-[#10283f] sm:text-3xl">
                  {title}
                </h1>
              </div>
              {actions && (
                <div className="flex max-w-full shrink-0 flex-wrap items-center gap-3">
                  {actions}
                </div>
              )}
            </div>
          </header>

          <main className="min-w-0 flex-1 px-4 py-6 sm:px-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
