"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BookOpen, ChevronRight, FileText, Menu, X } from "lucide-react";

export type SidebarEntry = {
  slug: string;
  title: string;
  section: string;
  available: boolean;
};

function groupBySection(entries: SidebarEntry[]) {
  const sections: { name: string; items: SidebarEntry[] }[] = [];
  const map = new Map<string, SidebarEntry[]>();
  for (const e of entries) {
    if (!map.has(e.section)) {
      map.set(e.section, []);
      sections.push({ name: e.section, items: map.get(e.section)! });
    }
    map.get(e.section)!.push(e);
  }
  return sections;
}

export function DocsSidebar({ entries }: { entries: SidebarEntry[] }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const sections = groupBySection(entries);

  const activeSlug =
    pathname === "/docs" ? "README" : pathname.replace("/docs/", "");

  const sidebar = (
    <nav className="flex flex-col gap-6 p-6">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-widest text-charcoal/40">
          Macy&apos;s AI Coworker
        </div>
        <div className="mt-0.5 font-serif text-lg font-bold text-charcoal">
          M4 Documentation
        </div>
      </div>

      {sections.map((sec) => (
        <div key={sec.name}>
          <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-charcoal/45">
            <BookOpen className="h-3 w-3" />
            {sec.name}
          </div>
          <ul className="space-y-0.5">
            {sec.items.map((item) => {
              const isActive = item.slug === activeSlug;
              const href =
                item.slug === "README" ? "/docs" : `/docs/${item.slug}`;

              if (!item.available) {
                return (
                  <li key={item.slug}>
                    <span className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-charcoal/30 cursor-not-allowed">
                      <FileText className="h-3.5 w-3.5" />
                      {item.title}
                      <span className="ml-auto text-[9px] font-medium uppercase tracking-wider text-charcoal/20">
                        Soon
                      </span>
                    </span>
                  </li>
                );
              }

              return (
                <li key={item.slug}>
                  <Link
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                      isActive
                        ? "bg-teal-50 font-medium text-teal-700"
                        : "text-charcoal/70 hover:bg-cream hover:text-charcoal"
                    }`}
                  >
                    <FileText className="h-3.5 w-3.5 flex-shrink-0" />
                    {item.title}
                    {isActive && (
                      <ChevronRight className="ml-auto h-3 w-3 text-teal-600" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <div className="mt-auto border-t border-charcoal/10 pt-4">
        <Link
          href="/"
          className="text-[11px] font-medium text-teal-600 hover:text-teal-700 hover:underline"
        >
          &larr; Back to App
        </Link>
      </div>
    </nav>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-50 rounded-md border border-charcoal/15 bg-white p-2 shadow-sm lg:hidden"
        aria-label="Open docs menu"
      >
        <Menu className="h-5 w-5 text-charcoal" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-charcoal/30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`fixed left-0 top-0 z-50 h-full w-72 transform bg-white shadow-xl transition-transform lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="absolute right-3 top-3 rounded-md p-1 text-charcoal/50 hover:text-charcoal"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
        {sidebar}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:block lg:w-72 lg:flex-shrink-0 lg:border-r lg:border-charcoal/10 lg:bg-white">
        <div className="sticky top-0 h-screen overflow-y-auto">{sidebar}</div>
      </aside>
    </>
  );
}
