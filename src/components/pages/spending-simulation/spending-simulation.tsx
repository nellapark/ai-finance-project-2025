'use client';

import React, { useState } from 'react';
import SpendingSimulationGraph from './components/spending-simulation-graph';
import BankConnectModal from './components/bank-connect-modal';
import type { DataPoint } from './components/spending-simulation-graph';

interface SpendingSimulationProps {
  className?: string;
}

const SpendingSimulation: React.FC<SpendingSimulationProps> = ({
  className = '',
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hasConnectedData, setHasConnectedData] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{
    transactions: File | null;
    debt: File | null;
  }>({ transactions: null, debt: null });
  const [graphData, setGraphData] = useState<DataPoint[]>([]);

  const handleConnectBanks = () => {
    setIsModalOpen(true);
  };

  const handleDataUploaded = (transactionFile: File | null, debtFile: File | null) => {
    setUploadedFiles({
      transactions: transactionFile,
      debt: debtFile,
    });
    setHasConnectedData(true);
    setIsModalOpen(false);
    
    // Generate more realistic data based on uploaded files
    // In a real app, you would parse the uploaded files here
    generateDataFromFiles(transactionFile, debtFile);
  };

  const generateDataFromFiles = (transactionFile: File | null, debtFile: File | null) => {
    // Simulate processing uploaded data to generate graph data
    const data: DataPoint[] = [];
    const startDate = new Date(2024, 0, 1);
    let baseAmount = 75000; // Starting with a higher amount if they have data

    for (let i = 0; i < 12; i++) {
      const date = new Date(startDate);
      date.setMonth(date.getMonth() + i);
      
      // More realistic spending pattern based on "uploaded" data
      const monthlySpending = transactionFile ? 
        baseAmount - (i * 4500) + (Math.random() - 0.5) * 8000 :
        baseAmount - (i * 3000) + (Math.random() - 0.5) * 5000;
      
      // Factor in debt payments if debt file is uploaded
      const debtPayments = debtFile ? Math.random() * 2000 : 0;
      
      data.push({
        time: date,
        amount: Math.max(0, monthlySpending - debtPayments),
      });
    }

    setGraphData(data);
  };

  return (
    <div className={`spending-simulation ${className}`}>
      <div className="container mx-auto px-4 py-8">
        {/* Header Section */}
        <header className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Spending Simulation
              </h1>
              <p className="text-gray-600 text-lg">
                {hasConnectedData 
                  ? 'Your personalized spending analysis based on your financial data.'
                  : 'Connect your financial data to get personalized spending insights and projections.'
                }
              </p>
            </div>
            <div className="mt-4 sm:mt-0">
              <button
                onClick={handleConnectBanks}
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                {hasConnectedData ? 'Update Data' : 'Connect Your Banks'}
              </button>
            </div>
          </div>
          
          {hasConnectedData && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-green-800">
                    Data Connected Successfully
                  </p>
                  <p className="text-sm text-green-700">
                    {uploadedFiles.transactions && `Transaction data: ${uploadedFiles.transactions.name}`}
                    {uploadedFiles.transactions && uploadedFiles.debt && ' • '}
                    {uploadedFiles.debt && `Debt data: ${uploadedFiles.debt.name}`}
                  </p>
                </div>
              </div>
            </div>
          )}
        </header>

        {/* Main Content */}
        <main className="space-y-8">
          {hasConnectedData ? (
            <>
              {/* Graph Section */}
              <section className="bg-gray-50 rounded-lg p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
                  Your Spending Projection
                </h2>
                <div className="flex justify-center">
                  <SpendingSimulationGraph
                    data={graphData}
                    width={800}
                    height={400}
                    className="max-w-full"
                  />
                </div>
              </section>

              {/* Insights Section */}
              <section className="bg-white border border-gray-200 rounded-lg p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
                  Financial Insights
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600 mb-1">
                      ${graphData.length > 0 ? Math.round(graphData[0].amount).toLocaleString() : '0'}
                    </div>
                    <div className="text-sm text-blue-800">Starting Balance</div>
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600 mb-1">
                      ${graphData.length > 1 ? Math.round((graphData[0].amount - graphData[graphData.length - 1].amount) / 12).toLocaleString() : '0'}
                    </div>
                    <div className="text-sm text-orange-800">Avg Monthly Spending</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600 mb-1">
                      ${graphData.length > 0 ? Math.round(graphData[graphData.length - 1].amount).toLocaleString() : '0'}
                    </div>
                    <div className="text-sm text-green-800">Projected Balance</div>
                  </div>
                </div>
              </section>

              {/* Data Summary */}
              <section className="bg-white border border-gray-200 rounded-lg p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
                  Connected Data Summary
                </h2>
                <div className="space-y-3">
                  {uploadedFiles.transactions && (
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <svg className="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <div>
                          <div className="font-medium text-gray-900">Transaction Data</div>
                          <div className="text-sm text-gray-600">{uploadedFiles.transactions.name}</div>
                        </div>
                      </div>
                      <div className="text-sm text-gray-500">
                        {(uploadedFiles.transactions.size / 1024).toFixed(1)} KB
                      </div>
                    </div>
                  )}
                  {uploadedFiles.debt && (
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <svg className="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <div>
                          <div className="font-medium text-gray-900">Credit & Debt Data</div>
                          <div className="text-sm text-gray-600">{uploadedFiles.debt.name}</div>
                        </div>
                      </div>
                      <div className="text-sm text-gray-500">
                        {(uploadedFiles.debt.size / 1024).toFixed(1)} KB
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </>
          ) : (
            /* Welcome Section */
            <section className="text-center py-12">
              <div className="max-w-2xl mx-auto">
                <div className="mb-8">
                  <svg className="w-24 h-24 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    Get Started with Your Financial Data
                  </h2>
                  <p className="text-gray-600 text-lg mb-8">
                    Upload your transaction history and debt information to see personalized spending projections and insights.
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div className="p-6 border border-gray-200 rounded-lg">
                    <div className="text-blue-600 mb-3">
                      <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2">Transaction Data</h3>
                    <p className="text-sm text-gray-600">
                      Bank statements, credit card transactions, and spending history to analyze your patterns.
                    </p>
                  </div>
                  <div className="p-6 border border-gray-200 rounded-lg">
                    <div className="text-red-600 mb-3">
                      <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2">Credit & Debt Info</h3>
                    <p className="text-sm text-gray-600">
                      Credit card balances, loan information, and payment history to factor in interest and payments.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleConnectBanks}
                  className="inline-flex items-center px-8 py-4 bg-blue-600 text-white font-medium text-lg rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                >
                  <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Connect Your Banks
                </button>
              </div>
            </section>
          )}
        </main>

        {/* Bank Connect Modal */}
        <BankConnectModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onDataUploaded={handleDataUploaded}
        />
      </div>
    </div>
  );
};

export default SpendingSimulation;
