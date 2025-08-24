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
  const [isCumulative, setIsCumulative] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animatedData, setAnimatedData] = useState<DataPoint[]>([]);
  const [fullData, setFullData] = useState<DataPoint[]>([]);
  const [animationSpeed] = useState(50);
  const [isPaused, setIsPaused] = useState(false);
  const [showRecurringOnly, setShowRecurringOnly] = useState(false);
  const [showOneTimeOnly, setShowOneTimeOnly] = useState(false);
  
  // Detected simulation adjustments (read-only, from API)
  interface DetectedAdjustments {
    lifeEvents?: Record<string, boolean>;
    behavioralChanges?: Record<string, boolean>;
    externalFactors?: Record<string, boolean>;
    transactionMetadata?: Array<{
      adjustment: string;
      category: string;
      transactionIndices: number[];
      label: string;
      description: string;
    }>;
  }
  const [detectedAdjustments, setDetectedAdjustments] = useState<DetectedAdjustments | null>(null);
  const [highlightedAdjustment, setHighlightedAdjustment] = useState<string | null>(null); // For hover
  const [toggledAdjustments, setToggledAdjustments] = useState<Set<string>>(new Set()); // For persistent toggle
  const [showAdjustmentDataPoints, setShowAdjustmentDataPoints] = useState<boolean>(true); // Toggle for showing/hiding adjustment data points

  const handleConnectBanks = () => {
    setIsModalOpen(true);
  };

  // Function to identify recurring transactions based on patterns
  const identifyRecurringTransactions = (transactions: any[]): any[] => {
    console.log('🔍 [Analysis] Identifying recurring transaction patterns...');
    
    // Group transactions by similar descriptions and amounts
    const transactionGroups: { [key: string]: any[] } = {};
    
    transactions.forEach(transaction => {
      // Create a key based on description and approximate amount (rounded to nearest $5)
      const description = transaction.description?.toLowerCase().replace(/\d+/g, '').trim() || 'unknown';
      const roundedAmount = Math.round(Math.abs(transaction.amount) / 5) * 5;
      const key = `${description}_${roundedAmount}`;
      
      if (!transactionGroups[key]) {
        transactionGroups[key] = [];
      }
      transactionGroups[key].push(transaction);
    });
    
    // Identify groups with multiple occurrences as potentially recurring
    const recurringPatterns: { [key: string]: boolean } = {};
    Object.entries(transactionGroups).forEach(([key, group]) => {
      if (group.length >= 2) { // At least 2 occurrences
        // Check if transactions are spread over time (not all on same day)
        const dates = group.map(t => new Date(t.date).getTime());
        const minDate = Math.min(...dates);
        const maxDate = Math.max(...dates);
        const daysDifference = (maxDate - minDate) / (1000 * 60 * 60 * 24);
        
        if (daysDifference >= 7) { // At least a week apart
          recurringPatterns[key] = true;
          console.log(`🔄 [Analysis] Found recurring pattern: ${key} (${group.length} occurrences over ${daysDifference.toFixed(0)} days)`);
        }
      }
    });
    
    // Mark transactions as recurring based on identified patterns
    return transactions.map(transaction => {
      const description = transaction.description?.toLowerCase().replace(/\d+/g, '').trim() || 'unknown';
      const roundedAmount = Math.round(Math.abs(transaction.amount) / 5) * 5;
      const key = `${description}_${roundedAmount}`;
      
      return {
        ...transaction,
        isRecurring: recurringPatterns[key] || transaction.isRecurring || false,
        recurringPattern: recurringPatterns[key] ? 'detected' : transaction.recurringPattern,
        recurringGroup: recurringPatterns[key] ? key : (transaction.isRecurring ? key : undefined)
      };
    });
  };

  const animateTransactions = (transactions: DataPoint[]) => {
    console.log('🎬 [Animation] Starting animation with', transactions?.length || 0, 'transactions');
    
    if (!transactions || transactions.length === 0) {
      console.warn('🚫 [Animation] No transactions to animate');
      return;
    }
    
    // Filter out any invalid transactions
    const validTransactions = transactions.filter(t => t && t.time && t.amount !== undefined);
    console.log('✅ [Animation] Valid transactions:', validTransactions.length, 'out of', transactions.length);
    
    if (validTransactions.length === 0) {
      console.warn('🚫 [Animation] No valid transactions to animate');
      return;
    }
    
    console.log('🎯 [Animation] Setting up animation state');
    setIsAnimating(true);
    setIsPaused(false);
    setAnimatedData([]);
    setFullData(validTransactions);
    
    let currentIndex = 0;
    let timeoutId: NodeJS.Timeout;
    
    const addNextTransaction = () => {
      if (isPaused) {
        timeoutId = setTimeout(addNextTransaction, 100);
        return;
      }
      
      if (currentIndex < validTransactions.length) {
        console.log('➕ [Animation] Adding transaction', currentIndex + 1, 'of', validTransactions.length);
        setAnimatedData(prev => [...prev, validTransactions[currentIndex]]);
        currentIndex++;
        timeoutId = setTimeout(addNextTransaction, animationSpeed);
      } else {
        console.log('🏁 [Animation] Animation completed');
        setIsAnimating(false);
        setIsPaused(false);
      }
    };
    
    // Start the animation
    timeoutId = setTimeout(addNextTransaction, 100);
    
    // Return cleanup function
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  };

  const handleGenerateTestData = () => {
    console.log('🧪 [Test] Generating test data with statistical outliers');
    const testData: DataPoint[] = [];
    let cumulativeTotal = 0;
    
    // Generate mostly small transactions ($5-$25) with a few statistical outliers
    for (let i = 0; i < 30; i++) {
      let amount: number;
      let description: string;
      let category: string;
      
      if (i < 25) {
        // Create some recurring patterns and some one-time transactions
        if (i % 7 === 0) {
          // Weekly recurring - Coffee
          amount = 4.50 + Math.random() * 2; // $4.50-$6.50
          description = 'Starbucks';
          category = 'Food & Dining';
        } else if (i % 14 === 0) {
          // Bi-weekly recurring - Gas
          amount = 45 + Math.random() * 15; // $45-$60
          description = 'Shell Gas Station';
          category = 'Transportation';
        } else if (i % 10 === 0) {
          // Recurring subscription
          amount = 15.99;
          description = 'Netflix Subscription';
          category = 'Entertainment';
        } else {
          // One-time transactions
          amount = Math.random() * 20 + 5; // $5-$25
          description = ['Local Restaurant', 'Parking Meter', 'Convenience Store', 'Food Truck'][Math.floor(Math.random() * 4)];
          category = ['Food & Dining', 'Transportation', 'Shopping'][Math.floor(Math.random() * 3)];
        }
      } else {
        // Statistical outliers (much larger than typical)
        amount = Math.random() * 200 + 150; // $150-$350 (outliers for this dataset)
        description = ['Electronics Store', 'Department Store', 'Online Shopping', 'Home Improvement'][Math.floor(Math.random() * 4)];
        category = 'Shopping';
      }
      
      cumulativeTotal += amount;
      
      // Generate recurring group identifier for recurring transactions
      let recurringGroup: string | undefined;
      if ((i % 7 === 0 || i % 14 === 0 || i % 10 === 0) && i < 25) {
        const cleanDescription = description.toLowerCase().replace(/\d+/g, '').trim();
        const roundedAmount = Math.round(amount / 5) * 5;
        recurringGroup = `${cleanDescription}_${roundedAmount}`;
      }

      testData.push({
        time: new Date(2024, 0, i + 1),
        amount: amount,
        cumulativeBalance: cumulativeTotal,
        originalAmount: -amount,
        description: `${description} ${i + 1}`,
        category: category,
        confidence: i < 25 ? 0.8 : 0.6, // Lower confidence for outliers
        isRecurring: (i % 7 === 0 || i % 14 === 0 || i % 10 === 0) && i < 25, // Mark known recurring patterns
        type: 'Debit',
        recurringGroup: recurringGroup
      });
    }
    
    console.log('📊 [Test] Generated test data with statistical distribution:', {
      totalTransactions: testData.length,
      regularTransactions: 25,
      outlierTransactions: 5,
      meanAmount: (testData.reduce((sum, t) => sum + t.amount, 0) / testData.length).toFixed(2)
    });
    
    setHasConnectedData(true);
    animateTransactions(testData);
  };

  const togglePause = () => {
    setIsPaused(!isPaused);
  };

  const skipToEnd = () => {
    if (fullData.length > 0) {
      setAnimatedData(fullData);
      setIsAnimating(false);
      setIsPaused(false);
    }
  };

  // Filter data based on recurring transaction preferences
  const getFilteredData = (data: DataPoint[]) => {
    if (showRecurringOnly) {
      return data.filter(d => d.isRecurring);
    }
    if (showOneTimeOnly) {
      return data.filter(d => !d.isRecurring);
    }
    return data; // Show all transactions
  };

  // Get adjustment display info
  const getAdjustmentDisplayInfo = (category: string, key: string): { label: string; description: string; icon: string } => {
    const displayInfo: Record<string, Record<string, { label: string; description: string; icon: string }>> = {
      lifeEvents: {
        recentMove: { label: 'Recent Move', description: 'Furniture purchases, moving costs, home setup expenses', icon: '🏠' },
        newMarriage: { label: 'New Marriage', description: 'Wedding expenses, ring purchases, honeymoon costs', icon: '💒' },
        newBaby: { label: 'New Baby', description: 'Healthcare costs, childcare expenses, baby supplies', icon: '👶' },
        jobChange: { label: 'Job Change', description: 'Commuting adjustments, relocation expenses, income changes', icon: '💼' },
        graduation: { label: 'Graduation', description: 'Eliminate tuition, increase discretionary spending', icon: '🎓' }
      },
      behavioralChanges: {
        dietaryShift: { label: 'Dietary Shift', description: 'More cooking at home, less eating out', icon: '🥗' },
        fitnessChange: { label: 'Fitness Change', description: 'Gym membership, fitness equipment, health supplements', icon: '💪' },
        transportationChange: { label: 'Transportation Change', description: 'Shift between car, transit, and rideshare usage', icon: '🚗' },
        entertainmentShift: { label: 'Entertainment Shift', description: 'More streaming subscriptions, less going out', icon: '🎬' }
      },
      externalFactors: {
        inflation: { label: 'Inflation Adjustments', description: 'Increased costs for groceries, utilities, and general goods', icon: '📈' },
        interestRates: { label: 'Interest Rate Changes', description: 'Adjusted loan payments and credit card interest', icon: '💰' },
        seasonalAdjustments: { label: 'Seasonal Patterns', description: 'Higher utilities in summer/winter, holiday spending', icon: '🌡️' },
        socialTrends: { label: 'Social Trends', description: 'New subscription services, travel recovery', icon: '📱' },
        economicConditions: { label: 'Economic Conditions', description: 'Adjusted discretionary spending based on economic outlook', icon: '🌍' }
      }
    };
    
    return displayInfo[category]?.[key] || { label: key, description: 'Adjustment detected', icon: '⚙️' };
  };

  // Handle adjustment toggle (persistent highlighting)
  const handleAdjustmentToggle = (adjustmentKey: string) => {
    setToggledAdjustments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(adjustmentKey)) {
        newSet.delete(adjustmentKey);
      } else {
        newSet.add(adjustmentKey);
      }
      console.log('🔄 [Client] Toggled adjustment:', adjustmentKey, 'Active toggles:', Array.from(newSet));
      return newSet;
    });
  };

  // Get the currently active adjustment (either hovered or toggled)
  const getActiveAdjustment = (): string | null => {
    // Hover takes precedence over toggle for immediate feedback
    if (highlightedAdjustment) return highlightedAdjustment;
    // If multiple adjustments are toggled, show the first one (could be enhanced to show all)
    if (toggledAdjustments.size > 0) return Array.from(toggledAdjustments)[0];
    return null;
  };

  const hasAnyAdjustments = (adjustments: DetectedAdjustments): boolean => {
    const hasLifeEvents = Object.values(adjustments.lifeEvents || {}).some(active => active);
    const hasBehavioralChanges = Object.values(adjustments.behavioralChanges || {}).some(active => active);
    const hasExternalFactors = Object.values(adjustments.externalFactors || {}).some(active => active);
    
    return hasLifeEvents || hasBehavioralChanges || hasExternalFactors;
  };

  const handleTestingMode = async () => {
    setHasConnectedData(true);
    setIsAnalyzing(true);
    setAnalysisError(null);
    
    try {
      await analyzeDataWithLLM(null, null, true); // Always use testing mode for test button
    } catch (error) {
      console.error('Error in testing mode:', error);
      setAnalysisError('Failed to load testing data. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDataUploaded = async (transactionFile: File | null, debtFile: File | null) => {
    console.log('📁 [Upload] Processing uploaded files:', {
      transactionFile: transactionFile ? {
        name: transactionFile.name,
        size: transactionFile.size,
        type: transactionFile.type
      } : null,
      debtFile: debtFile ? {
        name: debtFile.name,
        size: debtFile.size,
        type: debtFile.type
      } : null
    });

    setUploadedFiles({
      transactions: transactionFile,
      debt: debtFile,
    });
    setHasConnectedData(true);
    setIsModalOpen(false);
    setIsAnalyzing(true);
    setAnalysisError(null);
    
    try {
      console.log('🔄 [Upload] Starting analysis with uploaded data (testing mode: false)');
      await analyzeDataWithLLM(transactionFile, debtFile, false); // Always use real data when uploading files
    } catch (error) {
      console.error('❌ [Upload] Error analyzing uploaded data:', error);
      setAnalysisError('Failed to analyze your financial data. Please try again.');
      // Fall back to simple data generation
      generateFallbackData(transactionFile, debtFile);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const analyzeDataWithLLM = async (transactionFile: File | null, debtFile: File | null, testingMode: boolean = false) => {
    const startTime = Date.now();
    console.log('🚀 [Client] Starting LLM analysis...', {
      testingMode,
      hasTransactionFile: !!transactionFile,
      hasDebtFile: !!debtFile,
      transactionFileName: transactionFile?.name,
      debtFileName: debtFile?.name
    });
    
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
          sampleRecord: transactionData[0],
          dateRange: transactionData.length > 0 ? {
            first: transactionData[0]?.transaction_date,
            last: transactionData[transactionData.length - 1]?.transaction_date
          } : null,
          totalAmount: transactionData.reduce((sum, t) => sum + t.amount, 0).toFixed(2),
          categories: [...new Set(transactionData.map(t => t.category))].slice(0, 5)
        });
        
        if (transactionData.length === 0) {
          throw new Error('No valid transactions found in the uploaded file. Please check the file format.');
        }
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
          sampleRecord: debtData[0],
          totalDebt: debtData.reduce((sum, d) => sum + d.current_balance, 0).toFixed(2),
          totalMinPayments: debtData.reduce((sum, d) => sum + d.minimum_payment, 0).toFixed(2),
          accountTypes: [...new Set(debtData.map(d => d.account_type))]
        });
      }

      // Prepare request data (no need to send adjustments, API will detect them)
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
      const analysis: LLMAnalysis & { detectedAdjustments?: DetectedAdjustments } = await response.json();
      
      console.log('✅ [Client] Analysis received:', {
        simulatedTransactions: analysis.simulatedTransactions?.length || 0,
        insights: !!analysis.insights,
        summary: !!analysis.summary,
        projectedTotalIncome: analysis.summary?.projectedTotalIncome,
        projectedTotalExpenses: analysis.summary?.projectedTotalExpenses,
        detectedAdjustments: !!analysis.detectedAdjustments
      });

      setLlmAnalysis(analysis);
      
      // Store detected adjustments
      if (analysis.detectedAdjustments) {
        setDetectedAdjustments(analysis.detectedAdjustments);
        console.log('🔍 [Client] Detected adjustments:', analysis.detectedAdjustments);
      }

      // Convert LLM analysis to graph data - plot individual transaction amounts
      console.log('📈 [Client] Converting analysis to graph data...');
      
      // Sort transactions by date first
      const sortedTransactions = [...analysis.simulatedTransactions].sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      // Identify recurring patterns in the transactions
      const transactionsWithRecurringAnalysis = identifyRecurringTransactions(sortedTransactions);

      // Create adjustment lookup for transaction metadata
      const adjustmentLookup = new Map<number, { adjustment: string; category: string }>();
      if (analysis.detectedAdjustments?.transactionMetadata) {
        analysis.detectedAdjustments.transactionMetadata.forEach(metadata => {
          metadata.transactionIndices.forEach(index => {
            adjustmentLookup.set(index, {
              adjustment: metadata.adjustment,
              category: metadata.category
            });
          });
        });
        console.log('🏷️ [Client] Created adjustment lookup with', adjustmentLookup.size, 'entries');
      }

      // Create graph data with both individual and cumulative amounts
      let cumulativeTotal = 0; // Start from 0
      const graphData: DataPoint[] = transactionsWithRecurringAnalysis
        .filter(transaction => transaction && transaction.date && transaction.amount !== undefined)
        .map((transaction, index) => {
          cumulativeTotal += Math.abs(transaction.amount); // Add absolute value of transaction amount
          
          const adjustmentInfo = adjustmentLookup.get(index);
          
          return {
            time: new Date(transaction.date),
            amount: Math.abs(transaction.amount), // Individual transaction amount (absolute value)
            cumulativeBalance: cumulativeTotal, // Running total of absolute amounts
            originalAmount: transaction.amount, // Keep original for reference
            description: transaction.description || 'Transaction',
            category: transaction.category || 'Uncategorized',
            confidence: transaction.confidence || 0,
            isRecurring: transaction.isRecurring || false,
            type: transaction.type || 'Debit',
            recurringGroup: transaction.recurringGroup,
            adjustmentType: adjustmentInfo?.adjustment,
            adjustmentCategory: adjustmentInfo?.category
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
        cumulativeRange: {
          start: 0,
          end: graphData[graphData.length - 1]?.cumulativeBalance,
          max: Math.max(...graphData.map(d => d.cumulativeBalance || 0))
        },
        transactionTypes: {
          income: graphData.filter(d => d.type === 'Credit').length,
          expenses: graphData.filter(d => d.type === 'Debit').length
        }
      });

      // Start the animation instead of setting graph data directly
      console.log('🎬 [Client] About to start animation with', graphData.length, 'transactions');
      setGraphData([]); // Clear existing data
      animateTransactions(graphData);

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

  const generateFallbackData = (transactionFile: File | null, _debtFile: File | null) => {
    // Fallback to simple data generation if LLM fails
    const data: DataPoint[] = [];
    const startDate = new Date(2024, 0, 1);
    let cumulativeTotal = 0;

    for (let i = 0; i < 12; i++) {
      const date = new Date(startDate);
      date.setMonth(date.getMonth() + i);
      
      const monthlySpending = transactionFile ? 
        Math.random() * 2000 + 500 :
        Math.random() * 1500 + 300;
      
      cumulativeTotal += monthlySpending;
      
      data.push({
        time: date,
        amount: monthlySpending,
        cumulativeBalance: cumulativeTotal,
        originalAmount: -monthlySpending,
        description: `Monthly Spending ${i + 1}`,
        category: 'General',
        confidence: 0.5,
        isRecurring: false,
        type: 'Debit'
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
                  : isAnimating
                  ? `Simulating transactions in real-time... (${animatedData.length}/${fullData.length})`
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
                onClick={handleGenerateTestData}
                disabled={isAnalyzing}
                className="inline-flex items-center px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Quick Test
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
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-green-800">
                    Data Connected Successfully
                  </p>
                  <p className="text-sm text-green-700">
                    {uploadedFiles.transactions && `Transaction data: ${uploadedFiles.transactions.name}`}
                    {uploadedFiles.transactions && uploadedFiles.debt && ' • '}
                    {uploadedFiles.debt && `Debt data: ${uploadedFiles.debt.name}`}
                  </p>
                  {isAnimating && (
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-green-600 mb-1">
                        <span>Processing transactions...</span>
                        <span>{animatedData.length}/{fullData.length}</span>
                      </div>
                      <div className="w-full bg-green-200 rounded-full h-2">
                        <div 
                          className="bg-green-600 h-2 rounded-full transition-all duration-100"
                          style={{ width: `${(animatedData.length / fullData.length) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
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
          {isAnalyzing && !hasConnectedData ? (
            /* Loading State - only show when no data is connected yet */
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
              {/* Detected Adjustments Section */}
              {detectedAdjustments && hasAnyAdjustments(detectedAdjustments) && (
                <section className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
                  <h2 className="text-xl font-semibold text-gray-800 mb-4">
                    Detected Simulation Adjustments
                  </h2>
                  <p className="text-gray-600 mb-6">
                    Based on your transaction history, we&apos;ve detected the following factors affecting your spending simulation.
                  </p>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Life Events */}
                    {Object.entries(detectedAdjustments.lifeEvents || {}).filter(([, active]) => active).length > 0 && (
                      <div className="space-y-4">
                        <h3 className="font-semibold text-gray-800 flex items-center">
                          <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Life Events
                        </h3>
                        <div className="space-y-3">
                          {Object.entries(detectedAdjustments.lifeEvents || {})
                            .filter(([, active]) => active)
                            .map(([key]) => {
                              const info = getAdjustmentDisplayInfo('lifeEvents', key);
                              const isToggled = toggledAdjustments.has(key);
                              return (
                                <div 
                                  key={key} 
                                  className={`flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                                    isToggled 
                                      ? 'bg-blue-200 border-blue-400 shadow-md ring-2 ring-blue-300' 
                                      : 'bg-blue-50 border-blue-200 hover:bg-blue-100'
                                  }`}
                                  onMouseEnter={() => setHighlightedAdjustment(key)}
                                  onMouseLeave={() => setHighlightedAdjustment(null)}
                                  onClick={() => handleAdjustmentToggle(key)}
                                >
                                  <div className="flex items-center space-x-2">
                                    <span className="text-lg">{info.icon}</span>
                                    {isToggled && (
                                      <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                                    )}
                                  </div>
                                  <div className="flex-1">
                                    <div className={`font-medium ${isToggled ? 'text-blue-950' : 'text-blue-900'}`}>
                                      {info.label}
                                      {isToggled && <span className="ml-2 text-xs bg-blue-600 text-white px-2 py-1 rounded-full">ACTIVE</span>}
                                    </div>
                                    <div className={`text-sm ${isToggled ? 'text-blue-800' : 'text-blue-700'}`}>
                                      {info.description}
                                    </div>
                                    <div className="text-xs text-blue-600 mt-1">
                                      {isToggled ? 'Click to hide in graph' : 'Click to highlight in graph'}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}

                    {/* Behavioral Changes */}
                    {Object.entries(detectedAdjustments.behavioralChanges || {}).filter(([, active]) => active).length > 0 && (
                      <div className="space-y-4">
                        <h3 className="font-semibold text-gray-800 flex items-center">
                          <svg className="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                          Behavioral Changes
                        </h3>
                        <div className="space-y-3">
                          {Object.entries(detectedAdjustments.behavioralChanges || {})
                            .filter(([, active]) => active)
                            .map(([key]) => {
                              const info = getAdjustmentDisplayInfo('behavioralChanges', key);
                              const isToggled = toggledAdjustments.has(key);
                              return (
                                <div 
                                  key={key} 
                                  className={`flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                                    isToggled 
                                      ? 'bg-green-200 border-green-400 shadow-md ring-2 ring-green-300' 
                                      : 'bg-green-50 border-green-200 hover:bg-green-100'
                                  }`}
                                  onMouseEnter={() => setHighlightedAdjustment(key)}
                                  onMouseLeave={() => setHighlightedAdjustment(null)}
                                  onClick={() => handleAdjustmentToggle(key)}
                                >
                                  <div className="flex items-center space-x-2">
                                    <span className="text-lg">{info.icon}</span>
                                    {isToggled && (
                                      <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
                                    )}
                                  </div>
                                  <div className="flex-1">
                                    <div className={`font-medium ${isToggled ? 'text-green-950' : 'text-green-900'}`}>
                                      {info.label}
                                      {isToggled && <span className="ml-2 text-xs bg-green-600 text-white px-2 py-1 rounded-full">ACTIVE</span>}
                                    </div>
                                    <div className={`text-sm ${isToggled ? 'text-green-800' : 'text-green-700'}`}>
                                      {info.description}
                                    </div>
                                    <div className="text-xs text-green-600 mt-1">
                                      {isToggled ? 'Click to hide in graph' : 'Click to highlight in graph'}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}

                    {/* External Factors */}
                    {Object.entries(detectedAdjustments.externalFactors || {}).filter(([, active]) => active).length > 0 && (
                      <div className="space-y-4">
                        <h3 className="font-semibold text-gray-800 flex items-center">
                          <svg className="w-5 h-5 mr-2 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          External Factors
                        </h3>
                        <div className="space-y-3">
                          {Object.entries(detectedAdjustments.externalFactors || {})
                            .filter(([, active]) => active)
                            .map(([key]) => {
                              const info = getAdjustmentDisplayInfo('externalFactors', key);
                              const isToggled = toggledAdjustments.has(key);
                              return (
                                <div 
                                  key={key} 
                                  className={`flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                                    isToggled 
                                      ? 'bg-orange-200 border-orange-400 shadow-md ring-2 ring-orange-300' 
                                      : 'bg-orange-50 border-orange-200 hover:bg-orange-100'
                                  }`}
                                  onMouseEnter={() => setHighlightedAdjustment(key)}
                                  onMouseLeave={() => setHighlightedAdjustment(null)}
                                  onClick={() => handleAdjustmentToggle(key)}
                                >
                                  <div className="flex items-center space-x-2">
                                    <span className="text-lg">{info.icon}</span>
                                    {isToggled && (
                                      <div className="w-2 h-2 bg-orange-600 rounded-full animate-pulse"></div>
                                    )}
                                  </div>
                                  <div className="flex-1">
                                    <div className={`font-medium ${isToggled ? 'text-orange-950' : 'text-orange-900'}`}>
                                      {info.label}
                                      {isToggled && <span className="ml-2 text-xs bg-orange-600 text-white px-2 py-1 rounded-full">ACTIVE</span>}
                                    </div>
                                    <div className={`text-sm ${isToggled ? 'text-orange-800' : 'text-orange-700'}`}>
                                      {info.description}
                                    </div>
                                    <div className="text-xs text-orange-600 mt-1">
                                      {isToggled ? 'Click to hide in graph' : 'Click to highlight in graph'}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Show message if no adjustments detected */}
                  {(!detectedAdjustments.lifeEvents || Object.values(detectedAdjustments.lifeEvents).every(v => !v)) &&
                   (!detectedAdjustments.behavioralChanges || Object.values(detectedAdjustments.behavioralChanges).every(v => !v)) &&
                   (!detectedAdjustments.externalFactors || Object.values(detectedAdjustments.externalFactors).every(v => !v)) && (
                    <div className="text-center py-8">
                      <div className="text-gray-500 mb-2">
                        <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <p className="text-gray-600">
                        No specific life events or behavioral changes detected. Using standard spending patterns with inflation and seasonal adjustments.
                      </p>
                    </div>
                  )}
                </section>
              )}

              {/* Graph Section */}
              <section className="bg-gray-50 rounded-lg p-6">
                                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-800">
                      Your Spending Projection
                    </h2>
                    {toggledAdjustments.size > 0 && (
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-sm text-gray-600">Highlighting:</span>
                        {Array.from(toggledAdjustments).map(adjustment => {
                          const info = getAdjustmentDisplayInfo('', adjustment);
                          return (
                            <span 
                              key={adjustment}
                              className="inline-flex items-center space-x-1 px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                            >
                              <span>{info.icon}</span>
                              <span>{info.label}</span>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-6">
                    {/* Animation Controls */}
                    {(isAnimating || fullData.length > 0) && (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={togglePause}
                          disabled={!isAnimating}
                          className="p-1 rounded-full bg-blue-100 hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isPaused ? (
                            <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          )}
                        </button>
                        <button
                          onClick={skipToEnd}
                          disabled={!isAnimating}
                          className="px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Skip
                        </button>
                      </div>
                    )}
                    
                    {/* View Toggle */}
                    <div className="flex items-center space-x-6">
                      <div className="flex items-center space-x-3">
                        <span className="text-sm text-gray-600">Individual</span>
                        <button
                          onClick={() => setIsCumulative(!isCumulative)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                            isCumulative ? 'bg-blue-600' : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              isCumulative ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                        <span className="text-sm text-gray-600">Cumulative</span>
                      </div>

                      {/* Adjustment Data Points Toggle */}
                      {toggledAdjustments.size > 0 && (
                        <div className="flex items-center space-x-3 border-l border-gray-300 pl-6">
                          <span className="text-sm text-gray-600">Hide Adjustments</span>
                          <button
                            onClick={() => setShowAdjustmentDataPoints(!showAdjustmentDataPoints)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${
                              showAdjustmentDataPoints ? 'bg-orange-600' : 'bg-gray-200'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                showAdjustmentDataPoints ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                          <span className="text-sm text-gray-600">Show Adjustments</span>
                        </div>
                      )}
                      
                      <div className="flex items-center space-x-4">
                        <span className="text-sm text-gray-600 font-medium">Filter:</span>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={showRecurringOnly}
                            onChange={(e) => {
                              setShowRecurringOnly(e.target.checked);
                              if (e.target.checked) setShowOneTimeOnly(false);
                            }}
                            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                          />
                          <span className="text-sm text-green-700">Recurring Only</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={showOneTimeOnly}
                            onChange={(e) => {
                              setShowOneTimeOnly(e.target.checked);
                              if (e.target.checked) setShowRecurringOnly(false);
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-blue-700">One-time Only</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="w-full overflow-x-auto">
                  {(() => {
                    const baseData = isAnimating ? animatedData : (fullData.length > 0 ? fullData : graphData);
                    const currentData = getFilteredData(baseData);
                    console.log('📊 [Main] Passing data to graph:', {
                      isAnimating,
                      animatedDataLength: animatedData.length,
                      fullDataLength: fullData.length,
                      graphDataLength: graphData.length,
                      baseDataLength: baseData.length,
                      filteredDataLength: currentData.length,
                      isCumulative,
                      showRecurringOnly,
                      showOneTimeOnly,
                      sampleCurrentData: currentData.slice(0, 2)
                    });
                    return (
                  <SpendingSimulationGraph
                        data={currentData}
                        width={1200}
                        height={500}
                        className="w-full min-w-full"
                        isCumulative={isCumulative}
                        highlightedAdjustment={highlightedAdjustment}
                        toggledAdjustments={toggledAdjustments}
                        showAdjustmentDataPoints={showAdjustmentDataPoints}
                      />
                    );
                  })()}
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
                      {isAnimating ? animatedData.length : (llmAnalysis?.insights.totalPredictedTransactions || fullData.length || graphData.length)}
                    </div>
                    <div className="text-sm text-blue-800">
                      {isAnimating ? 'Processed Transactions' : 'Predicted Transactions'}
                    </div>
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
