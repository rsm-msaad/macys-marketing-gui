import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const components: Components = {
  h1: ({ children }) => (
    <h1 className="mb-4 mt-8 font-serif text-3xl font-bold text-charcoal first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-3 mt-8 font-serif text-2xl font-bold text-charcoal">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 mt-6 font-serif text-xl font-semibold text-charcoal">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="mb-2 mt-4 text-base font-semibold text-charcoal">
      {children}
    </h4>
  ),
  p: ({ children }) => (
    <p className="mb-4 text-[15px] leading-relaxed text-charcoal/80">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="mb-4 ml-5 list-disc space-y-1 text-[15px] text-charcoal/80">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-4 ml-5 list-decimal space-y-1 text-[15px] text-charcoal/80">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="leading-relaxed">{children}</li>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mb-4 border-l-4 border-teal-600/30 pl-4 italic text-charcoal/60">
      {children}
    </blockquote>
  ),
  code: ({ children, className }) => {
    const isBlock = className?.includes("language-");
    if (isBlock) {
      return (
        <code className={`${className} text-sm`}>
          {children}
        </code>
      );
    }
    return (
      <code className="rounded bg-charcoal/5 px-1.5 py-0.5 text-[13px] font-mono text-teal-700">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="mb-4 overflow-x-auto rounded-lg bg-charcoal/[0.03] p-4 text-sm">
      {children}
    </pre>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-teal-600 underline decoration-teal-600/30 underline-offset-2 hover:text-teal-700 hover:decoration-teal-600/60"
      target={href?.startsWith("http") ? "_blank" : undefined}
      rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
    >
      {children}
    </a>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-charcoal">{children}</strong>
  ),
  hr: () => <hr className="my-8 border-charcoal/10" />,
  table: ({ children }) => (
    <div className="mb-6 overflow-x-auto rounded-lg border border-charcoal/10">
      <table className="w-full min-w-[640px] text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="border-b border-charcoal/10 bg-charcoal/[0.03]">
      {children}
    </thead>
  ),
  tbody: ({ children }) => (
    <tbody className="divide-y divide-charcoal/5">{children}</tbody>
  ),
  tr: ({ children }) => (
    <tr className="even:bg-charcoal/[0.015]">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-charcoal/60">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-4 py-3 text-[13px] leading-relaxed text-charcoal/75">
      {children}
    </td>
  ),
};

export function MarkdownContent({ content }: { content: string }) {
  return (
    <article className="mx-auto max-w-4xl px-6 py-10 lg:px-12">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </article>
  );
}
