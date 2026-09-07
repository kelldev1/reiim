import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

const fg = 'rgb(var(--color-fg))';
const line = 'rgb(var(--color-fg) / 0.14)';
const soft = 'rgb(var(--color-fg) / 0.05)';

/**
 * Rendu Markdown + maths (KaTeX) pour les réponses de l'assistant.
 * Typographie compacte, adaptée à une carte étroite, thème clair / sombre.
 */
export const Markdown: React.FC<{ children: string }> = ({ children }) => (
  <div className="reiim-md text-sm leading-relaxed" style={{ color: fg }}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        h1: ({ children }) => (
          <h1 className="mb-2 mt-1 text-base font-bold" style={{ color: fg }}>
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="mb-1.5 mt-4 text-sm font-bold uppercase tracking-wide">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="mb-1 mt-3 text-sm font-semibold">{children}</h3>
        ),
        p: ({ children }) => <p className="my-2">{children}</p>,
        ul: ({ children }) => (
          <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>
        ),
        li: ({ children }) => <li className="pl-1">{children}</li>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        a: ({ children, href }) => (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            {children}
          </a>
        ),
        blockquote: ({ children }) => (
          <blockquote
            className="my-2 border-l-2 pl-3 italic"
            style={{ borderColor: line }}
          >
            {children}
          </blockquote>
        ),
        hr: () => <hr className="my-3" style={{ borderColor: line }} />,
        code: ({ className, children }) => {
          const block = (className ?? '').includes('language-');
          if (block) {
            return (
              <code className="block whitespace-pre font-mono text-[13px]">
                {children}
              </code>
            );
          }
          return (
            <code
              className="rounded px-1 py-0.5 font-mono text-[0.85em]"
              style={{ backgroundColor: soft }}
            >
              {children}
            </code>
          );
        },
        pre: ({ children }) => (
          <pre
            className="my-2 overflow-x-auto rounded-lg p-3"
            style={{ backgroundColor: soft }}
          >
            {children}
          </pre>
        ),
        table: ({ children }) => (
          <div className="my-2 overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th
            className="border px-2 py-1 text-left font-semibold"
            style={{ borderColor: line }}
          >
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border px-2 py-1 align-top" style={{ borderColor: line }}>
            {children}
          </td>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  </div>
);
