import React from 'react';

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmButtonText: string;
  cancelButtonText?: string;
}

const ConfirmationDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmButtonText,
  cancelButtonText = 'Cancelar'
}: ConfirmationDialogProps) => {
  if (!isOpen) return null;
  
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };
  
  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center" 
      style={{ 
        backgroundColor: 'rgba(0, 0, 0, 0.7)', 
        backdropFilter: 'blur(4px)' 
      }}
    >
      <div 
        className="bg-[#1a103a]/90 rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl border border-purple-500/20"
        onClick={e => e.stopPropagation()}
        style={{ position: 'relative' }}
      >
        <div className="text-center">
          <h3 className="text-base font-semibold text-white mb-3">
            {title}
          </h3>
          <div className="my-4">
            <p className="text-sm text-gray-200">
              {message}
            </p>
          </div>
        </div>
        <div className="flex space-x-3 mt-6">
          <button
            type="button"
            className="flex-1 py-2 rounded-md bg-gray-600/30 text-sm font-semibold text-gray-200 shadow-sm hover:bg-gray-600/50"
            onClick={onClose}
          >
            {cancelButtonText}
          </button>
          <button
            type="button"
            className="flex-1 py-2 rounded-md bg-red-600 text-sm font-semibold text-white shadow-sm hover:bg-red-500"
            onClick={handleConfirm}
          >
            {confirmButtonText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationDialog; 