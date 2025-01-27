import React, { useState } from 'react';
import { Session } from 'sip.js';
import { ArrowRight, Check } from 'lucide-react';

interface TransferButtonProps {
  session: Session | null;
  type: 'attended' | 'blind';
  sendDTMF: (tone: string) => void;
}

const TransferButton: React.FC<TransferButtonProps> = ({ session, type, sendDTMF }) => {
  const [isTransferring, setIsTransferring] = useState(false);
  const [extension, setExtension] = useState('');

  const handleTransfer = () => {
    if (type === 'attended') {
      sendDTMF(`*2${extension}`);
    } else {
      sendDTMF(`#1${extension}`);
    }
    setIsTransferring(true);
  };

  const handleCompleteTransfer = () => {
    sendDTMF('#');
    setIsTransferring(false);
  };

  return (
    <div className="relative">
      {isTransferring ? (
        <button 
          onClick={handleCompleteTransfer} 
          className="p-2 rounded-full hover:bg-green-50 text-green-600"
        >
          <Check className="w-5 h-5" />
        </button>
      ) : (
        <button 
          onClick={() => setIsTransferring(true)} 
          className="p-2 rounded-full hover:bg-blue-50 text-blue-600"
        >
          <ArrowRight className="w-5 h-5" />
        </button>
      )}
      {isTransferring && (
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 p-2 bg-white border border-gray-300 rounded shadow-lg">
          <input
            type="text"
            placeholder="Enter extension"
            value={extension}
            onChange={(e) => setExtension(e.target.value)}
            className="px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button 
            onClick={handleTransfer} 
            className="ml-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Transfer
          </button>
        </div>
      )}
    </div>
  );
};

export default TransferButton;
