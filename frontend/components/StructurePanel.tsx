import React, { useState, useEffect } from 'react';
import { 
  DocumentArrowDownIcon, 
  DocumentTextIcon, 
  LinkIcon, 
  BeakerIcon,
  ClipboardDocumentIcon,
  ClipboardDocumentCheckIcon,
  FolderIcon,
  DocumentIcon
} from '@heroicons/react/24/outline';
import SyntaxHighlighter from 'react-syntax-highlighter/dist/cjs/prism';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';

interface StructurePanelProps {
  content: string | null;
}

interface AppStructure {
  appName: string | null;
  token: {
    name: string | null;
    symbol: string | null;
  };
  tokenRequirements: string | null;
  nftTypes: string[] | null;
  fileStructure: FileNode[];
  codeBlocks: {
    filename: string;
    language: string;
    code: string;
  }[];
}

interface FileNode {
  name: string;
  isDirectory: boolean;
  children?: FileNode[];
}

export default function StructurePanel({ content }: StructurePanelProps) {
  const [structure, setStructure] = useState<AppStructure>({
    appName: null,
    token: { name: null, symbol: null },
    tokenRequirements: null,
    nftTypes: null,
    fileStructure: [],
    codeBlocks: []
  });

  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (content) {
      const parsedStructure = parseAIResponse(content);
      setStructure(parsedStructure);
    }
  }, [content]);

  const parseAIResponse = (markdown: string): AppStructure => {
    const result: AppStructure = {
      appName: null,
      token: { name: null, symbol: null },
      tokenRequirements: null,
      nftTypes: null,
      fileStructure: [],
      codeBlocks: []
    };

    // Extract app name
    const appNameMatch = markdown.match(/# (\w+)/);
    if (appNameMatch) {
      result.appName = appNameMatch[1];
    }

    // Try to extract token information
    const tokenMatch = markdown.match(/Token [Nn]ame:?\s+([A-Za-z0-9]+)/);
    const symbolMatch = markdown.match(/Token [Ss]ymbol:?\s+([A-Z0-9]+)/);
    if (tokenMatch) {
      result.token.name = tokenMatch[1];
    }
    if (symbolMatch) {
      result.token.symbol = symbolMatch[1];
    }

    // Extract token requirements
    const tokenReqMatch = markdown.match(/(\d+)[kK]? tokens/);
    if (tokenReqMatch) {
      result.tokenRequirements = tokenReqMatch[0];
    }

    // Extract NFT types if available
    const nftMatches = markdown.match(/NFT [Tt]ypes?:?\s+([\w\s,]+)/);
    if (nftMatches) {
      result.nftTypes = nftMatches[1].split(',').map(type => type.trim());
    }

    // Parse file structure from markdown
    // Look for file structures in code blocks or lists
    const fileStructureMatch = markdown.match(/```([\s\S]+?)```/);
    if (fileStructureMatch) {
      const fileLines = fileStructureMatch[1]
        .split('\n')
        .filter(line => line.trim().includes('/') || line.trim().includes('.'));

      // Build file tree
      const root: FileNode[] = [];
      const pathMap = new Map<string, FileNode>();

      fileLines.forEach(line => {
        const trimmedLine = line.trim();
        if (!trimmedLine) return;

        const parts = trimmedLine.split('/').filter(Boolean);
        if (parts.length === 0) return;

        let currentLevel = root;
        let currentPath = '';

        parts.forEach((part, index) => {
          currentPath += '/' + part;
          if (!pathMap.has(currentPath)) {
            const isFile = part.includes('.') || index === parts.length - 1;
            const node: FileNode = {
              name: part,
              isDirectory: !isFile,
              children: isFile ? undefined : []
            };

            pathMap.set(currentPath, node);
            currentLevel.push(node);
          }

          if (index < parts.length - 1) {
            const node = pathMap.get(currentPath);
            if (node && node.children) {
              currentLevel = node.children;
            }
          }
        });
      });

      result.fileStructure = root;
    }

    // Extract code blocks
    const codeBlockRegex = /```(\w+)\n([\s\S]+?)```/g;
    let codeMatch;
    let blockCount = 0;
    
    while ((codeMatch = codeBlockRegex.exec(markdown)) !== null && blockCount < 3) {
      // Try to detect the filename from context
      let filename = `code-block-${blockCount + 1}.txt`;
      
      // Look for filenames in nearby text
      const prevText = markdown.substring(Math.max(0, codeMatch.index - 100), codeMatch.index);
      const filenameMatch = prevText.match(/[`'"]([\w-]+\.\w+)[`'"]/);
      if (filenameMatch) {
        filename = filenameMatch[1];
      } else if (prevText.includes('.sol')) {
        filename = prevText.match(/([\w-]+\.sol)/)?.[1] || filename;
      } else if (prevText.includes('.js')) {
        filename = prevText.match(/([\w-]+\.js)/)?.[1] || filename;
      } else if (prevText.includes('.json')) {
        filename = prevText.match(/([\w-]+\.json)/)?.[1] || filename;
      }
      
      result.codeBlocks.push({
        filename,
        language: codeMatch[1],
        code: codeMatch[2].trim()
      });
      
      blockCount++;
    }

    return result;
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const exportAsMarkdown = () => {
    if (!content) return;
    
    const element = document.createElement('a');
    const file = new Blob([content], {type: 'text/markdown'});
    element.href = URL.createObjectURL(file);
    element.download = `${structure.appName || 'smartapp'}-structure.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const renderFileTree = (nodes: FileNode[], level = 0) => {
    return (
      <ul className="pl-4 space-y-1 font-mono text-sm">
        {nodes.map((node, index) => (
          <li key={index} className="flex items-start">
            <span className="mt-0.5 mr-1">
              {node.isDirectory ? (
                <FolderIcon className="w-4 h-4 text-yellow-400" />
              ) : (
                <DocumentIcon className="w-4 h-4 text-blue-400" />
              )}
            </span>
            <div>
              <span className={node.isDirectory ? "font-medium text-yellow-300" : "text-gray-300"}>
                {node.name}
              </span>
              {node.children && node.children.length > 0 && (
                <div className="mt-1">
                  {renderFileTree(node.children, level + 1)}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    );
  };

  if (!content) {
    return (
      <div className="flex items-center justify-center h-full text-center">
        <div className="max-w-xs">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
            <svg className="w-6 h-6 text-white/60" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 6.25278V19.2528M12 6.25278C10.8321 5.47686 9.24649 5 7.5 5C5.75351 5 4.16789 5.47686 3 6.25278V19.2528C4.16789 18.4769 5.75351 18 7.5 18C9.24649 18 10.8321 18.4769 12 19.2528M12 6.25278C13.1679 5.47686 14.7535 5 16.5 5C18.2465 5 19.8321 5.47686 21 6.25278V19.2528C19.8321 18.4769 18.2465 18 16.5 18C14.7535 18 13.1679 18.4769 12 19.2528" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h3 className="text-sm font-medium mb-2 text-white/90">Nenhuma estrutura gerada</h3>
          <p className="text-white/50 text-xs">
            A estrutura do seu SmartApp aparecerá aqui após enviar uma descrição.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-4 p-4 overflow-auto">
      {/* Resumo informativo */}
      <div className="glass p-4 rounded-xl">
        <h3 className="text-sm font-medium mb-3 text-white/90 border-b border-white/10 pb-2">
          Resumo do SmartApp
        </h3>
        
        <div className="space-y-2">
          {structure.appName && (
            <div className="flex justify-between">
              <span className="text-xs text-white/60">Nome:</span>
              <span className="text-xs font-medium text-white">{structure.appName}</span>
            </div>
          )}
          
          {structure.token.name && (
            <div className="flex justify-between">
              <span className="text-xs text-white/60">Token:</span>
              <span className="text-xs font-medium text-white">
                {structure.token.name} 
                {structure.token.symbol && ` (${structure.token.symbol})`}
              </span>
            </div>
          )}
          
          {structure.tokenRequirements && (
            <div className="flex justify-between">
              <span className="text-xs text-white/60">Requisitos:</span>
              <span className="text-xs font-medium text-white">{structure.tokenRequirements}</span>
            </div>
          )}
          
          {structure.nftTypes && structure.nftTypes.length > 0 && (
            <div className="flex justify-between">
              <span className="text-xs text-white/60">NFTs:</span>
              <span className="text-xs font-medium text-white">
                {structure.nftTypes.join(', ')}
              </span>
            </div>
          )}
        </div>
      </div>
      
      {/* Estrutura de arquivos */}
      {structure.fileStructure.length > 0 && (
        <div className="glass p-4 rounded-xl">
          <div className="flex justify-between items-center mb-3 border-b border-white/10 pb-2">
            <h3 className="text-sm font-medium text-white/90">
              Estrutura de Arquivos
            </h3>
            <button 
              onClick={() => copyToClipboard(content, 'file-structure')}
              className="p-1 rounded-md hover:bg-white/10 transition-colors"
              title="Copiar estrutura"
            >
              {copied === 'file-structure' ? (
                <ClipboardDocumentCheckIcon className="w-4 h-4 text-green-400" />
              ) : (
                <ClipboardDocumentIcon className="w-4 h-4 text-white/60" />
              )}
            </button>
          </div>
          
          {renderFileTree(structure.fileStructure)}
        </div>
      )}
      
      {/* Blocos de código */}
      {structure.codeBlocks.length > 0 && (
        <div className="glass p-4 rounded-xl">
          <h3 className="text-sm font-medium mb-3 text-white/90 border-b border-white/10 pb-2">
            Blocos de Código Relevantes
          </h3>
          
          <div className="space-y-4">
            {structure.codeBlocks.map((block, index) => (
              <div key={index} className="rounded-lg overflow-hidden">
                <div className="flex justify-between items-center bg-black/30 px-3 py-2">
                  <span className="text-xs font-jetbrains text-white/80">{block.filename}</span>
                  <button 
                    onClick={() => copyToClipboard(block.code, `code-${index}`)}
                    className="p-1 rounded-md hover:bg-white/10 transition-colors"
                    title="Copiar código"
                  >
                    {copied === `code-${index}` ? (
                      <ClipboardDocumentCheckIcon className="w-4 h-4 text-green-400" />
                    ) : (
                      <ClipboardDocumentIcon className="w-4 h-4 text-white/60" />
                    )}
                  </button>
                </div>
                <div className="max-h-60 overflow-auto">
                  <SyntaxHighlighter
                    language={block.language}
                    style={vscDarkPlus}
                    customStyle={{ margin: 0, borderRadius: 0 }}
                    wrapLines={true}
                  >
                    {block.code}
                  </SyntaxHighlighter>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Área de ações */}
      <div className="glass p-4 rounded-xl">
        <h3 className="text-sm font-medium mb-3 text-white/90 border-b border-white/10 pb-2">
          Ações
        </h3>
        
        <div className="grid grid-cols-2 gap-2">
          <button 
            onClick={exportAsMarkdown}
            className="flex items-center justify-center px-3 py-2 text-xs font-medium rounded-lg glass-button"
          >
            <DocumentTextIcon className="w-4 h-4 mr-2" />
            Exportar (.md)
          </button>
          
          <button className="flex items-center justify-center px-3 py-2 text-xs font-medium rounded-lg glass-button">
            <DocumentArrowDownIcon className="w-4 h-4 mr-2" />
            Baixar (.zip)
          </button>
          
          <button className="flex items-center justify-center px-3 py-2 text-xs font-medium rounded-lg glass-button">
            <LinkIcon className="w-4 h-4 mr-2" />
            Documentação
          </button>
          
          <button className="flex items-center justify-center px-3 py-2 text-xs font-medium rounded-lg glass-button">
            <BeakerIcon className="w-4 h-4 mr-2" />
            Testar
          </button>
        </div>
      </div>
    </div>
  );
} 