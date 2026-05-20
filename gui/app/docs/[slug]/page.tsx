import { notFound } from "next/navigation";
import { getDocContent, getAllSlugs } from "@/lib/docs";
import { MarkdownContent } from "@/components/docs/MarkdownContent";

export function generateStaticParams() {
  return getAllSlugs()
    .filter((s) => s !== "README")
    .map((slug) => ({ slug }));
}

export default async function DocPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const content = getDocContent(slug);

  if (!content) {
    notFound();
  }

  return <MarkdownContent content={content} />;
}
