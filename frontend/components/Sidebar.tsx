import StructurePanel from './StructurePanel';

interface SidebarProps {
  generatedStructure: string | null;
}

export default function Sidebar({ generatedStructure }: SidebarProps) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center px-4 py-2 border-b border-white/10">
        <div className="w-5 h-5 rounded-full bg-purple-500/30 flex items-center justify-center mr-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 6.25278V19.2528M12 6.25278C10.8321 5.47686 9.24649 5 7.5 5C5.75351 5 4.16789 5.47686 3 6.25278V19.2528C4.16789 18.4769 5.75351 18 7.5 18C9.24649 18 10.8321 18.4769 12 19.2528M12 6.25278C13.1679 5.47686 14.7535 5 16.5 5C18.2465 5 19.8321 5.47686 21 6.25278V19.2528C19.8321 18.4769 18.2465 18 16.5 18C14.7535 18 13.1679 18.4769 12 19.2528" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h2 className="text-sm font-medium text-white/70">Estrutura Gerada</h2>
      </div>
      
      <div className="flex-1 overflow-auto">
        <StructurePanel content={generatedStructure} />
      </div>
    </div>
  );
} 