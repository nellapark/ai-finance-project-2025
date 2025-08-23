'use client';

import React, { useCallback, useState } from 'react';

interface FileUploadProps {
  onFileUpload: (file: File, type: 'transactions' | 'debt') => void;
  type: 'transactions' | 'debt';
  accept?: string;
  className?: string;
}

const FileUpload: React.FC<FileUploadProps> = ({
  onFileUpload,
  type,
  accept = '.csv',
  className = '',
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const file = files[0];
      setUploadedFile(file);
      onFileUpload(file, type);
    }
  }, [onFileUpload, type]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setUploadedFile(file);
      onFileUpload(file, type);
    }
  }, [onFileUpload, type]);

  const getTitle = () => {
    return type === 'transactions' 
      ? 'Transaction Data' 
      : 'Credit Cards & Debt Information';
  };

  const getDescription = () => {
    return type === 'transactions'
      ? 'Upload your bank transaction history (CSV format)'
      : 'Upload credit card statements, loan information, and payment history (CSV format)';
  };

  const getExampleFields = () => {
    return type === 'transactions'
      ? ['Transaction Date', 'Post Date', 'Description', 'Category', 'Type', 'Amount', 'Memo']
      : ['Account Type', 'Balance', 'Interest Rate', 'Minimum Payment', 'Due Date'];
  };

  return (
    <div className={`file-upload ${className}`}>
      <h3 className="text-lg font-semibold text-gray-800 mb-2">
        {getTitle()}
      </h3>
      <p className="text-sm text-gray-600 mb-4">
        {getDescription()}
      </p>
      
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          isDragOver
            ? 'border-blue-400 bg-blue-50'
            : uploadedFile
            ? 'border-green-400 bg-green-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept={accept}
          onChange={handleFileSelect}
          className="hidden"
          id={`file-upload-${type}`}
        />
        
        {uploadedFile ? (
          <div className="space-y-2">
            <div className="text-green-600">
              <svg className="w-8 h-8 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-sm font-medium text-green-800">
              File uploaded successfully
            </p>
            <p className="text-xs text-green-600">
              {uploadedFile.name} ({(uploadedFile.size / 1024).toFixed(1)} KB)
            </p>
            <label
              htmlFor={`file-upload-${type}`}
              className="inline-block mt-2 px-3 py-1 text-xs bg-green-100 text-green-800 rounded cursor-pointer hover:bg-green-200"
            >
              Replace file
            </label>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-gray-400">
              <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="text-sm text-gray-600">
              Drag and drop your file here, or{' '}
              <label
                htmlFor={`file-upload-${type}`}
                className="text-blue-600 hover:text-blue-700 cursor-pointer font-medium"
              >
                browse
              </label>
            </p>
            <p className="text-xs text-gray-500">
              Supports CSV files only
            </p>
          </div>
        )}
      </div>

      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <p className="text-xs font-medium text-gray-700 mb-1">Expected fields:</p>
        <div className="flex flex-wrap gap-1">
          {getExampleFields().map((field, index) => (
            <span
              key={index}
              className="inline-block px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded"
            >
              {field}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FileUpload;
