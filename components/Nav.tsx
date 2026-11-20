"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Today", icon: "M3 12l9-8 9 8M5 10v10h14V10" },
  { href: "/review", label: "Cards", icon: "M4 6h16v12H4zM8 10h8M8 14h5" },
  { href: "/questions", label: "Questions", icon: "M9 9a3 3 0 1 1 4 2.8c-.6.3-1 .9-1 1.5V14M12 17.5v.5M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z" },
  { href: "/tutor", label: "Tutor", icon: "M4 5h16v11H8l-4 4z" },
  { href: "/library", label: "Library", icon: "M5 4h4v16H5zM10 4h4v16h-4zM15 5l4 1-3 14-4-1" },
  { href: "/tools", label: "Tools", icon: "M4 20l6-6M14 4l6 6-8 8-6-6z" },
];

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export default function Nav() {
  const path = usePathname();
  if (path.startsWith("/login") || path.startsWith("/offline")) return null;
  const active = (h: string) => (h === "/" ? path === "/" : path.startsWith(h));
  return (
    <>
      <header className="hidden md:block border-b border-[var(--color-line)] bg-[var(--color-panel)]">
        <div className="mx-auto max-w-6xl px-5 h-14 flex items-center gap-6">
          <Link href="/" className="font-bold tracking-tight flex items-center gap-2">
            <img src="/icons/icon-192.png" alt="" width={26} height={26} className="rounded-md" />
            Cardiac CT
          </Link>
          <nav className="flex gap-1 text-sm">
            {ITEMS.map((i) => (
              <Link key={i.href} href={i.href}
                className={`px-3 py-1.5 rounded-lg font-medium ${active(i.href) ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]" : "text-[var(--color-muted)] hover:text-[var(--color-ink)]"}`}>
                {i.label}
              </Link>
            ))}
          </nav>
          <Link href="/settings" className={`ml-auto text-sm ${active("/settings") ? "text-[var(--color-accent)]" : "text-[var(--color-muted)]"}`}>Settings</Link>
        </div>
      </header>
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-[var(--color-line)] bg-[var(--color-panel)]/95 backdrop-blur"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="grid grid-cols-6">
          {ITEMS.map((i) => (
            <Link key={i.href} href={i.href}
              className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${active(i.href) ? "text-[var(--color-accent)]" : "text-[var(--color-muted)]"}`}>
              <Icon d={i.icon} />
              {i.label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
