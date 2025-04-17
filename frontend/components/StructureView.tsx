import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ClipboardDocumentIcon, ClipboardDocumentCheckIcon } from '@heroicons/react/24/outline';

// Importar estilos do Prism (tema dark)
// Você precisará adicionar isso ao seu projeto ou importar via NPM
import 'prismjs/themes/prism-tomorrow.css';
// Importar linguagens adicionais
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-solidity';

interface StructureViewProps {
  markdown: string;
  content?: string; // Adding backward compatibility
}

interface CodeBlockProps {
  node?: any;
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ node, inline, className, children, ...props }) => {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  const code = String(children).replace(/\n$/, '');

  const copyToClipboard = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!inline && match) {
    return (
      <div className="relative group">
        <div className="absolute right-2 top-2">
          <button 
            onClick={copyToClipboard}
            className="p-1 rounded bg-gray-700 text-white hover:bg-gray-600 transition-colors"
            title="Copy code"
          >
            {copied ? (
              <ClipboardDocumentCheckIcon className="w-4 h-4 text-green-400" />
            ) : (
              <ClipboardDocumentIcon className="w-4 h-4" />
            )}
          </button>
        </div>
        <SyntaxHighlighter
          language={language}
          style={vscDarkPlus}
          customStyle={{ marginTop: 0 }}
          {...props}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    );
  }

  return (
    <code className={className} {...props}>
      {children}
    </code>
  );
};

const StructureView: React.FC<StructureViewProps> = ({ markdown, content }) => {
  // Support backward compatibility with content prop
  const markdownContent = markdown || content;
  
  if (!markdownContent) {
    return <div className="p-4 text-gray-300">No content to display</div>;
  }

  return (
    <div className="p-4 overflow-auto">
      <ReactMarkdown
        components={{
          h1: ({ children, ...props }: React.PropsWithChildren<{}>) => <h1 className="text-2xl font-bold mb-4 mt-6 text-white" {...props}>{children}</h1>,
          h2: ({ children, ...props }: React.PropsWithChildren<{}>) => <h2 className="text-xl font-bold mb-3 mt-5 text-white" {...props}>{children}</h2>,
          h3: ({ children, ...props }: React.PropsWithChildren<{}>) => <h3 className="text-lg font-bold mb-2 mt-4 text-white" {...props}>{children}</h3>,
          h4: ({ children, ...props }: React.PropsWithChildren<{}>) => <h4 className="text-base font-bold mb-2 mt-3 text-white" {...props}>{children}</h4>,
          p: ({ children, ...props }: React.PropsWithChildren<{}>) => <p className="mb-4 text-gray-200 leading-relaxed" {...props}>{children}</p>,
          ul: ({ children, ...props }: React.PropsWithChildren<{}>) => <ul className="list-disc pl-5 mb-4 text-gray-200" {...props}>{children}</ul>,
          ol: ({ children, ...props }: React.PropsWithChildren<{}>) => <ol className="list-decimal pl-5 mb-4 text-gray-200" {...props}>{children}</ol>,
          li: ({ children, ...props }: React.PropsWithChildren<{}>) => <li className="mb-1 text-gray-200" {...props}>{children}</li>,
          a: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
            <a 
              href={href} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-blue-400 hover:underline" 
              {...props}
            >
              {children}
            </a>
          ),
          blockquote: ({ children, ...props }: React.PropsWithChildren<{}>) => (
            <blockquote 
              className="pl-4 italic border-l-4 border-gray-400 text-gray-300 mb-4" 
              {...props}
            >
              {children}
            </blockquote>
          ),
          code: CodeBlock,
        }}
      >
        {markdownContent}
      </ReactMarkdown>
    </div>
  );
};

export default StructureView; 