import { useState, useEffect } from 'react';
import StructurePanel from './StructurePanel';
import { BookmarkIcon, CodeBracketIcon, LinkIcon, TrashIcon, DocumentIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline';
import SyntaxHighlighter from 'react-syntax-highlighter/dist/cjs/prism';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';

interface SidebarProps {
  generatedStructure: string | null;
  pinnedItems?: PinnedItem[]; // Add prop to receive pinned items
}

interface PinnedItem {
  id: string;
  type: 'code' | 'link';
  content: string;
  language?: string;
  title: string;
  url?: string;
  autoDetected?: boolean;
  importance?: number; // Higher value means more important
}

export default function Sidebar({ generatedStructure, pinnedItems: propPinnedItems }: SidebarProps) {
  // State for locally managed pinned items (fallback if no props provided)
  const [localPinnedItems, setLocalPinnedItems] = useState<PinnedItem[]>([]);
  const [copiedItemId, setCopiedItemId] = useState<string | null>(null);
  
  // Use either provided prop items or local items
  const pinnedItems = propPinnedItems || localPinnedItems;

  // If no items are provided via props, try to load from localStorage (for backward compatibility)
  useEffect(() => {
    if (!propPinnedItems && typeof window !== 'undefined') {
      console.log("🔷 No pinned items provided as props, checking localStorage");
      const savedItems = localStorage.getItem('pinnedItems');
      
      if (savedItems) {
        try {
          const items = JSON.parse(savedItems);
          console.log("🔷 Loaded pinned items from localStorage:", items.length);
          setLocalPinnedItems(items);
        } catch (error) {
          console.error('🔷 Error loading pinned items from localStorage:', error);
        }
      }
    }
  }, [propPinnedItems]);

  // Function to copy code to clipboard
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedItemId(id);
      setTimeout(() => setCopiedItemId(null), 2000); // Reset after 2 seconds
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  };

  // Function to remove a pinned item - only works for local items
  const removePinnedItem = (id: string) => {
    if (!propPinnedItems) {
      const updatedItems = localPinnedItems.filter(item => item.id !== id);
      setLocalPinnedItems(updatedItems);
      localStorage.setItem('pinnedItems', JSON.stringify(updatedItems));
    } else {
      console.log("🔷 Cannot remove item from props-provided items");
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center px-4 py-2 border-b border-white/10">
        <div className="w-5 h-5 rounded-full bg-purple-500/30 flex items-center justify-center mr-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 6.25278V19.2528M12 6.25278C10.8321 5.47686 9.24649 5 7.5 5C5.75351 5 4.16789 5.47686 3 6.25278V19.2528C4.16789 18.4769 5.75351 18 7.5 18C9.24649 18 10.8321 18.4769 12 19.2528M12 6.25278C13.1679 5.47686 14.7535 5 16.5 5C18.2465 5 19.8321 5.47686 21 6.25278V19.2528C19.8321 18.4769 18.2465 18 16.5 18C14.7535 18 13.1679 18.4769 12 19.2528" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h2 className="text-sm font-medium text-white/70">Informações Úteis</h2>
        {pinnedItems.length > 0 && (
          <span className="ml-1.5 bg-indigo-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {pinnedItems.length}
          </span>
        )}
      </div>
      
      <div className="flex-1 overflow-auto scrollbar-custom p-3 space-y-4">
        {/* App Structure section */}
        {generatedStructure && (
          <div className="bg-white/5 rounded-lg overflow-hidden mb-4">
            <div className="flex items-center px-3 py-2 bg-white/5 border-b border-white/10">
              <DocumentIcon className="w-4 h-4 mr-2 text-blue-400" />
              <span className="text-sm font-medium">Estrutura da Aplicação</span>
            </div>
            <div className="p-3">
              <StructurePanel content={generatedStructure} />
            </div>
          </div>
        )}
        
        {/* Pinned items section */}
        {pinnedItems.length > 0 && (
          <>
            <div className="text-sm font-medium text-white/70 px-1 py-2 border-b border-white/10">
              Itens Salvos
            </div>
            <div className="space-y-3">
              {pinnedItems.map(item => (
                <div key={item.id} className="bg-white/5 rounded-lg overflow-hidden">
                  <div className="flex justify-between items-center px-3 py-2 bg-white/5">
                    <div className="flex items-center">
                      {item.type === 'code' ? (
                        <CodeBracketIcon className="w-4 h-4 mr-2 text-indigo-400" />
                      ) : (
                        <LinkIcon className="w-4 h-4 mr-2 text-green-400" />
                      )}
                      <span className="text-sm font-medium truncate">
                        {item.title}
                        {item.autoDetected && (
                          <span className="ml-2 text-xs italic text-white/40">auto</span>
                        )}
                      </span>
                    </div>
                    {item.type === 'code' ? (
                      <button 
                        onClick={() => copyToClipboard(item.content, item.id)}
                        className="text-white/40 hover:text-white/80"
                        title="Copiar código"
                      >
                        {copiedItemId === item.id ? (
                          <span className="text-xs text-green-400">Copiado!</span>
                        ) : (
                          <ClipboardDocumentIcon className="w-4 h-4" />
                        )}
                      </button>
                    ) : (
                      <button 
                        onClick={() => removePinnedItem(item.id)}
                        className="text-white/40 hover:text-white/80"
                        title="Remover"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div>
                    {item.type === 'code' ? (
                      <div className="text-xs">
                        <SyntaxHighlighter
                          language={item.language || 'javascript'}
                          style={vscDarkPlus}
                          customStyle={{ margin: 0, padding: '0.75rem', maxHeight: '200px', fontSize: '0.75rem' }}
                        >
                          {item.content}
                        </SyntaxHighlighter>
                      </div>
                    ) : (
                      <a 
                        href={item.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="block px-3 py-2 text-sm text-blue-400 hover:underline break-all"
                      >
                        {item.url}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        
        {/* Empty state */}
        {!generatedStructure && pinnedItems.length === 0 && (
          <div className="text-center py-8 text-white/60">
            <BookmarkIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhuma informação salva</p>
            <p className="text-xs mt-1">
              Informações úteis serão detectadas automaticamente durante a conversa
            </p>
          </div>
        )}
      </div>
    </div>
  );
} 