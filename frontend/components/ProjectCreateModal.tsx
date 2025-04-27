import React, { useEffect, useState } from 'react';
import { useWallet } from '../hooks/useWallet';

interface ProjectCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (projectName: string) => void;
  isProcessing?: boolean;
}

const ProjectCreateModal: React.FC<ProjectCreateModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isProcessing = false
}) => {
  const [projectName, setProjectName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { accountId } = useWallet();

  useEffect(() => {
    // Reset form fields when modal opens
    if (isOpen) {
      setProjectName('');
      setError(null);
    }
  }, [isOpen]);

  const handleConfirm = () => {
    if (!projectName.trim()) {
      setError('Project name cannot be empty');
      return;
    }

    onConfirm(projectName);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-black opacity-75"></div>
        </div>
        
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
        
        <div 
          className="inline-block align-bottom bg-gray-900 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full"
          role="dialog" 
          aria-modal="true" 
          aria-labelledby="modal-headline"
        >
          <div className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">
                <svg className="h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                <h3 className="text-lg leading-6 font-medium text-white" id="modal-headline">
                  Create New Project
                </h3>
                
                <div className="mt-4">
                  <div className="mb-6">
                    <label htmlFor="projectName" className="block text-sm font-medium text-gray-300 mb-2">
                      Project Name
                    </label>
                    <input
                      type="text"
                      name="projectName"
                      id="projectName"
                      autoFocus
                      className="focus:ring-blue-500 focus:border-blue-500 block w-full bg-gray-800 border-gray-600 shadow-sm sm:text-sm rounded-md p-2 text-white"
                      placeholder="Enter your project name"
                      value={projectName}
                      onChange={(e) => {
                        setProjectName(e.target.value);
                        setError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleConfirm();
                        }
                      }}
                    />
                  </div>
                  
                  <div className="bg-gray-800 p-4 rounded-md mb-4">
                    <p className="text-xs text-gray-400">
                      Give your project a descriptive name that helps you identify its purpose.
                    </p>
                  </div>
                  
                  {error && (
                    <div className="bg-red-900/50 border border-red-700 text-red-200 p-3 rounded-md mb-4">
                      {error}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-800 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              disabled={isProcessing}
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleConfirm}
            >
              {isProcessing ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating...
                </>
              ) : 'Create Project'}
            </button>
            
            <button
              type="button"
              disabled={isProcessing}
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-500 shadow-sm px-4 py-2 bg-gray-700 text-base font-medium text-gray-200 hover:bg-gray-600 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectCreateModal; 