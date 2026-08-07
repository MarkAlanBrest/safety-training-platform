"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode } from "react";
import {
  BookOpen,
  ExternalLink,
  LogOut,
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
  { href: "/admin/classroom/new", label: "New PowerPoint course", icon: Plus },
];

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
    <div className="min-h-screen bg-[#edf1f2] text-[#17202b]">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 flex-col bg-[#10283f] text-white lg:flex">
          <div className="border-b border-white/10 px-6 py-7">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#f2b744] text-[#10283f]">
                <ShieldCheck size={23} />
              </span>
              <div>
                <p className="font-serif text-xl font-semibold">Training Studio</p>
                <p className="text-xs text-slate-400">Administration</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 space-y-1 p-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active =
                currentPath === item.href ||
                (item.href === "/admin/courses" &&
                  currentPath.startsWith("/admin/courses/"));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                    active
                      ? "bg-white text-[#10283f]"
                      : "text-slate-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="space-y-2 border-t border-white/10 p-4">
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

        <div className="min-w-0 flex-1">
          <header className="border-b border-[#10283f]/10 bg-white">
            <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4 px-5 py-6 sm:px-8">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[.18em] text-[#a06e16]">
                  {eyebrow}
                </p>
                <h1 className="mt-1 font-serif text-3xl font-semibold text-[#10283f]">
                  {title}
                </h1>
              </div>
              {actions && <div className="flex items-center gap-3">{actions}</div>}
            </div>
          </header>

          <main className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
