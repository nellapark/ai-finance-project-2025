'use client';

import React, { useState } from 'react';
import FileUpload from './file-upload';

interface BankConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataUploaded: (transactionFile: File | null, debtFile: File | null) => void;
}

const BankConnectModal: React.FC<BankConnectModalProps> = ({
  isOpen,
  onClose,
  onDataUploaded,
}) => {
  const [transactionFile, setTransactionFile] = useState<File | null>(null);
  const [debtFile, setDebtFile] = useState<File | null>(null);
  const [step, setStep] = useState<'upload' | 'processing' | 'complete'>('upload');

  const handleFileUpload = (file: File, type: 'transactions' | 'debt') => {
    if (type === 'transactions') {
      setTransactionFile(file);
    } else {
      setDebtFile(file);
    }
  };

  const handleProcessData = async () => {
    if (!transactionFile && !debtFile) {
      alert('Please upload at least one file to continue.');
      return;
    }

    setStep('processing');
    
    // Simulate processing time
    setTimeout(() => {
      setStep('complete');
      onDataUploaded(transactionFile, debtFile);
    }, 2000);
  };

  const handleClose = () => {
    setStep('upload');
    setTransactionFile(null);
    setDebtFile(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            Connect Your Financial Data
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'upload' && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <p className="text-gray-600">
                  Upload your financial data to get personalized spending insights and projections.
                  You can upload one or both types of data.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <FileUpload
                  type="transactions"
                  onFileUpload={handleFileUpload}
                />
                <FileUpload
                  type="debt"
                  onFileUpload={handleFileUpload}
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="w-5 h-5 text-blue-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-blue-800">
                      Data Privacy & Security
                    </h3>
                    <p className="text-sm text-blue-700 mt-1">
                      Your financial data is processed locally and never stored on our servers. 
                      All analysis happens in your browser for maximum privacy and security.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleProcessData}
                  disabled={!transactionFile && !debtFile}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Process Data
                </button>
              </div>
            </div>
          )}

          {step === 'processing' && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Processing Your Data
              </h3>
              <p className="text-gray-600">
                Analyzing your financial information and generating insights...
              </p>
            </div>
          )}

          {step === 'complete' && (
            <div className="text-center py-12">
              <div className="text-green-600 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Data Successfully Processed!
              </h3>
              <p className="text-gray-600 mb-6">
                Your financial data has been analyzed. You can now view your personalized spending simulation.
              </p>
              <button
                onClick={handleClose}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                View Results
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BankConnectModal;
