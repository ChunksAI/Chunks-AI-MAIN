'use client';

/**
 * components/study/chat/MarkdownRenderer.tsx
 *
 * Production-ready Markdown renderer for AI chat messages.
 *
 * Features:
 *  - react-markdown with remark-math, rehype-katex, rehype-highlight, rehype-sanitize
 *  - Custom renderers using CSS variables only (no Tailwind)
 *  - Code blocks with copy-to-clipboard button
 *  - Inline math + block math (KaTeX)
 *  - Tables with alternating rows
 *  - Wrapped in React.memo for performance
 */

import React, { memo, useCallback, useState } from 'react';
import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import type { Components } from 'react-markdown';

// ─── Sanitize schema — extend default to allow KaTeX + highlight classes ─────

const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    // Allow class names on <code> and <span> for syntax highlighting and KaTeX
    code: [...(defaultSchema.attributes?.code ?? []), 'className'],
    span: [...(defaultSchema.attributes?.span ?? []), 'className', 'style'],
    div: [...(defaultSchema.attributes?.div ?? []), 'className', 'style'],
    math: ['className', 'xmlns'],
    svg: ['className', 'xmlns', 'viewBox', 'width', 'height', 'preserveAspectRatio'],
    path: ['d', 'fill', 'stroke', 'strokeWidth', 'className'],
    line: ['x1', 'x2', 'y1', 'y2', 'className'],
    // Allow KaTeX's aria attributes for accessibility
    '*': [...((defaultSchema.attributes?.['*'] as string[] | undefined) ?? []), 'aria-hidden', 'aria-label', 'style'],
  },
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    // KaTeX output tags
    'math', 'annotation', 'semantics',
    'mrow', 'mi', 'mn', 'mo', 'msup', 'msub', 'mfrac', 'msubsup',
    'munder', 'mover', 'munderover', 'msqrt', 'mroot', 'mtext',
    'mspace', 'mtable', 'mtr', 'mtd', 'mfenced', 'mpadded',
    // KaTeX renders inline SVG for some symbols
    'svg', 'path', 'line', 'g', 'rect', 'circle',
    // highlight.js wraps tokens in <span>
    'span',
  ],
};

// ─── Copy-to-clipboard button ─────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);

  return (
    <button
      className="md-copy-btn"
      onClick={handleCopy}
      aria-label={copied ? 'Copied' : 'Copy code'}
    >
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  );
}

// ─── Custom element renderers ─────────────────────────────────────────────────

const components: Components = {
  // Paragraphs
  p({ children }) {
    return <p className="md-p">{children}</p>;
  },

  // Headings
  h1({ children }) {
    return <h1 className="md-h1">{children}</h1>;
  },
  h2({ children }) {
    return <h2 className="md-h2">{children}</h2>;
  },
  h3({ children }) {
    return <h3 className="md-h3">{children}</h3>;
  },

  // Lists
  ul({ children }) {
    return <ul className="md-ul">{children}</ul>;
  },
  ol({ children }) {
    return <ol className="md-ol">{children}</ol>;
  },
  li({ children }) {
    return <li className="md-li">{children}</li>;
  },

  // Blockquote
  blockquote({ children }) {
    return <blockquote className="md-blockquote">{children}</blockquote>;
  },

  // Code — both inline and block
  code({ className, children, ...props }) {
    const isBlock = 'node' in props && (props as { node?: { type?: string; tagName?: string } }).node?.tagName !== 'code';
    const language = className?.replace('language-', '') ?? '';
    const codeText = String(children).replace(/\n$/, '');

    // Inline code: no language class → render as pill
    if (!className) {
      return <code className="md-code-inline">{children}</code>;
    }

    // Block code: has language class → wrap in <pre> with copy button
    return (
      <div className="md-code-block">
        <div className="md-code-header">
          {language && <span className="md-code-lang">{language}</span>}
          <CopyButton text={codeText} />
        </div>
        <pre className="md-pre">
          <code className={className} {...props}>{children}</code>
        </pre>
      </div>
    );
  },

  // Pre — suppressed since our code renderer above wraps its own <pre>
  pre({ children }) {
    // When react-markdown renders a fenced code block it nests <pre><code>.
    // Our code() renderer handles the wrapper, so just pass through here.
    return <>{children}</>;
  },

  // Display-math blocks produced by rehype-katex / remark-math
  div({ className, children, ...props }) {
    if (className?.includes('math-display') || className?.includes('katex-display')) {
      return (
        <div className="md-math-display">
          <div className={className} {...props}>{children}</div>
        </div>
      );
    }
    return <div className={className} {...props}>{children}</div>;
  },

  // Inline-math spans produced by rehype-katex
  span({ className, children, ...props }) {
    if (className?.includes('katex') && !className?.includes('katex-display')) {
      return (
        <span
          className={className}
          style={{ background: 'var(--surface2)', borderRadius: 4, padding: '1px 3px', fontSize: 13.5 }}
          {...props}
        >
          {children}
        </span>
      );
    }
    return <span className={className} {...props}>{children}</span>;
  },

  // Tables
  table({ children }) {
    return (
      <div className="md-table-wrap">
        <table className="md-table">{children}</table>
      </div>
    );
  },
  thead({ children }) {
    return <thead className="md-thead">{children}</thead>;
  },
  tbody({ children }) {
    return <tbody className="md-tbody">{children}</tbody>;
  },
  tr({ children }) {
    return <tr className="md-tr">{children}</tr>;
  },
  td({ children }) {
    return <td className="md-td">{children}</td>;
  },
  th({ children }) {
    return <th className="md-th">{children}</th>;
  },
};

// ─── MarkdownRenderer ─────────────────────────────────────────────────────────

interface MarkdownRendererProps {
  content: string;
}

/** Converts bracket-style LaTeX notation to dollar notation so rehype-katex renders it. */
function preprocessLatex(text: string): string {
  return text
    .replace(/\\\[/g, '$$')
    .replace(/\\\]/g, '$$')
    .replace(/\\\(/g, '$')
    .replace(/\\\)/g, '$');
}

/**
 * Single preprocessing pipeline for all content transformations applied
 * before the string is handed to <Markdown>.
 *
 * Stages (in order):
 *  1. LaTeX bracket-to-dollar normalisation  → preprocessLatex
 *
 * Add new text-level transforms here so callers never need to know about
 * individual preprocessing steps.
 */
function preprocessContent(text: string): string {
  return preprocessLatex(text);
}

function MarkdownRenderer({ content }: MarkdownRendererProps) {
  if (!content || typeof content !== 'string' || content.trim() === '') {
    return null;
  }

  return (
    <div className="md-root">
      <Markdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[
          [rehypeKatex, { trust: true, strict: false }],
          [rehypeSanitize, sanitizeSchema],
          rehypeHighlight,
        ]}
        components={components}
      >
        {preprocessContent(content)}
      </Markdown>
    </div>
  );
}

export default memo(MarkdownRenderer);
