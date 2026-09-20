import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const markdownComponents = {
  p({ children }) {
    return <p className="my-0 whitespace-pre-wrap break-words leading-7">{children}</p>;
  },
  a({ href, children }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="break-all text-blue underline underline-offset-2"
      >
        {children}
      </a>
    );
  },
  code({ inline, className, children }) {
    const language = className?.replace('language-', '') || '';

    if (inline) {
      return (
        <code className="rounded bg-black/5 px-1 py-0.5 font-mono text-[0.92em]">
          {children}
        </code>
      );
    }

    return (
      <div className="my-3 overflow-hidden rounded-xl border border-[#1e293b] bg-[#0f172a]">
        {language && (
          <div className="border-b border-white/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-white/55">
            {language}
          </div>
        )}
        <pre className="overflow-x-auto p-4 text-sm leading-relaxed text-[#e5e7eb]">
          <code>{children}</code>
        </pre>
      </div>
    );
  },
  blockquote({ children }) {
    return (
      <blockquote className="my-3 border-l-4 border-blue/35 bg-blue-soft/35 px-4 py-2 text-text-2">
        {children}
      </blockquote>
    );
  },
  ul({ children }) {
    return <ul className="my-0 list-disc space-y-1 pl-5">{children}</ul>;
  },
  ol({ children }) {
    return <ol className="my-0 list-decimal space-y-1 pl-5">{children}</ol>;
  },
  li({ children }) {
    return <li className="leading-7">{children}</li>;
  },
  h1({ children }) {
    return <h1 className="m-0 text-lg font-bold leading-7">{children}</h1>;
  },
  h2({ children }) {
    return <h2 className="m-0 text-base font-bold leading-7">{children}</h2>;
  },
  h3({ children }) {
    return <h3 className="m-0 text-sm font-semibold leading-7">{children}</h3>;
  },
  hr() {
    return <hr className="my-3 border-0 border-t border-line-soft" />;
  },
  table({ children }) {
    return (
      <div className="my-3 overflow-x-auto rounded-xl border border-line-soft">
        <table className="min-w-full border-collapse text-left text-sm">{children}</table>
      </div>
    );
  },
  thead({ children }) {
    return <thead className="bg-[#f8fafc]">{children}</thead>;
  },
  th({ children }) {
    return <th className="border-b border-line-soft px-3 py-2 font-semibold text-text">{children}</th>;
  },
  td({ children }) {
    return <td className="border-b border-line-soft px-3 py-2 align-top text-text-2 last:border-b-0">{children}</td>;
  },
};

export default function RichMessageContent({ content, isUser = false }) {
  if (isUser) {
    return <p className="my-0 whitespace-pre-wrap break-words">{content}</p>;
  }

  return (
    <div className="space-y-3 overflow-hidden [word-break:break-word]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
