import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ClipboardDocumentIcon, ClipboardDocumentCheckIcon } from '@heroicons/react/24/outline';
import styled from 'styled-components';
import typescript from 'react-syntax-highlighter/dist/cjs/languages/prism/typescript';
import javascript from 'react-syntax-highlighter/dist/cjs/languages/prism/javascript';
import json from 'react-syntax-highlighter/dist/cjs/languages/prism/json';
import python from 'react-syntax-highlighter/dist/cjs/languages/prism/python';
import { FaClipboard, FaClipboardCheck } from 'react-icons/fa';
import type { Components } from 'react-markdown';
import { CodeProps } from 'react-markdown/lib/ast-to-react';
import { ReactMarkdownProps } from 'react-markdown/lib/complex-types';

// Import Prism styles (dark theme)
import 'prismjs/themes/prism-tomorrow.css';
// Import additional languages
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-solidity';

SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('python', python);

const Container = styled.div`
  pre {
    border-radius: 5px;
    position: relative;
    padding: 20px;
  }

  p code {
    background-color: rgba(0, 0, 0, 0.1);
    padding: 2px 4px;
    border-radius: 3px;
  }

  ul,
  ol {
    margin-left: 20px;
  }

  blockquote {
    margin-left: 0;
    padding-left: 10px;
    border-left: 4px solid #ddd;
    color: #777;
  }

  a {
    color: #0066cc;
    text-decoration: none;
  }

  a:hover {
    text-decoration: underline;
  }

  h1 {
    font-size: 1.7rem;
    margin-top: 1.5rem;
    margin-bottom: 1rem;
  }

  h2 {
    font-size: 1.5rem;
    margin-top: 1.3rem;
    margin-bottom: 0.8rem;
  }

  h3 {
    font-size: 1.3rem;
    margin-top: 1.1rem;
    margin-bottom: 0.6rem;
  }

  h4 {
    font-size: 1.1rem;
    margin-top: 1rem;
    margin-bottom: 0.4rem;
  }
`;

interface StructureViewProps {
  markdown: string;
}

const CodeBlock = ({ node, inline, className, children, ...props }: CodeProps) => {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  const code = String(children).replace(/\n$/, '');

  const copyToClipboard = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (inline) {
    return <code className={className} {...props}>{children}</code>;
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={copyToClipboard}
        style={{
          position: 'absolute',
          top: '5px',
          right: '5px',
          background: 'transparent',
          border: 'none',
          color: '#ccc',
          cursor: 'pointer',
          zIndex: 10,
        }}
      >
        {copied ? <FaClipboardCheck size={18} /> : <FaClipboard size={18} />}
      </button>
      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus}
        customStyle={{ padding: '35px 15px 15px 15px' }}
        {...props}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
};

type HeadingProps = {
  level: number;
  children?: React.ReactNode;
};

type LinkComponentProps = {
  href?: string;
  children?: React.ReactNode;
};

type GenericComponentProps = {
  children?: React.ReactNode;
};

export default function StructureView({ markdown }: StructureViewProps) {
  const components: Components = {
    code: CodeBlock,
    h1: ({ children }: GenericComponentProps) => <h1>{children}</h1>,
    h2: ({ children }: GenericComponentProps) => <h2>{children}</h2>,
    h3: ({ children }: GenericComponentProps) => <h3>{children}</h3>,
    h4: ({ children }: GenericComponentProps) => <h4>{children}</h4>,
    p: ({ children }: GenericComponentProps) => <p>{children}</p>,
    ul: ({ children }: GenericComponentProps) => <ul>{children}</ul>,
    ol: ({ children }: GenericComponentProps) => <ol>{children}</ol>,
    li: ({ children }: GenericComponentProps) => <li>{children}</li>,
    a: ({ href, children }: LinkComponentProps) => (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    ),
    blockquote: ({ children }: GenericComponentProps) => <blockquote>{children}</blockquote>,
  };

  return (
    <Container>
      <ReactMarkdown components={components}>{markdown}</ReactMarkdown>
    </Container>
  );
} 