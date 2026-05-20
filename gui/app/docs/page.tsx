import { getDocContent } from "@/lib/docs";
import { MarkdownContent } from "@/components/docs/MarkdownContent";

export default function DocsPage() {
  const content = getDocContent("README");

  if (!content) {
    return (
      <div className="flex items-center justify-center py-20 text-charcoal/40">
        <p className="text-lg">Overview document coming soon.</p>
      </div>
    );
  }

  return <MarkdownContent content={content} />;
}
