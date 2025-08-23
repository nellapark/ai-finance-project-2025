'use client';

import React, { useState } from 'react';
import SpendingSimulationGraph from './components/spending-simulation-graph';
import BankConnectModal from './components/bank-connect-modal';
import type { DataPoint } from './components/spending-simulation-graph';
import { parseTransactionCSV, parseDebtCSV } from '../../../utils/csvParser';
import type { TransactionData, DebtData } from '../../../utils/csvParser';

interface SpendingSimulationProps {
  className?: string;
}

interface SimulatedTransaction {
  date: string;
  description: string;
  amount: number;
  category: string;
  account: string;
  type: string;
  confidence: number;
  isRecurring: boolean;
  recurringPattern: string | null;
}

interface RecurringTransaction {
  description: string;
  averageAmount: number;
  frequency: string;
  category: string;
  confidence: number;
  nextOccurrence: string;
}

interface SignificantTransaction {
  description: string;
  averageAmount: number;
  frequency: string;
  category: string;
  lastOccurrence: string;
  predictedNext: string;
}

interface SeasonalPattern {
  season: string;
  category: string;
  averageIncrease: number;
  reason: string;
}

interface LLMAnalysis {
  simulatedTransactions: SimulatedTransaction[];
  patterns: {
    recurringTransactions: RecurringTransaction[];
    significantTransactions: SignificantTransaction[];
    seasonalPatterns: SeasonalPattern[];
  };
  insights: {
    totalPredictedTransactions: number;
    recurringTransactionCount: number;
    averageTransactionAmount: number;
    primarySpendingCategories: string[];
    spendingTrend: string;
    riskFactors: string[];
    recommendations: string[];
  };
  summary: {
    projectedTotalIncome: number;
    projectedTotalExpenses: number;
    projectedNetChange: number;
    confidenceScore: number;
  };
}

const SpendingSimulation: React.FC<SpendingSimulationProps> = ({
  className = '',
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hasConnectedData, setHasConnectedData] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{
    transactions: File | null;
    debt: File | null;
  }>({ transactions: null, debt: null });
  const [graphData, setGraphData] = useState<DataPoint[]>([]);
  const [llmAnalysis, setLlmAnalysis] = useState<LLMAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  
  // Testing mode constant - set to true to use existing CSV files
  const isTesting = true;

  const handleConnectBanks = () => {
    setIsModalOpen(true);
  };

  const handleTestingMode = async () => {
    setHasConnectedData(true);
    setIsAnalyzing(true);
    setAnalysisError(null);
    
    try {
      await analyzeDataWithLLM(null, null, isTesting);
    } catch (error) {
      console.error('Error in testing mode:', error);
      setAnalysisError('Failed to load testing data. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDataUploaded = async (transactionFile: File | null, debtFile: File | null) => {
    setUploadedFiles({
      transactions: transactionFile,
      debt: debtFile,
    });
    setHasConnectedData(true);
    setIsModalOpen(false);
    setIsAnalyzing(true);
    setAnalysisError(null);
    
    try {
      await analyzeDataWithLLM(transactionFile, debtFile, isTesting);
    } catch (error) {
      console.error('Error analyzing data:', error);
      setAnalysisError('Failed to analyze your financial data. Please try again.');
      // Fall back to simple data generation
      generateFallbackData(transactionFile, debtFile);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const analyzeDataWithLLM = async (transactionFile: File | null, debtFile: File | null, testingMode: boolean = false) => {
    const startTime = Date.now();
    console.log('🚀 [Client] Starting LLM analysis...');
    
    let transactionData: TransactionData[] = [];
    let debtData: DebtData[] = [];

    try {
      // Parse CSV files
      console.log('📄 [Client] Parsing CSV files...');
      if (transactionFile) {
        console.log('💳 [Client] Parsing transaction file:', {
          name: transactionFile.name,
          size: transactionFile.size,
          type: transactionFile.type
        });
        transactionData = await parseTransactionCSV(transactionFile);
        console.log('✅ [Client] Transaction parsing completed:', {
          recordCount: transactionData.length,
          sampleRecord: transactionData[0]
        });
      }
      
      if (debtFile) {
        console.log('💳 [Client] Parsing debt file:', {
          name: debtFile.name,
          size: debtFile.size,
          type: debtFile.type
        });
        debtData = await parseDebtCSV(debtFile);
        console.log('✅ [Client] Debt parsing completed:', {
          recordCount: debtData.length,
          sampleRecord: debtData[0]
        });
      }

      // Prepare request data
      const requestData = {
        transactionData,
        debtData,
        isTesting: testingMode,
      };
      
      console.log('📊 [Client] Sending data to API:', {
        transactionCount: transactionData.length,
        debtCount: debtData.length,
        requestSize: JSON.stringify(requestData).length
      });

      // Send data to LLM for analysis
      const apiCallStart = Date.now();
      const response = await fetch('/api/analyze-spending', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      const apiCallDuration = Date.now() - apiCallStart;
      console.log('📡 [Client] API call completed in', apiCallDuration, 'ms');
      console.log('📊 [Client] Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ [Client] API request failed:', {
          status: response.status,
          statusText: response.statusText,
          errorData
        });
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      console.log('🔄 [Client] Parsing API response...');
      const analysis: LLMAnalysis = await response.json();
      
      console.log('✅ [Client] Analysis received:', {
        simulatedTransactions: analysis.simulatedTransactions?.length || 0,
        insights: !!analysis.insights,
        summary: !!analysis.summary,
        projectedTotalIncome: analysis.summary?.projectedTotalIncome,
        projectedTotalExpenses: analysis.summary?.projectedTotalExpenses
      });

      setLlmAnalysis(analysis);

      // Convert LLM analysis to graph data - plot individual transaction amounts
      console.log('📈 [Client] Converting analysis to graph data...');
      
      // Sort transactions by date first
      const sortedTransactions = [...analysis.simulatedTransactions].sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      // Create graph data with absolute transaction amounts
      const graphData: DataPoint[] = sortedTransactions.map(transaction => {
        return {
          time: new Date(transaction.date),
          amount: Math.abs(transaction.amount), // Use absolute value for y-axis
          originalAmount: transaction.amount, // Keep original for reference
          description: transaction.description,
          category: transaction.category,
          confidence: transaction.confidence,
          isRecurring: transaction.isRecurring,
          type: transaction.type
        };
      });

      console.log('📊 [Client] Graph data created:', {
        dataPoints: graphData.length,
        dateRange: {
          start: graphData[0]?.time,
          end: graphData[graphData.length - 1]?.time
        },
        amountRange: {
          min: Math.min(...graphData.map(d => d.amount)),
          max: Math.max(...graphData.map(d => d.amount)),
          average: graphData.reduce((sum, d) => sum + d.amount, 0) / graphData.length
        },
        transactionTypes: {
          income: graphData.filter(d => d.type === 'Credit').length,
          expenses: graphData.filter(d => d.type === 'Debit').length
        }
      });

      setGraphData(graphData);

      const totalDuration = Date.now() - startTime;
      console.log('🎉 [Client] LLM analysis completed successfully in', totalDuration, 'ms');

    } catch (error) {
      const totalDuration = Date.now() - startTime;
      console.error('💥 [Client] LLM analysis failed after', totalDuration, 'ms:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        transactionDataLength: transactionData.length,
        debtDataLength: debtData.length
      });
      throw error;
    }
  };

  const generateFallbackData = (transactionFile: File | null, debtFile: File | null) => {
    // Fallback to simple data generation if LLM fails
    const data: DataPoint[] = [];
    const startDate = new Date(2024, 0, 1);
    const baseAmount = 75000;

    for (let i = 0; i < 12; i++) {
      const date = new Date(startDate);
      date.setMonth(date.getMonth() + i);
      
      const monthlySpending = transactionFile ? 
        baseAmount - (i * 4500) + (Math.random() - 0.5) * 8000 :
        baseAmount - (i * 3000) + (Math.random() - 0.5) * 5000;
      
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
                {isAnalyzing
                  ? 'Analyzing your financial data with AI...'
                  : hasConnectedData 
                  ? 'Your personalized spending analysis based on your financial data.'
                  : 'Connect your financial data to get personalized spending insights and projections.'
                }
              </p>
            </div>
            <div className="mt-4 sm:mt-0 flex gap-3">
              <button
                onClick={handleTestingMode}
                disabled={isAnalyzing}
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {isAnalyzing ? 'Loading...' : 'Test Mode'}
              </button>
              <button
                onClick={handleConnectBanks}
                disabled={isAnalyzing}
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

        {/* Error Message */}
        {analysisError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800">Analysis Error</p>
                <p className="text-sm text-red-700">{analysisError}</p>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="space-y-8">
          {isAnalyzing ? (
            /* Loading State */
            <section className="text-center py-12">
              <div className="max-w-md mx-auto">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  Analyzing Your Financial Data
                </h2>
                <p className="text-gray-600">
                  Our AI is processing your transaction history and debt information to create personalized spending projections...
                </p>
              </div>
            </section>
          ) : hasConnectedData ? (
            <>
              {/* Graph Section */}
              <section className="bg-gray-50 rounded-lg p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
                  Your Spending Projection
                </h2>
                <div className="w-full overflow-x-auto">
                  <SpendingSimulationGraph
                    data={graphData}
                    width={1200}
                    height={500}
                    className="w-full min-w-full"
                  />
                </div>
              </section>

              {/* Insights Section */}
              <section className="bg-white border border-gray-200 rounded-lg p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
                  AI-Powered Financial Insights
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600 mb-1">
                      {llmAnalysis?.insights.totalPredictedTransactions || graphData.length}
                    </div>
                    <div className="text-sm text-blue-800">Predicted Transactions</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600 mb-1">
                      {llmAnalysis?.insights.recurringTransactionCount || 0}
                    </div>
                    <div className="text-sm text-green-800">Recurring Transactions</div>
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600 mb-1">
                      ${Math.abs(llmAnalysis?.insights.averageTransactionAmount || 0).toLocaleString()}
                    </div>
                    <div className="text-sm text-orange-800">Avg Transaction Amount</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600 mb-1">
                      {llmAnalysis?.summary.confidenceScore ? Math.round(llmAnalysis.summary.confidenceScore * 100) : 0}%
                    </div>
                    <div className="text-sm text-purple-800">Confidence Score</div>
                  </div>
                </div>

                {llmAnalysis && (
                  <div className="space-y-6">
                    {/* Transaction Patterns */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Recurring Transactions */}
                      <div>
                        <h3 className="font-semibold text-gray-800 mb-3">Recurring Transactions</h3>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {llmAnalysis.patterns.recurringTransactions.map((transaction, index) => (
                            <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                              <div>
                                <div className="font-medium text-sm">{transaction.description}</div>
                                <div className="text-xs text-gray-600">{transaction.frequency} • {transaction.category}</div>
                              </div>
                              <div className="text-right">
                                <div className="font-medium text-sm">${Math.abs(transaction.averageAmount).toLocaleString()}</div>
                                <div className="text-xs text-gray-600">{Math.round(transaction.confidence * 100)}% confidence</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Significant Transactions */}
                      <div>
                        <h3 className="font-semibold text-gray-800 mb-3">Large Transaction Patterns</h3>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {llmAnalysis.patterns.significantTransactions.map((transaction, index) => (
                            <div key={index} className="flex justify-between items-center p-2 bg-orange-50 rounded">
                              <div>
                                <div className="font-medium text-sm">{transaction.description}</div>
                                <div className="text-xs text-gray-600">{transaction.frequency} • {transaction.category}</div>
                              </div>
                              <div className="text-right">
                                <div className="font-medium text-sm">${Math.abs(transaction.averageAmount).toLocaleString()}</div>
                                <div className="text-xs text-gray-600">Next: {new Date(transaction.predictedNext).toLocaleDateString()}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Categories and Insights */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Spending Categories */}
                      <div>
                        <h3 className="font-semibold text-gray-800 mb-3">Primary Spending Categories</h3>
                        <div className="flex flex-wrap gap-2">
                          {llmAnalysis.insights.primarySpendingCategories.map((category, index) => (
                            <span
                              key={index}
                              className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
                            >
                              {category}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Seasonal Patterns */}
                      <div>
                        <h3 className="font-semibold text-gray-800 mb-3">Seasonal Patterns</h3>
                        <div className="space-y-2">
                          {llmAnalysis.patterns.seasonalPatterns.map((pattern, index) => (
                            <div key={index} className="flex justify-between items-center p-2 bg-yellow-50 rounded">
                              <div>
                                <div className="font-medium text-sm capitalize">{pattern.season}</div>
                                <div className="text-xs text-gray-600">{pattern.reason}</div>
                              </div>
                              <div className="text-right">
                                <div className="font-medium text-sm">{pattern.category}</div>
                                <div className="text-xs text-yellow-700">+${pattern.averageIncrease}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Risk Factors and Recommendations */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Risk Factors */}
                      <div>
                        <h3 className="font-semibold text-gray-800 mb-3">Risk Factors</h3>
                        <ul className="space-y-1">
                          {llmAnalysis.insights.riskFactors.map((risk, index) => (
                            <li key={index} className="text-sm text-red-600 flex items-center">
                              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                              {risk}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Recommendations */}
                      <div>
                        <h3 className="font-semibold text-gray-800 mb-3">AI Recommendations</h3>
                        <ul className="space-y-2">
                          {llmAnalysis.insights.recommendations.map((recommendation, index) => (
                            <li key={index} className="text-sm text-green-700 flex items-start">
                              <svg className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              {recommendation}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
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

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button
                    onClick={handleTestingMode}
                    className="inline-flex items-center px-6 py-3 bg-green-600 text-white font-medium text-lg rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Try Test Mode
                  </button>
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
                
                <p className="mt-4 text-sm text-gray-500">
                  <strong>Test Mode:</strong> Uses pre-generated sample data to demonstrate the application without uploading files.
                </p>
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
