import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { resolvePublicDocLink } from "@/features/docs/read-public-doc";

interface PublicMarkdownContentProps {
  markdown: string;
  sourcePath: string;
}

export function PublicMarkdownContent({
  markdown,
  sourcePath,
}: PublicMarkdownContentProps) {
  return (
    <div className="max-w-none text-[15px] leading-7 text-zinc-700 dark:text-zinc-300">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-6 text-4xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-4 mt-10 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-3 mt-8 text-xl font-semibold text-zinc-950 dark:text-zinc-50">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="mb-2 mt-6 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              {children}
            </h4>
          ),
          p: ({ children }) => <p className="my-4">{children}</p>,
          ul: ({ children }) => (
            <ul className="my-4 list-disc space-y-2 pl-6 marker:text-zinc-500 dark:marker:text-zinc-400">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-4 list-decimal space-y-2 pl-6 marker:text-zinc-500 dark:marker:text-zinc-400">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="pl-1">{children}</li>,
          hr: () => (
            <hr className="my-8 border-zinc-200 dark:border-zinc-800" />
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-6 border-l-4 border-zinc-300 pl-4 italic text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="my-6 overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
              <table className="min-w-full border-collapse text-sm">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-zinc-100 dark:bg-zinc-900">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="border-b border-r border-zinc-200 px-4 py-3 text-left font-semibold text-zinc-950 last:border-r-0 dark:border-zinc-800 dark:text-zinc-50">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-r border-t border-zinc-200 px-4 py-3 align-top last:border-r-0 dark:border-zinc-800">
              {children}
            </td>
          ),
          pre: ({ children }) => (
            <pre className="my-6 overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-4 text-sm leading-6 text-zinc-100">
              {children}
            </pre>
          ),
          code: ({ children, className }) => {
            const isBlock = Boolean(className);

            if (isBlock) {
              return <code className={className}>{children}</code>;
            }

            return (
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-[0.9em] text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
                {children}
              </code>
            );
          },
          a: ({ href = "", children, ...props }) => {
            const resolvedHref = resolvePublicDocLink(sourcePath, href);

            if (!resolvedHref) {
              return (
                <span className="text-zinc-400 line-through" {...props}>
                  {children}
                </span>
              );
            }

            if (
              resolvedHref.startsWith("http://") ||
              resolvedHref.startsWith("https://") ||
              resolvedHref.startsWith("mailto:") ||
              resolvedHref.startsWith("#")
            ) {
              return (
                <a
                  href={resolvedHref}
                  {...props}
                  className="font-medium text-sky-600 underline decoration-sky-300 underline-offset-4 transition hover:text-sky-500 dark:text-sky-400 dark:decoration-sky-700 dark:hover:text-sky-300"
                  target={resolvedHref.startsWith("#") ? undefined : "_blank"}
                  rel={resolvedHref.startsWith("#") ? undefined : "noreferrer"}
                >
                  {children}
                </a>
              );
            }

            return (
              <Link
                href={resolvedHref}
                {...props}
                className="font-medium text-sky-600 underline decoration-sky-300 underline-offset-4 transition hover:text-sky-500 dark:text-sky-400 dark:decoration-sky-700 dark:hover:text-sky-300"
              >
                {children}
              </Link>
            );
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
