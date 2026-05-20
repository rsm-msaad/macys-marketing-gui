import { getDocEntries } from "@/lib/docs";
import { DocsSidebar, type SidebarEntry } from "@/components/docs/DocsSidebar";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const entries = getDocEntries();

  const sidebarEntries: SidebarEntry[] = entries.map((e) => ({
    slug: e.slug,
    title: e.title,
    section: e.section,
    available: e.file !== null,
  }));

  return (
    <div className="flex min-h-screen bg-cream">
      <DocsSidebar entries={sidebarEntries} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
