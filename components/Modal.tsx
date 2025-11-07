
import React from 'react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4"
            onClick={onClose}
        >
            <div 
                className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 transform transition-all"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-800">{title}</h2>
                    <button 
                        onClick={onClose} 
                        className="text-gray-400 hover:text-gray-600 text-2xl"
                    >
                        &times;
                    </button>
                </div>
                <div>
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Modal;
