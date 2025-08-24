import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { processTransactionsWithRewards, getOptimizationSummary } from '../../../utils/cardOptimization';
import cardDetails from '../../../../card-details/top-8-common-cards.json';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log('🚀 [API] Starting spending analysis request');
  
  try {
    const { transactionData, debtData, isTesting = false, simulationAdjustments } = await request.json();
    
    console.log('📊 [API] Received data:', {
      transactionCount: transactionData?.length || 0,
      debtCount: debtData?.length || 0,
      hasTransactionData: !!transactionData,
      hasDebtData: !!debtData,
      isTesting: isTesting
    });

    if (!transactionData && !debtData && !isTesting) {
      console.log('❌ [API] No data provided for analysis');
      return NextResponse.json(
        { error: 'No data provided for analysis' },
        { status: 400 }
      );
    }

    // Testing mode: Use existing CSV file instead of calling LLM
    if (isTesting) {
      console.log('🧪 [API] Testing mode enabled - using existing CSV file');
      try {
        const simulatedTransactions = await readExistingCSV();
        const analysis = createMockAnalysis(simulatedTransactions);
        
        const totalDuration = Date.now() - startTime;
        console.log('🎉 [API] Testing mode completed successfully in', totalDuration, 'ms');
        
        // For testing mode, use minimal adjustments (only if detected)
        const testingAdjustments = {
          lifeEvents: {},
          behavioralChanges: { dietaryShift: true }, // Example: show dietary shift in test mode
          externalFactors: {}
        };
        
        // Add detected adjustments to the response
        const responseWithAdjustments = {
          ...analysis,
          detectedAdjustments: testingAdjustments
        };

        return NextResponse.json(responseWithAdjustments);
      } catch (testingError) {
        console.error('❌ [API] Testing mode failed:', testingError);
        console.log('🔄 [API] Falling back to generating new transactions');
        // Fall through to normal processing with generated fallback data
      }
    }

    // Log sample data for debugging
    if (transactionData && transactionData.length > 0) {
      console.log('💳 [API] Sample transaction data:', {
        firstTransaction: transactionData[0],
        totalAmount: transactionData.reduce((sum: number, t: { amount?: number }) => sum + (t.amount || 0), 0),
        dateRange: {
          first: transactionData[0]?.transaction_date,
          last: transactionData[transactionData.length - 1]?.transaction_date
        }
      });
    }

    if (debtData && debtData.length > 0) {
      console.log('💳 [API] Sample debt data:', {
        firstDebt: debtData[0],
        totalDebt: debtData.reduce((sum: number, d: { current_balance?: number }) => sum + (d.current_balance || 0), 0)
      });
    }

    // Detect which adjustments should be applied based on data analysis
    console.log('🔍 [API] Detecting simulation adjustments from transaction data...');
    const detectedAdjustments = detectSimulationAdjustments(transactionData, debtData);
    
    // Use detected adjustments instead of user-provided ones for more accurate simulation
    const adjustmentsToUse = detectedAdjustments;

    // Prepare data summary for the LLM
    console.log('📝 [API] Creating analysis prompt...');
    const prompt = createAnalysisPrompt(transactionData, debtData, adjustmentsToUse);
    
    // Estimate token count (rough approximation: 1 token ≈ 4 characters for English text)
    const estimatedTokens = Math.ceil(prompt.length / 4);
    
    console.log('📏 [API] Prompt statistics:', {
      characters: prompt.length,
      estimatedTokens: estimatedTokens,
      estimatedCost: `~$${(estimatedTokens * 0.0025 / 1000).toFixed(4)}` // GPT-4o input pricing
    });
    
    console.log('📏 [API] Prompt length:', prompt.length, 'characters');
    console.log('🔍 [API] Prompt preview (first 500 chars):', prompt.substring(0, 500) + '...');

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ [API] OpenAI API key not configured');
      throw new Error('OpenAI API key not configured');
    }

    console.log('🤖 [API] Calling OpenAI API...');
    const apiCallStart = Date.now();
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a financial analyst AI that analyzes spending patterns and creates realistic spending projections. CRITICAL: When asked to generate 100-150 transactions, you MUST generate the COMPLETE list of 100-150 transactions, NOT just 20-30 samples. You must respond with valid JSON only, no additional text."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_completion_tokens: 16384,
    });

    const apiCallDuration = Date.now() - apiCallStart;
    console.log('✅ [API] OpenAI API call completed in', apiCallDuration, 'ms');
    
    console.log('📊 [API] OpenAI response metadata:', {
      model: completion.model,
      usage: completion.usage,
      finishReason: completion.choices[0]?.finish_reason,
      responseLength: completion.choices[0]?.message?.content?.length || 0
    });
    
    // Log detailed token usage and costs
    if (completion.usage) {
      const inputTokens = completion.usage.prompt_tokens || 0;
      const outputTokens = completion.usage.completion_tokens || 0;
      const totalTokens = completion.usage.total_tokens || 0;
      
      // GPT-4o pricing (as of 2024): $0.0025/1K input tokens, $0.01/1K output tokens
      const inputCost = (inputTokens * 0.0025) / 1000;
      const outputCost = (outputTokens * 0.01) / 1000;
      const totalCost = inputCost + outputCost;
      
      console.log('💰 [API] Token usage and costs:', {
        inputTokens: inputTokens.toLocaleString(),
        outputTokens: outputTokens.toLocaleString(),
        totalTokens: totalTokens.toLocaleString(),
        inputCost: `$${inputCost.toFixed(4)}`,
        outputCost: `$${outputCost.toFixed(4)}`,
        totalCost: `$${totalCost.toFixed(4)}`,
        estimatedVsActual: `Estimated: ${estimatedTokens.toLocaleString()} vs Actual: ${inputTokens.toLocaleString()}`
      });
    }

    const analysisResult = completion.choices[0].message.content;
    
    if (!analysisResult) {
      console.error('❌ [API] No analysis result from OpenAI');
      throw new Error('No analysis result from OpenAI');
    }

    console.log('📄 [API] Raw OpenAI response preview (first 500 chars):', 
      analysisResult.substring(0, 500) + '...');
    console.log('📄 [API] Raw OpenAI response preview (last 500 chars):', 
      '...' + analysisResult.substring(analysisResult.length - 500));

    // Parse the JSON response
    console.log('🔄 [API] Parsing JSON response...');
    let analysis;
    try {
      // Clean the response to remove any comments or invalid JSON
      let cleanedResponse = analysisResult.trim();
      
      // Remove markdown code blocks if present
      cleanedResponse = cleanedResponse.replace(/```json\s*/g, '');
      cleanedResponse = cleanedResponse.replace(/```\s*/g, '');
      
      // Remove JavaScript-style comments
      cleanedResponse = cleanedResponse.replace(/\/\/.*$/gm, '');
      cleanedResponse = cleanedResponse.replace(/\/\*[\s\S]*?\*\//g, '');
      
      // Remove any trailing commas before closing brackets/braces
      cleanedResponse = cleanedResponse.replace(/,(\s*[}\]])/g, '$1');
      
      // Try to find and extract just the JSON object
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedResponse = jsonMatch[0];
      }
      
      // Additional cleaning for common LLM response issues
      cleanedResponse = cleanedResponse.replace(/^[^{]*/, ''); // Remove text before first {
      if (!cleanedResponse.endsWith('}')) {
        const lastBraceIndex = cleanedResponse.lastIndexOf('}');
        if (lastBraceIndex !== -1) {
          cleanedResponse = cleanedResponse.substring(0, lastBraceIndex + 1);
        }
      }
      
      console.log('🧹 [API] Cleaned response length:', cleanedResponse.length);
      console.log('🧹 [API] Cleaned response starts with:', cleanedResponse.substring(0, 50));
      console.log('🧹 [API] Cleaned response ends with:', cleanedResponse.substring(cleanedResponse.length - 50));
      
      analysis = JSON.parse(cleanedResponse);
      console.log('✅ [API] JSON parsing successful');
      console.log('📈 [API] Analysis summary:', {
        simulatedTransactionsCount: analysis.simulatedTransactions?.length || 0,
        recurringTransactionsCount: analysis.patterns?.recurringTransactions?.length || 0,
        significantTransactionsCount: analysis.patterns?.significantTransactions?.length || 0,
        seasonalPatternsCount: analysis.patterns?.seasonalPatterns?.length || 0,
        recommendationsCount: analysis.insights?.recommendations?.length || 0,
        totalPredictedTransactions: analysis.insights?.totalPredictedTransactions || 0,
        topLevelKeys: Object.keys(analysis)
      });
      
      // Debug the structure of simulated transactions
      if (analysis.simulatedTransactions && analysis.simulatedTransactions.length > 0) {
        console.log('🔍 [API] First transaction structure:', JSON.stringify(analysis.simulatedTransactions[0], null, 2));
        console.log('🔍 [API] Transaction validation:', {
          hasDate: !!analysis.simulatedTransactions[0].date,
          hasDescription: !!analysis.simulatedTransactions[0].description,
          hasAmount: !!analysis.simulatedTransactions[0].amount,
          dateValue: analysis.simulatedTransactions[0].date,
          amountValue: analysis.simulatedTransactions[0].amount
        });
      } else {
        console.log('⚠️ [API] No simulatedTransactions found in parsed response');
        console.log('🔍 [API] Full analysis object keys:', Object.keys(analysis));
        console.log('🔍 [API] Analysis object preview:', JSON.stringify(analysis, null, 2).substring(0, 1000) + '...');
      }

      // Log first few simulated transactions for debugging
      if (analysis.simulatedTransactions && analysis.simulatedTransactions.length > 0) {
        console.log('📝 [API] First 5 simulated transactions:');
        analysis.simulatedTransactions.slice(0, 5).forEach((transaction: FallbackTransaction, index: number) => {
          console.log(`  ${index + 1}. ${transaction.date}: ${transaction.description} - $${transaction.amount} (${transaction.category})`);
        });
        
        if (analysis.simulatedTransactions.length > 5) {
          console.log(`  ... and ${analysis.simulatedTransactions.length - 5} more transactions`);
        }
      } else {
        console.error('❌ [API] No simulated transactions found in analysis!');
      }
    } catch (parseError) {
      console.error('❌ [API] JSON parsing failed:', parseError);
      console.error('📄 [API] Raw response that failed to parse:', analysisResult);
      
      // Try to extract partial data or create fallback
      console.log('🔄 [API] Attempting to create fallback analysis due to JSON parse error');
      
             // Create a basic fallback analysis
       const fallbackTransactions = generateFallbackTransactions(transactionData, debtData, detectedAdjustments);
       analysis = createMockAnalysis(fallbackTransactions);
      
      console.log('✅ [API] Created fallback analysis with', fallbackTransactions.length, 'transactions');
    }

    const totalDuration = Date.now() - startTime;
    console.log('🎉 [API] Analysis completed successfully in', totalDuration, 'ms');

    // Check if we have enough transactions, if not, generate fallback data
    const transactionCount = analysis.simulatedTransactions?.length || 0;
    const hasValidTransactions = analysis.simulatedTransactions && 
      Array.isArray(analysis.simulatedTransactions) && 
      transactionCount > 0;
    
    console.log('🔍 [API] Transaction validation check:', {
      hasSimulatedTransactions: !!analysis.simulatedTransactions,
      isArray: Array.isArray(analysis.simulatedTransactions),
      transactionCount: transactionCount,
      hasValidTransactions: hasValidTransactions,
      threshold: 75
    });
    
    if (!hasValidTransactions || transactionCount < 75) {
      console.log(`⚠️ [API] Insufficient transactions generated (${transactionCount}/75 minimum), creating fallback data`);
      console.log('🔍 [API] Fallback reason:', {
        noTransactions: !analysis.simulatedTransactions,
        notArray: !Array.isArray(analysis.simulatedTransactions),
        tooFew: transactionCount < 75,
        actualCount: transactionCount
      });
      analysis.simulatedTransactions = generateFallbackTransactions(transactionData, debtData, detectedAdjustments);
      console.log(`📊 [API] Generated ${analysis.simulatedTransactions.length} fallback transactions`);
    } else {
      console.log(`✅ [API] Using LLM-generated transactions (${transactionCount} transactions)`);
    }

    // Process transactions with reward optimization
    console.log('🎯 [API] Processing transactions with reward optimization...');
    const optimizedTransactions = processTransactionsWithRewards(analysis.simulatedTransactions);
    const optimizationSummary = getOptimizationSummary(optimizedTransactions);
    
    console.log('📊 [API] Optimization summary:', {
      totalOptimalPoints: optimizationSummary.totalOptimalPoints.toFixed(0),
      totalActualPoints: optimizationSummary.totalActualPoints.toFixed(0),
      pointsLost: optimizationSummary.pointsLost.toFixed(0),
      optimizationRate: optimizationSummary.optimizationRate.toFixed(1) + '%',
      nonOptimalTransactions: `${optimizationSummary.nonOptimalTransactions}/${optimizationSummary.totalTransactions}`
    });

    // Update analysis with optimized transactions
    analysis.simulatedTransactions = optimizedTransactions;

    // Analyze card opening milestones
    console.log('🎯 [API] Analyzing card opening milestones...');
    const cardMilestones = analyzeCardOpeningMilestones(optimizedTransactions as FallbackTransaction[]);
    
    console.log('📊 [API] Milestone summary:', {
      totalMilestones: cardMilestones.length,
      avgConfidence: cardMilestones.length > 0 ? 
        (cardMilestones.reduce((sum, m) => sum + m.confidence, 0) / cardMilestones.length).toFixed(2) : 'N/A',
      dateRange: cardMilestones.length > 0 ? 
        `${cardMilestones[0].date} to ${cardMilestones[cardMilestones.length - 1].date}` : 'N/A'
    });

    // Export simulated transactions to CSV
    try {
      await exportTransactionsToCSV(analysis.simulatedTransactions);
      console.log('📄 [API] Transactions exported to CSV successfully');
    } catch (exportError) {
      console.error('❌ [API] Failed to export transactions to CSV:', exportError);
    }

    // Add detected adjustments, optimization data, and milestones to the response
    const responseWithAdjustments = {
      ...analysis,
      detectedAdjustments: detectedAdjustments,
      optimizationSummary: optimizationSummary,
      cardMilestones: cardMilestones
    };

    return NextResponse.json(responseWithAdjustments);
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    console.error('💥 [API] Error analyzing spending after', totalDuration, 'ms:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error
    });
    
    return NextResponse.json(
      { 
        error: 'Failed to analyze spending data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

interface TransactionDataInput {
  transaction_date?: string;
  post_date?: string;
  description?: string;
  category?: string;
  type?: string;
  amount?: number;
  memo?: string;
}

interface DebtDataInput {
  account_type?: string;
  account_name?: string;
  current_balance?: number;
  credit_limit?: number;
  original_amount?: number;
  interest_rate?: number;
  minimum_payment?: number;
  due_date?: string;
  payment_history?: string;
  account_status?: string;
}

interface SimulationAdjustments {
  lifeEvents?: Record<string, boolean>;
  behavioralChanges?: Record<string, boolean>;
  externalFactors?: Record<string, boolean>;
}

function createAnalysisPrompt(transactionData: TransactionDataInput[], debtData: DebtDataInput[], simulationAdjustments?: SimulationAdjustments): string {
  let prompt = `🚨 CRITICAL INSTRUCTION: YOU MUST GENERATE 100-150 INDIVIDUAL TRANSACTIONS 🚨

You are an expert financial analyst with deep understanding of spending patterns and behavioral economics. Analyze the following financial data and simulate individual CREDIT CARD transactions for the next 12 months using in-context learning from the provided examples.

⚠️ WARNING: DO NOT GENERATE ONLY 20-30 SAMPLE TRANSACTIONS. YOU MUST PROVIDE THE COMPLETE LIST OF 100-150 TRANSACTIONS.

IMPORTANT: Generate ONLY credit card transactions. Do not include:
- Salary deposits or income
- Rent payments or mortgage payments  
- Bank transfers or direct debits
- Loan payments or debt payments

CRITICAL CREDIT CARD REQUIREMENT:
- ALL simulated transactions MUST use either "AMEX_GOLD" or "AMEX_BLUE_CASH_PREFERRED" as the credit card
- Distribute transactions roughly 60% AMEX_GOLD and 40% AMEX_BLUE_CASH_PREFERRED
- Choose the card based on category optimization when possible (e.g., AMEX_GOLD for dining/grocery, AMEX_BLUE_CASH_PREFERRED for gas/streaming)

PATTERN RECOGNITION FRAMEWORK:
Use these examples to understand how to identify and simulate different spending patterns:

1. LIFE EVENTS (One-time or short-term pattern changes):
   Example: Recent Move
   - Historical pattern: Regular furniture store visits (IKEA $1,200, Home Depot $850, U-Haul $300)
   - Future simulation: Reduce furniture spending to normal levels, but increase home improvement spending
   
   Example: New Baby
   - Historical pattern: Sudden increase in healthcare ($200/month), childcare setup costs
   - Future simulation: Continue healthcare costs, add ongoing childcare expenses, baby supplies

   Example: Job Change/Graduation
   - Historical pattern: End of tuition payments, increase in professional clothing
   - Future simulation: Higher discretionary income, professional development expenses

2. BEHAVIORAL DRIFT (Gradual habit changes):
   Example: Dietary Shift
   - Historical pattern: Early period shows high restaurant spending, later period shows increased grocery spending
   - Future simulation: Continue the trend toward more grocery spending, less restaurant spending
   
   Example: Fitness Lifestyle Change
   - Historical pattern: New gym membership, fitness equipment purchases, supplement spending
   - Future simulation: Continue fitness-related expenses, potentially add new fitness activities

3. EXTERNAL FACTORS (Economic/social influences):
   Example: Inflation Impact
   - Historical pattern: Gradual increase in grocery, gas, utility costs
   - Future simulation: Apply 3-6% annual increases to essential categories
   
   Example: Social Trends
   - Historical pattern: New subscription services, increased travel spending
   - Future simulation: Continue trend adoption, seasonal travel patterns

CRITICAL: Return ONLY valid JSON. Do not include:
- Comments (// or /* */)
- Explanatory text before or after JSON
- Trailing commas
- Any text outside the JSON object
- Markdown code blocks or formatting

IMPORTANT: Your response must start with { and end with } - nothing else.

Return your response as valid JSON with this exact structure:

{
  "simulatedTransactions": [
    // MUST CONTAIN 100-150 TRANSACTIONS - DO NOT TRUNCATE THIS ARRAY
    {
      "date": "2024-07-05",
      "description": "Grocery Store",
      "amount": -127.43,
      "category": "Groceries",
      "account": "Credit Card",
      "type": "Debit",
      "confidence": 0.75,
      "isRecurring": false,
      "recurringPattern": null,
      "credit_card": "AMEX_GOLD"
    },
    {
      "date": "2024-07-08",
      "description": "Netflix",
      "amount": -15.99,
      "category": "Subscriptions",
      "account": "Credit Card",
      "type": "Debit",
      "confidence": 0.95,
      "isRecurring": true,
      "recurringPattern": "monthly",
      "credit_card": "AMEX_BLUE_CASH_PREFERRED"
    },
    {
      "date": "2024-07-12",
      "description": "Gas Station",
      "amount": -45.20,
      "category": "Transportation",
      "account": "Credit Card",
      "type": "Debit",
      "confidence": 0.70,
      "isRecurring": false,
      "recurringPattern": null,
      "credit_card": "AMEX_BLUE_CASH_PREFERRED"
    }
  ],
  "patterns": {
    "recurringTransactions": [
      {
        "description": "Netflix",
        "averageAmount": 15.99,
        "frequency": "monthly",
        "category": "Subscriptions",
        "confidence": 0.95,
        "nextOccurrence": "2024-08-08"
      },
      {
        "description": "Grocery Store",
        "averageAmount": 125.50,
        "frequency": "weekly",
        "category": "Groceries",
        "confidence": 0.80,
        "nextOccurrence": "2024-07-12"
      }
    ],
    "significantTransactions": [
      {
        "description": "Statistically significant purchase",
        "averageAmount": -200.00,
        "frequency": "irregular",
        "category": "Shopping",
        "lastOccurrence": "2024-03-15",
        "predictedNext": "2024-06-15"
      }
    ],
    "seasonalPatterns": [
      {
        "season": "summer",
        "category": "Utilities",
        "averageIncrease": 25.00,
        "reason": "Air conditioning costs"
      }
    ]
  },
  "insights": {
    "totalPredictedTransactions": 125,
    "recurringTransactionCount": 48,
    "averageTransactionAmount": -125.50,
    "primarySpendingCategories": ["Housing", "Groceries", "Transportation"],
    "spendingTrend": "stable",
    "riskFactors": ["Irregular large purchases"],
    "recommendations": ["Set up automatic savings", "Budget for seasonal variations"]
  },
  "summary": {
    "projectedTotalIncome": 54000,
    "projectedTotalExpenses": 48000,
    "projectedNetChange": 6000,
    "confidenceScore": 0.82
  }
}

`;

  if (transactionData && transactionData.length > 0) {
    prompt += `\nTRANSACTION DATA ANALYSIS:\n`;
    
    // Calculate summary statistics
    const totalTransactions = transactionData.length;
    const incomeTransactions = transactionData.filter(t => (t.amount || 0) > 0);
    const expenseTransactions = transactionData.filter(t => (t.amount || 0) < 0);
    
    const totalIncome = incomeTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    const totalExpenses = Math.abs(expenseTransactions.reduce((sum, t) => sum + (t.amount || 0), 0));
    
    // Get spending categories
    const categories = [...new Set(transactionData.map(t => t.category))];
    
    prompt += `- Total transactions: ${totalTransactions}\n`;
    prompt += `- Total income: $${totalIncome.toFixed(2)}\n`;
    prompt += `- Total expenses: $${totalExpenses.toFixed(2)}\n`;
    prompt += `- Spending categories: ${categories.join(', ')}\n`;
    
    // Include sample transactions and detailed analysis
    prompt += `- Sample transactions:\n`;
    transactionData.slice(0, 15).forEach(t => {
      prompt += `  ${t.transaction_date}: ${t.description} - $${t.amount} (${t.category}) [${t.type}]${t.memo ? ` - ${t.memo}` : ''}\n`;
    });

    // Add frequency analysis
    const categoryFrequency: { [key: string]: number } = {};
    transactionData.forEach(t => {
      if (t.category) {
        categoryFrequency[t.category] = (categoryFrequency[t.category] || 0) + 1;
      }
    });

    prompt += `\n- Category frequencies:\n`;
    Object.entries(categoryFrequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .forEach(([category, count]) => {
        prompt += `  ${category}: ${count} transactions\n`;
      });

    // Add merchant analysis
    const merchantFrequency: { [key: string]: number } = {};
    transactionData.forEach(t => {
      if (t.description) {
        const merchant = t.description.split(' ')[0]; // Get first word as merchant
        merchantFrequency[merchant] = (merchantFrequency[merchant] || 0) + 1;
      }
    });

    prompt += `\n- Common merchants:\n`;
    Object.entries(merchantFrequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 8)
      .forEach(([merchant, count]) => {
        prompt += `  ${merchant}: ${count} transactions\n`;
      });
  }

  if (debtData && debtData.length > 0) {
    prompt += `\nDEBT DATA ANALYSIS:\n`;
    
    const totalDebt = debtData.reduce((sum, d) => sum + (d.current_balance || 0), 0);
    const totalMinPayments = debtData.reduce((sum, d) => sum + (d.minimum_payment || 0), 0);
    
    prompt += `- Total debt: $${totalDebt.toFixed(2)}\n`;
    prompt += `- Total minimum payments: $${totalMinPayments.toFixed(2)}\n`;
    prompt += `- Debt accounts:\n`;
    
    debtData.forEach(d => {
      const accountType = d.account_type || 'Unknown';
      const balance = d.current_balance || 0;
      const rate = d.interest_rate || 0;
      prompt += `  ${accountType}: $${balance} at ${rate}% APR\n`;
    });
  }

  // Add simulation adjustments if provided
  if (simulationAdjustments) {
    prompt += `\nDETECTED PATTERNS & ADJUSTMENTS:\n`;
    prompt += `Based on the analysis of the historical data, apply these specific adjustments to future spending simulation:\n\n`;
    
    // Life Events
    const activeLifeEvents = Object.entries(simulationAdjustments.lifeEvents || {})
      .filter(([_, active]) => active)
      .map(([event, _]) => event);
    
    if (activeLifeEvents.length > 0) {
      prompt += `LIFE EVENTS (adjust spending patterns accordingly):\n`;
      activeLifeEvents.forEach(event => {
        switch(event) {
          case 'recentMove':
            prompt += `- Recent Move DETECTED: Historical data shows furniture/moving expenses. Future simulation should:\n`;
            prompt += `  * Reduce furniture spending to normal levels after initial setup period\n`;
            prompt += `  * Add ongoing home improvement and maintenance costs\n`;
            prompt += `  * Include utility setup and new service provider costs\n`;
            break;
          case 'newMarriage':
            prompt += `- New Marriage DETECTED: Historical data shows wedding-related expenses. Future simulation should:\n`;
            prompt += `  * Reduce wedding expenses to zero after the event\n`;
            prompt += `  * Increase joint household spending and shared activities\n`;
            prompt += `  * Add potential honeymoon and anniversary-related expenses\n`;
            break;
          case 'newBaby':
            prompt += `- New Baby DETECTED: Historical data shows childcare/medical increases. Future simulation should:\n`;
            prompt += `  * Continue and increase healthcare costs (+$200-400/month ongoing)\n`;
            prompt += `  * Add substantial childcare expenses ($800-2000/month)\n`;
            prompt += `  * Include ongoing baby supplies, clothing, and equipment costs\n`;
            break;
          case 'jobChange':
            prompt += `- Job Change DETECTED: Historical data shows employment transition. Future simulation should:\n`;
            prompt += `  * Adjust commuting costs based on new location\n`;
            prompt += `  * Modify lunch/coffee spending patterns\n`;
            prompt += `  * Include professional development and networking expenses\n`;
            break;
          case 'graduation':
            prompt += `- Graduation DETECTED: Historical data shows education completion. Future simulation should:\n`;
            prompt += `  * Eliminate all tuition and education-related expenses\n`;
            prompt += `  * Increase discretionary spending due to higher disposable income\n`;
            prompt += `  * Add professional wardrobe and career development costs\n`;
            break;
        }
      });
      prompt += `\n`;
    }
    
    // Behavioral Changes
    const activeBehavioralChanges = Object.entries(simulationAdjustments.behavioralChanges || {})
      .filter(([_, active]) => active)
      .map(([change, _]) => change);
    
    if (activeBehavioralChanges.length > 0) {
      prompt += `BEHAVIORAL CHANGES (modify spending patterns):\n`;
      activeBehavioralChanges.forEach(change => {
        switch(change) {
          case 'dietaryShift':
            prompt += `- Dietary Shift DETECTED: Historical data shows trend from eating out to cooking. Future simulation should:\n`;
            prompt += `  * Continue reducing restaurant/takeout spending by 30-50%\n`;
            prompt += `  * Increase grocery spending by 25-40% with focus on quality ingredients\n`;
            prompt += `  * Add cooking equipment and kitchen supply purchases\n`;
            break;
          case 'fitnessChange':
            prompt += `- Fitness Lifestyle DETECTED: Historical data shows new fitness focus. Future simulation should:\n`;
            prompt += `  * Continue gym membership costs ($50-150/month)\n`;
            prompt += `  * Add periodic fitness equipment and gear purchases\n`;
            prompt += `  * Include health supplements and nutrition-related expenses\n`;
            break;
          case 'transportationChange':
            prompt += `- Transportation Change DETECTED: Historical data shows mobility pattern shift. Future simulation should:\n`;
            prompt += `  * Adjust fuel costs based on new transportation method\n`;
            prompt += `  * Modify parking, tolls, and maintenance expenses accordingly\n`;
            prompt += `  * Include public transit passes or rideshare costs as appropriate\n`;
            break;
          case 'entertainmentShift':
            prompt += `- Entertainment Shift DETECTED: Historical data shows preference change. Future simulation should:\n`;
            prompt += `  * Reduce bar/club/event spending by 40-60%\n`;
            prompt += `  * Increase streaming services and home entertainment costs\n`;
            prompt += `  * Add home improvement for entertainment spaces\n`;
            break;
        }
      });
      prompt += `\n`;
    }
    
    // External Factors
    const activeExternalFactors = Object.entries(simulationAdjustments.externalFactors || {})
      .filter(([_, active]) => active)
      .map(([factor, _]) => factor);
    
    if (activeExternalFactors.length > 0) {
      prompt += `EXTERNAL FACTORS (apply economic adjustments):\n`;
      activeExternalFactors.forEach(factor => {
        switch(factor) {
          case 'inflation':
            prompt += `- Inflation: Increase grocery costs by 6%, utilities by 4%, general goods by 3%\n`;
            break;
          case 'interestRates':
            prompt += `- Interest Rates: Adjust loan payments and credit card interest based on rate changes\n`;
            break;
          case 'seasonalAdjustments':
            prompt += `- Seasonal Patterns: Higher utilities in summer/winter, holiday spending in December\n`;
            break;
          case 'socialTrends':
            prompt += `- Social Trends: Add new subscription services, increase travel spending to pre-COVID levels\n`;
            break;
          case 'economicConditions':
            prompt += `- Economic Conditions: Adjust discretionary spending based on economic outlook\n`;
            break;
        }
      });
      prompt += `\n`;
    }
  }

  prompt += `\nIMPORTANT: For each detected adjustment above, ensure you create SPECIFIC transactions that demonstrate the pattern. For example:
- If "Recent Move" is detected, include specific furniture store transactions, home improvement purchases, utility setup fees
- If "Dietary Shift" is detected, include specific grocery store transactions and reduced restaurant transactions
- If "New Baby" is detected, include specific pediatric visits, childcare payments, baby supply purchases

This ensures that when users click on adjustment cards, they will see the related transactions highlighted in the graph.

Based on this data and the above adjustments, simulate individual transactions for the next 12 months by:

1. IDENTIFYING PATTERNS FROM HISTORICAL DATA:
   - Find ALL recurring transactions (salary, rent, utilities, subscriptions, loan payments)
   - Calculate average amounts and frequencies for each recurring transaction
   - Detect seasonal patterns (higher utilities in summer/winter, holiday spending)
   - Identify statistically significant transactions (those that deviate significantly from typical spending patterns)
   - Analyze spending categories and their typical amounts and frequency

2. GENERATING COMPREHENSIVE TRANSACTIONS (MINIMUM 100 TRANSACTIONS):
   - Create monthly recurring transactions: salary (1x/month), rent (1x/month), utilities (1x/month)
   - Add weekly/bi-weekly transactions: groceries (4x/month), gas (2x/month), dining (8x/month)
   - Include debt payments from debt data as monthly recurring transactions
   - Add variable expenses: shopping, entertainment, healthcare, subscriptions
   - Vary amounts realistically: groceries ($80-150), gas ($35-65), dining ($15-80)
   - Account for seasonal variations: utilities +30% in summer/winter, holiday spending in Dec
   - Include occasional statistically significant purchases based on historical patterns (those that are 2+ standard deviations from the mean transaction amount)

3. TRANSACTION DISTRIBUTION PER MONTH:
   - Month 1-12: Each month should have 8-15 transactions minimum
   - Include: 1 salary, 1 rent, 1-2 utilities, 4 groceries, 2 gas, 4-8 other expenses
   - Spread transactions realistically throughout each month (not all on same day)
   - Ensure chronological ordering within each month

4. REALISTIC DETAILS:
   - Use actual merchant names from historical data when possible
   - Create similar merchant names for new transactions (e.g., "Safeway", "Shell Gas", "Starbucks")
   - Maintain consistent account usage patterns from historical data
   - Include both positive (income) and negative (expense) amounts
   - Ensure dates are chronologically ordered across all 12 months

5. CONFIDENCE SCORING:
   - High confidence (0.9+): Regular income, fixed expenses (rent, loans, utilities)
   - Medium confidence (0.7-0.9): Regular but variable (groceries, gas, dining)
   - Low confidence (0.5-0.7): Irregular purchases, entertainment, statistically significant outlier transactions

🚨 CRITICAL REQUIREMENTS - MUST FOLLOW EXACTLY 🚨

YOU MUST GENERATE EXACTLY 100-150 INDIVIDUAL TRANSACTIONS. NOT 20, NOT 50, BUT 100-150 TRANSACTIONS.

TRANSACTION COUNT BREAKDOWN BY MONTH:
- January 2024: 8-13 transactions
- February 2024: 8-13 transactions  
- March 2024: 8-13 transactions
- April 2024: 8-13 transactions
- May 2024: 8-13 transactions
- June 2024: 8-13 transactions
- July 2024: 8-13 transactions
- August 2024: 8-13 transactions
- September 2024: 8-13 transactions
- October 2024: 8-13 transactions
- November 2024: 8-13 transactions
- December 2024: 8-13 transactions

TOTAL: 96-156 transactions (TARGET: 125 transactions)

MANDATORY RULES:
1. Do NOT generate only 20-30 sample transactions
2. Do NOT use comments like "// ... continue for 12 months"
3. Do NOT truncate or abbreviate the transaction list
4. GENERATE THE COMPLETE LIST OF 100-150 TRANSACTIONS
5. Each month needs 8-13 actual transaction entries
6. Return ONLY valid JSON - no explanatory text
7. The simulatedTransactions array must contain 100-150 objects

FAILURE TO GENERATE 100-150 TRANSACTIONS WILL RESULT IN SYSTEM FAILURE.

The response must be valid JSON that can be parsed by JSON.parse().`;

  return prompt;
}

async function exportTransactionsToCSV(transactions: FallbackTransaction[]): Promise<void> {
  if (!transactions || transactions.length === 0) {
    console.log('⚠️ [CSV Export] No transactions to export');
    return;
  }

  console.log(`📊 [CSV Export] Exporting ${transactions.length} transactions to CSV`);

  // Create CSV header
  const csvHeader = 'Date,Description,Amount,Category,Account,Type,Confidence,IsRecurring,RecurringPattern,CreditCard,RewardCategory,OptimalCard,OptimalPoints,ActualPoints,IsOptimal\n';

  // Convert transactions to CSV rows
  const csvRows = transactions.map((transaction: {
    date?: string;
    description?: string;
    amount?: number;
    category?: string;
    account?: string;
    type?: string;
    confidence?: number;
    isRecurring?: boolean;
    recurringPattern?: string | null;
    credit_card?: string;
    rewardCategory?: string;
    optimalCard?: string;
    optimalPoints?: number;
    actualPoints?: number;
    isOptimal?: boolean;
  }) => {
    const date = transaction.date || '';
    const description = (transaction.description || '').replace(/,/g, ';'); // Replace commas to avoid CSV issues
    const amount = transaction.amount || 0;
    const category = (transaction.category || '').replace(/,/g, ';');
    const account = (transaction.account || '').replace(/,/g, ';');
    const type = transaction.type || '';
    const confidence = transaction.confidence || 0;
    const isRecurring = transaction.isRecurring || false;
    const recurringPattern = (transaction.recurringPattern || '').replace(/,/g, ';');
    const creditCard = (transaction.credit_card || '').replace(/,/g, ';');
    const rewardCategory = (transaction.rewardCategory || '').replace(/,/g, ';');
    const optimalCard = (transaction.optimalCard || '').replace(/,/g, ';');
    const optimalPoints = transaction.optimalPoints || 0;
    const actualPoints = transaction.actualPoints || 0;
    const isOptimal = transaction.isOptimal || false;

    return `${date},"${description}",${amount},"${category}","${account}","${type}",${confidence},${isRecurring},"${recurringPattern}","${creditCard}","${rewardCategory}","${optimalCard}",${optimalPoints},${actualPoints},${isOptimal}`;
  }).join('\n');

  const csvContent = csvHeader + csvRows;

  // Create filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const filename = `simulated-transactions-${timestamp}.csv`;
  const filePath = path.join(process.cwd(), 'simulated-outputs', filename);

  // Ensure directory exists
  const outputDir = path.join(process.cwd(), 'simulated-outputs');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write CSV file
  fs.writeFileSync(filePath, csvContent, 'utf8');

  console.log(`✅ [CSV Export] Transactions exported to: ${filePath}`);
  console.log(`📈 [CSV Export] File contains ${transactions.length} transactions`);
}

interface FallbackTransaction {
  date: string;
  description: string;
  amount: number;
  category: string;
  account: string;
  type: string;
  confidence: number;
  isRecurring: boolean;
  recurringPattern: string | null;
  credit_card: string;
}

function generateFallbackTransactions(_transactionData: TransactionDataInput[], _debtData: DebtDataInput[], _detectedAdjustments?: SimulationAdjustments): FallbackTransaction[] {
  console.log('🔄 [Fallback] Generating fallback transactions');
  
  const transactions: FallbackTransaction[] = [];
  const startDate = new Date('2024-07-01');
  
  // Helper function to randomly select between the two AMEX cards
  const getRandomAmexCard = () => {
    return Math.random() < 0.6 ? 'AMEX_GOLD' : 'AMEX_BLUE_CASH_PREFERRED';
  };
  
  // Helper function to get optimal card for category
  const getOptimalCardForCategory = (category: string) => {
    const lowerCategory = category.toLowerCase();
    if (lowerCategory.includes('grocery') || lowerCategory.includes('food') || lowerCategory.includes('dining')) {
      return 'AMEX_GOLD'; // 4x on groceries and dining
    }
    if (lowerCategory.includes('gas') || lowerCategory.includes('streaming') || lowerCategory.includes('subscription')) {
      return 'AMEX_BLUE_CASH_PREFERRED'; // 3x on gas, 6x on streaming
    }
    return getRandomAmexCard(); // Default to random selection
  };
  
  // Generate 12 months of transactions
  for (let month = 0; month < 12; month++) {
    const currentMonth = new Date(startDate);
    currentMonth.setMonth(startDate.getMonth() + month);
    
    // Skip salary deposits and rent payments - only credit card transactions
    
    // Generate utilities (credit card autopay)
    const utilityAmount = month >= 5 && month <= 8 ? -120 : -85; // Higher in summer
    transactions.push({
      date: `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-05`,
      description: 'Electric Bill Autopay',
      amount: utilityAmount,
      category: 'Utilities',
      account: 'Credit Card',
      type: 'Debit',
      confidence: 0.85,
      isRecurring: true,
      recurringPattern: 'monthly',
      credit_card: getOptimalCardForCategory('Utilities')
    });
    
    // Generate weekly groceries (4 per month)
    for (let week = 0; week < 4; week++) {
      const day = 7 + (week * 7);
      const amount = -(100 + Math.random() * 50); // $100-150
      transactions.push({
        date: `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        description: 'Grocery Store',
        amount: Math.round(amount * 100) / 100,
        category: 'Groceries',
        account: 'Credit Card',
        type: 'Debit',
        confidence: 0.75,
        isRecurring: false,
        recurringPattern: null,
        credit_card: getOptimalCardForCategory('Groceries')
      });
    }
    
    // Generate gas (2 per month)
    for (let i = 0; i < 2; i++) {
      const day = 10 + (i * 15);
      const amount = -(40 + Math.random() * 25); // $40-65
      transactions.push({
        date: `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        description: 'Gas Station',
        amount: Math.round(amount * 100) / 100,
        category: 'Transportation',
        account: 'Credit Card',
        type: 'Debit',
        confidence: 0.70,
        isRecurring: false,
        recurringPattern: null,
        credit_card: getOptimalCardForCategory('Transportation')
      });
    }
    
    // Generate dining (6 per month)
    for (let i = 0; i < 6; i++) {
      const day = 5 + (i * 4);
      const amount = -(15 + Math.random() * 65); // $15-80
      transactions.push({
        date: `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        description: i % 2 === 0 ? 'Restaurant' : 'Coffee Shop',
        amount: Math.round(amount * 100) / 100,
        category: 'Food & Dining',
        account: 'Credit Card',
        type: 'Debit',
        confidence: 0.60,
        isRecurring: false,
        recurringPattern: null,
        credit_card: getOptimalCardForCategory('Food & Dining')
      });
    }
    
    // Skip debt payments - only credit card transactions
    
    // Add streaming services and subscriptions
    if (month % 1 === 0) { // Monthly subscriptions
      const subscriptions = [
        { name: 'Netflix', amount: -15.99, day: 8 },
        { name: 'Spotify Premium', amount: -9.99, day: 12 },
        { name: 'Amazon Prime', amount: -14.99, day: 15 }
      ];
      
      subscriptions.forEach((sub, index) => {
        if (index < 2 || month % 3 === 0) { // Some subscriptions are quarterly
          transactions.push({
            date: `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(sub.day).padStart(2, '0')}`,
            description: sub.name,
            amount: sub.amount,
            category: 'Subscriptions',
            account: 'Credit Card',
            type: 'Debit',
            confidence: 0.90,
            isRecurring: true,
            recurringPattern: index < 2 ? 'monthly' : 'quarterly',
            credit_card: getOptimalCardForCategory('Subscriptions')
          });
        }
      });
    }
    
    // Add some random expenses
    for (let i = 0; i < 3; i++) {
      const day = 8 + (i * 8);
      const amount = -(25 + Math.random() * 200); // $25-225
      const categories = ['Shopping', 'Entertainment', 'Healthcare', 'Miscellaneous'];
      const descriptions = ['Online Purchase', 'Movie Theater', 'Pharmacy', 'Subscription'];
      
      transactions.push({
        date: `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        description: descriptions[i % descriptions.length],
        amount: Math.round(amount * 100) / 100,
        category: categories[i % categories.length],
        account: 'Credit Card',
        type: 'Debit',
        confidence: 0.50,
        isRecurring: false,
        recurringPattern: null,
        credit_card: getOptimalCardForCategory(categories[i % categories.length])
      });
    }
  }
  
  // Sort by date
  transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  console.log(`✅ [Fallback] Generated ${transactions.length} fallback transactions`);
  return transactions;
}

async function readExistingCSV(): Promise<FallbackTransaction[]> {
  console.log('📄 [Testing] Reading fallback CSV file from simulated-outputs');
  
  const outputDir = path.join(process.cwd(), 'simulated-outputs');
  const csvFile = 'fallback-simulated-transactions.csv';
  const csvPath = path.join(outputDir, csvFile);
  
  if (!fs.existsSync(csvPath)) {
    throw new Error(`Fallback CSV file not found: ${csvPath}`);
  }
  
  console.log(`📄 [Testing] Using fallback CSV file: ${csvFile}`);
  
  const csvContent = fs.readFileSync(csvPath, 'utf8');
  const lines = csvContent.split('\n').filter(line => line.trim());
  
  if (lines.length <= 1) {
    throw new Error('CSV file is empty or only contains headers');
  }
  
  // Skip header line and parse data
  const transactions: FallbackTransaction[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const values = parseCSVLine(line);
    
    if (values.length >= 10) {
      const transaction: FallbackTransaction & {
        rewardCategory?: string;
        optimalCard?: string;
        optimalPoints?: number;
        actualPoints?: number;
        isOptimal?: boolean;
      } = {
        date: values[0],
        description: values[1].replace(/"/g, ''),
        amount: parseFloat(values[2]) || 0,
        category: values[3].replace(/"/g, ''),
        account: values[4].replace(/"/g, ''),
        type: values[5].replace(/"/g, ''),
        confidence: parseFloat(values[6]) || 0,
        isRecurring: values[7].toLowerCase() === 'true',
        recurringPattern: values[8].replace(/"/g, '') || null,
        credit_card: values[9] ? values[9].replace(/"/g, '') : 'AMEX_GOLD'
      };
      
      // Add reward optimization fields if available (columns 10-14)
      if (values.length >= 15) {
        transaction.rewardCategory = values[10] ? values[10].replace(/"/g, '') : undefined;
        transaction.optimalCard = values[11] ? values[11].replace(/"/g, '') : undefined;
        transaction.optimalPoints = values[12] ? parseFloat(values[12]) : undefined;
        transaction.actualPoints = values[13] ? parseFloat(values[13]) : undefined;
        transaction.isOptimal = values[14] ? values[14].toLowerCase() === 'true' : undefined;
      }
      
      transactions.push(transaction as FallbackTransaction);
    }
  }
  
  console.log(`✅ [Testing] Loaded ${transactions.length} transactions from CSV`);
  return transactions;
}

function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  values.push(current); // Add the last value
  return values;
}

interface RecurringPattern {
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

interface MockAnalysis {
  simulatedTransactions: FallbackTransaction[];
  patterns: {
    recurringTransactions: RecurringPattern[];
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

interface TransactionMetadata {
  adjustment: string;
  category: string;
  transactionIndices: number[];
  label: string;
  description: string;
}

interface SpendingTrend {
  category: string;
  earlyPeriodAvg: number;
  latePeriodAvg: number;
  changePercent: number;
  transactionCount: number;
}

function analyzeSpendingTrends(sortedTransactions: TransactionDataInput[]): SpendingTrend[] {
  if (sortedTransactions.length < 10) return []; // Need sufficient data
  
  // Split transactions into early and late periods
  const midPoint = Math.floor(sortedTransactions.length / 2);
  const earlyTransactions = sortedTransactions.slice(0, midPoint);
  const lateTransactions = sortedTransactions.slice(midPoint);
  
  // Group by category and analyze trends
  const categoryTrends: Record<string, SpendingTrend> = {};
  
  // Analyze early period
  const earlyCategorySpending: Record<string, { total: number; count: number }> = {};
  earlyTransactions.forEach(t => {
    const category = (t.category || 'uncategorized').toLowerCase();
    const amount = Math.abs(t.amount || 0);
    if (!earlyCategorySpending[category]) {
      earlyCategorySpending[category] = { total: 0, count: 0 };
    }
    earlyCategorySpending[category].total += amount;
    earlyCategorySpending[category].count += 1;
  });
  
  // Analyze late period
  const lateCategorySpending: Record<string, { total: number; count: number }> = {};
  lateTransactions.forEach(t => {
    const category = (t.category || 'uncategorized').toLowerCase();
    const amount = Math.abs(t.amount || 0);
    if (!lateCategorySpending[category]) {
      lateCategorySpending[category] = { total: 0, count: 0 };
    }
    lateCategorySpending[category].total += amount;
    lateCategorySpending[category].count += 1;
  });
  
  // Calculate trends for categories present in both periods
  const allCategories = new Set([...Object.keys(earlyCategorySpending), ...Object.keys(lateCategorySpending)]);
  
  allCategories.forEach(category => {
    const earlyData = earlyCategorySpending[category] || { total: 0, count: 0 };
    const lateData = lateCategorySpending[category] || { total: 0, count: 0 };
    
    const earlyAvg = earlyData.count > 0 ? earlyData.total / earlyData.count : 0;
    const lateAvg = lateData.count > 0 ? lateData.total / lateData.count : 0;
    
    if (earlyAvg > 0 || lateAvg > 0) {
      const changePercent = earlyAvg > 0 ? ((lateAvg - earlyAvg) / earlyAvg) * 100 : (lateAvg > 0 ? 100 : 0);
      
      categoryTrends[category] = {
        category,
        earlyPeriodAvg: earlyAvg,
        latePeriodAvg: lateAvg,
        changePercent,
        transactionCount: earlyData.count + lateData.count
      };
    }
  });
  
  return Object.values(categoryTrends);
}

function detectSimulationAdjustments(transactionData: TransactionDataInput[], _debtData: DebtDataInput[]): SimulationAdjustments & { transactionMetadata?: TransactionMetadata[] } {
  const detectedAdjustments = {
    lifeEvents: {} as Record<string, boolean>,
    behavioralChanges: {} as Record<string, boolean>,
    externalFactors: {} as Record<string, boolean>,
    transactionMetadata: [] as TransactionMetadata[]
  };

  if (!transactionData || transactionData.length === 0) {
    // For test mode, only add adjustments if there's a reason to
    console.log('🧪 [Detection] Test mode - no transaction data to analyze');
    return detectedAdjustments;
  }

  // Enhanced pattern analysis with temporal context
  const sortedTransactions = transactionData.sort((a, b) => 
    new Date(a.transaction_date || '').getTime() - new Date(b.transaction_date || '').getTime()
  );
  
  // Analyze spending patterns over time for behavioral drift detection
  const timeWindows = analyzeSpendingTrends(sortedTransactions);

  // Analyze transaction patterns to detect adjustments
  const amounts = transactionData.map(t => Math.abs(t.amount || 0));
  const totalSpending = amounts.reduce((sum, amount) => sum + amount, 0);
  const avgTransaction = totalSpending / amounts.length;

  console.log('🔍 [Detection] Analyzing transaction patterns for adjustments...');
  console.log('📊 [Detection] Transaction stats:', {
    totalTransactions: transactionData.length,
    totalSpending: totalSpending.toFixed(2),
    avgTransaction: avgTransaction.toFixed(2)
  });

  // Detect Life Events and track triggering transactions
  const furnitureKeywords = ['furniture', 'ikea', 'wayfair', 'home depot', 'lowes', 'moving', 'uhaul'];
  const weddingKeywords = ['wedding', 'bridal', 'tuxedo', 'venue', 'catering', 'flowers', 'photographer'];
  const babyKeywords = ['baby', 'pediatric', 'childcare', 'daycare', 'diaper', 'formula', 'stroller'];

  // Track Recent Move transactions
  const recentMoveTransactions: number[] = [];
  transactionData.forEach((transaction, index) => {
    const desc = (transaction.description || '').toLowerCase();
    const amount = Math.abs(transaction.amount || 0);
    if (furnitureKeywords.some(keyword => desc.includes(keyword)) || 
        (amount > 1000 && furnitureKeywords.some(keyword => desc.includes(keyword)))) {
      recentMoveTransactions.push(index);
    }
  });
  
  if (recentMoveTransactions.length > 0) {
    detectedAdjustments.lifeEvents.recentMove = true;
    detectedAdjustments.transactionMetadata.push({
      adjustment: 'recentMove',
      category: 'lifeEvents',
      transactionIndices: recentMoveTransactions,
      label: 'Recent Move',
      description: 'Furniture purchases, moving costs, home setup expenses'
    });
    console.log('🏠 [Detection] Recent move detected based on furniture/moving expenses');
  }

  // Track Wedding transactions
  const weddingTransactions: number[] = [];
  transactionData.forEach((transaction, index) => {
    const desc = (transaction.description || '').toLowerCase();
    const amount = Math.abs(transaction.amount || 0);
    if (weddingKeywords.some(keyword => desc.includes(keyword)) || 
        (amount > 2000 && weddingKeywords.some(keyword => desc.includes(keyword)))) {
      weddingTransactions.push(index);
    }
  });
  
  if (weddingTransactions.length > 0) {
    detectedAdjustments.lifeEvents.newMarriage = true;
    detectedAdjustments.transactionMetadata.push({
      adjustment: 'newMarriage',
      category: 'lifeEvents',
      transactionIndices: weddingTransactions,
      label: 'New Marriage',
      description: 'Wedding expenses, ring purchases, honeymoon costs'
    });
    console.log('💒 [Detection] New marriage detected based on wedding-related expenses');
  }

  // Track Baby transactions
  const babyTransactions: number[] = [];
  transactionData.forEach((transaction, index) => {
    const desc = (transaction.description || '').toLowerCase();
    const cat = (transaction.category || '').toLowerCase();
    if (babyKeywords.some(keyword => desc.includes(keyword)) || 
        ['healthcare', 'medical', 'childcare'].includes(cat)) {
      babyTransactions.push(index);
    }
  });
  
  if (babyTransactions.length > 0) {
    detectedAdjustments.lifeEvents.newBaby = true;
    detectedAdjustments.transactionMetadata.push({
      adjustment: 'newBaby',
      category: 'lifeEvents',
      transactionIndices: babyTransactions,
      label: 'New Baby',
      description: 'Healthcare costs, childcare expenses, baby supplies'
    });
    console.log('👶 [Detection] New baby detected based on childcare/medical expenses');
  }

  // Enhanced Behavioral Changes Detection using trend analysis
  console.log('🔍 [Detection] Analyzing behavioral changes with temporal trends...');
  
  // Detect dietary shifts using trend analysis
  const foodTrends = timeWindows.filter(trend => 
    trend.category.includes('food') || trend.category.includes('restaurant') || 
    trend.category.includes('grocery') || trend.category.includes('dining')
  );
  
  const restaurantTrend = foodTrends.find(t => 
    t.category.includes('restaurant') || t.category.includes('dining') || t.category.includes('food')
  );
  const groceryTrend = foodTrends.find(t => 
    t.category.includes('grocery') || t.category.includes('supermarket')
  );
  
  // Track all food-related transactions for better visualization
  const restaurantTransactions: number[] = [];
  const groceryTransactions: number[] = [];
  
  transactionData.forEach((transaction, index) => {
    const desc = (transaction.description || '').toLowerCase();
    const cat = (transaction.category || '').toLowerCase();
    
    if (cat.includes('food') || cat.includes('restaurant') || cat.includes('dining') ||
        desc.includes('restaurant') || desc.includes('uber eats') || 
        desc.includes('doordash') || desc.includes('grubhub') || desc.includes('takeout')) {
      restaurantTransactions.push(index);
    }
    
    if (cat.includes('grocery') || cat.includes('supermarket') ||
        desc.includes('whole foods') || desc.includes('safeway') ||
        desc.includes('kroger') || desc.includes('trader joe') || desc.includes('costco')) {
      groceryTransactions.push(index);
    }
  });

  // Detect dietary shift based on trends and current spending patterns
  const restaurantSpending = restaurantTransactions.reduce((sum, i) => sum + Math.abs(transactionData[i].amount || 0), 0);
  const grocerySpending = groceryTransactions.reduce((sum, i) => sum + Math.abs(transactionData[i].amount || 0), 0);
  
  console.log('🍽️ [Detection] Food spending analysis:', {
    restaurantSpending: restaurantSpending.toFixed(2),
    grocerySpending: grocerySpending.toFixed(2),
    restaurantTrend: restaurantTrend?.changePercent.toFixed(1) + '%' || 'N/A',
    groceryTrend: groceryTrend?.changePercent.toFixed(1) + '%' || 'N/A',
    totalFoodTransactions: restaurantTransactions.length + groceryTransactions.length
  });

  // Detect dietary shift with multiple criteria
  const dietaryShiftDetected = (
    (grocerySpending > restaurantSpending * 1.2) || // Current spending favors groceries
    (groceryTrend && groceryTrend.changePercent > 25) || // Grocery spending increased significantly
    (restaurantTrend && restaurantTrend.changePercent < -25) // Restaurant spending decreased significantly
  );

  if (dietaryShiftDetected && (restaurantTransactions.length > 0 || groceryTransactions.length > 0)) {
    detectedAdjustments.behavioralChanges.dietaryShift = true;
    detectedAdjustments.transactionMetadata.push({
      adjustment: 'dietaryShift',
      category: 'behavioralChanges',
      transactionIndices: [...groceryTransactions, ...restaurantTransactions],
      label: 'Dietary Shift',
      description: 'Shift from eating out to cooking at home'
    });
    console.log('🥗 [Detection] Dietary shift detected - behavioral change in food spending');
  }

  // Track Fitness transactions
  const fitnessKeywords = ['gym', 'fitness', 'yoga', 'pilates', 'crossfit', 'peloton', 'fitbit'];
  const fitnessTransactions: number[] = [];
  transactionData.forEach((transaction, index) => {
    const desc = (transaction.description || '').toLowerCase();
    if (fitnessKeywords.some(keyword => desc.includes(keyword))) {
      fitnessTransactions.push(index);
    }
  });
  
  if (fitnessTransactions.length > 0) {
    detectedAdjustments.behavioralChanges.fitnessChange = true;
    detectedAdjustments.transactionMetadata.push({
      adjustment: 'fitnessChange',
      category: 'behavioralChanges',
      transactionIndices: fitnessTransactions,
      label: 'Fitness Change',
      description: 'Gym membership, fitness equipment, health supplements'
    });
    console.log('💪 [Detection] Fitness change detected based on gym/fitness expenses');
  }

  // Track Transportation transactions
  const transportKeywords = ['uber', 'lyft', 'metro', 'transit', 'gas', 'parking'];
  const transportTransactions: number[] = [];
  transactionData.forEach((transaction, index) => {
    const desc = (transaction.description || '').toLowerCase();
    if (transportKeywords.some(keyword => desc.includes(keyword))) {
      transportTransactions.push(index);
    }
  });
  
  if (transportTransactions.length > 0) {
    detectedAdjustments.behavioralChanges.transportationChange = true;
    detectedAdjustments.transactionMetadata.push({
      adjustment: 'transportationChange',
      category: 'behavioralChanges',
      transactionIndices: transportTransactions,
      label: 'Transportation Change',
      description: 'Shift between car, transit, and rideshare usage'
    });
    console.log('🚗 [Detection] Transportation change detected based on transport expenses');
  }

  // Detect External Factors (only if there's evidence in the data)
  // Check for inflation indicators (gradual price increases over time)
  const hasInflationIndicators = timeWindows.some(trend => 
    (trend.category.includes('grocery') || trend.category.includes('gas') || trend.category.includes('utilities')) &&
    trend.changePercent > 10 // Significant increase suggesting inflation
  );
  
  if (hasInflationIndicators) {
    detectedAdjustments.externalFactors.inflation = true;
    console.log('💹 [Detection] Inflation detected based on price increases in essential categories');
  }
  
  // Check for seasonal patterns (significant spending variations by time period)
  const hasSeasonalPatterns = amounts.length > 50 && // Need sufficient data
    sortedTransactions.length > 90; // At least 3 months of data
  
  if (hasSeasonalPatterns) {
    // Simple seasonal detection: check if there are significant spending variations
    const monthlySpending: Record<string, number[]> = {};
    sortedTransactions.forEach(t => {
      const date = new Date(t.transaction_date || '');
      const month = date.getMonth();
      if (!monthlySpending[month]) monthlySpending[month] = [];
      monthlySpending[month].push(Math.abs(t.amount || 0));
    });
    
    const monthlyAverages = Object.values(monthlySpending)
      .filter(amounts => amounts.length > 0)
      .map(amounts => amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length);
    
    if (monthlyAverages.length >= 3) {
      const avgSpending = monthlyAverages.reduce((sum, avg) => sum + avg, 0) / monthlyAverages.length;
      const hasVariation = monthlyAverages.some(avg => Math.abs(avg - avgSpending) / avgSpending > 0.3); // 30% variation
      
      if (hasVariation) {
        detectedAdjustments.externalFactors.seasonalAdjustments = true;
        console.log('🌟 [Detection] Seasonal patterns detected based on monthly spending variations');
      }
    }
  }

  // Track subscription transactions for social trends
  const subscriptionKeywords = ['subscription', 'netflix', 'spotify', 'amazon prime', 'disney+', 'hulu'];
  const subscriptionTransactions: number[] = [];
  transactionData.forEach((transaction, index) => {
    const desc = (transaction.description || '').toLowerCase();
    if (subscriptionKeywords.some(keyword => desc.includes(keyword))) {
      subscriptionTransactions.push(index);
    }
  });
  
  if (subscriptionTransactions.length > 0) {
    detectedAdjustments.externalFactors.socialTrends = true;
    detectedAdjustments.transactionMetadata.push({
      adjustment: 'socialTrends',
      category: 'externalFactors',
      transactionIndices: subscriptionTransactions,
      label: 'Social Trends',
      description: 'New subscription services, travel recovery'
    });
    console.log('📱 [Detection] Social trends detected based on subscription services');
  }

  const detectedCount = Object.values(detectedAdjustments.lifeEvents).filter(Boolean).length +
                       Object.values(detectedAdjustments.behavioralChanges).filter(Boolean).length +
                       Object.values(detectedAdjustments.externalFactors).filter(Boolean).length;
  
  console.log(`✅ [Detection] Detected ${detectedCount} simulation adjustments to apply`);
  
  return detectedAdjustments;
}

interface CardMilestone {
  date: string;
  cardRecommendation: string;
  signUpBonus: string;
  spendingRequirement: number;
  timeframe: number; // months
  reasoning: string;
  upcomingSpending: number;
  confidence: number;
}

function analyzeCardOpeningMilestones(transactions: FallbackTransaction[]): CardMilestone[] {
  console.log('🎯 [Milestones] Analyzing optimal card opening opportunities...');
  
  if (!transactions || transactions.length === 0) {
    return [];
  }

  const milestones: CardMilestone[] = [];
  const sortedTransactions = transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  // Group transactions by month to analyze spending patterns
  const monthlySpending: Record<string, { total: number; transactions: FallbackTransaction[] }> = {};
  
  sortedTransactions.forEach(transaction => {
    const date = new Date(transaction.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (!monthlySpending[monthKey]) {
      monthlySpending[monthKey] = { total: 0, transactions: [] };
    }
    
    monthlySpending[monthKey].total += Math.abs(transaction.amount);
    monthlySpending[monthKey].transactions.push(transaction);
  });

  // Calculate rolling 3-month spending windows
  const monthKeys = Object.keys(monthlySpending).sort();
  const availableCards = Object.entries(cardDetails);
  
  console.log('📊 [Milestones] Monthly spending analysis:', {
    totalMonths: monthKeys.length,
    availableCards: availableCards.length,
    avgMonthlySpending: Object.values(monthlySpending).reduce((sum, month) => sum + month.total, 0) / monthKeys.length
  });

  // Track when cards were "opened" to maintain spacing
  const cardOpenings: { date: Date; card: string }[] = [];
  
  for (let i = 0; i < monthKeys.length - 2; i++) {
    const currentMonth = monthKeys[i];
    const next2Months = monthKeys.slice(i, i + 3);
    
    // Calculate 3-month spending window
    const windowSpending = next2Months.reduce((total, monthKey) => {
      return total + monthlySpending[monthKey].total;
    }, 0);
    
    // Check if there's been enough time since last card opening (minimum 3 months)
    const currentDate = new Date(currentMonth + '-01');
    const lastOpening = cardOpenings[cardOpenings.length - 1];
    const monthsSinceLastOpening = lastOpening ? 
      (currentDate.getTime() - lastOpening.date.getTime()) / (1000 * 60 * 60 * 24 * 30) : 
      Infinity;
    
    if (monthsSinceLastOpening < 3) {
      continue; // Too soon since last card opening
    }

    // Find the best card for this spending period
    let bestCard: { name: string; details: Record<string, unknown>; score: number; spendingReq: number } | null = null;
    
    for (const [cardName, cardData] of availableCards) {
      const signUpBonus = (cardData as Record<string, unknown>).signUpBonus as string || '';
      
      // Extract spending requirement from sign-up bonus text
      const spendingMatch = signUpBonus.match(/\$(\d+(?:,\d+)?)/);
      const timeMatch = signUpBonus.match(/(\d+)\s+months?/);
      
      if (!spendingMatch || !timeMatch) continue;
      
      const spendingRequirement = parseInt(spendingMatch[1].replace(',', ''));
      const timeframe = parseInt(timeMatch[1]);
      
      // Check if the 3-month window spending can meet the requirement
      if (windowSpending >= spendingRequirement && timeframe <= 3) {
        // Extract bonus amount for scoring
        const bonusMatch = signUpBonus.match(/\$(\d+(?:,\d+)?)\s+(?:bonus|back|cash)/i);
        const pointsMatch = signUpBonus.match(/(\d+(?:,\d+)?)\s+(?:bonus\s+)?(?:points|miles)/i);
        
        let bonusValue = 0;
        if (bonusMatch) {
          bonusValue = parseInt(bonusMatch[1].replace(',', ''));
        } else if (pointsMatch) {
          // Estimate points value (typically 1-2 cents per point)
          bonusValue = parseInt(pointsMatch[1].replace(',', '')) * 0.015;
        }
        
        // Score based on bonus value and how well spending fits requirement
        const utilizationRatio = Math.min(windowSpending / spendingRequirement, 2); // Cap at 2x
        const score = bonusValue * utilizationRatio;
        
        if (!bestCard || score > bestCard.score) {
          bestCard = {
            name: cardName,
            details: cardData as Record<string, unknown>,
            score,
            spendingReq: spendingRequirement
          };
        }
      }
    }
    
    // If we found a good card opportunity, add it as a milestone
    if (bestCard && windowSpending >= bestCard.spendingReq * 0.8) { // At least 80% of requirement
      const confidence = Math.min(windowSpending / bestCard.spendingReq, 1.5) * 0.67; // Max 100% confidence
      
      // Determine optimal opening date (start of the high-spending period)
      const milestoneDate = currentMonth + '-01';
      
      // Create reasoning
      const reasoning = `High spending period detected ($${windowSpending.toFixed(0)} over 3 months). ` +
        `Opening ${bestCard.name.replace(/_/g, ' ')} now allows you to meet the $${bestCard.spendingReq} ` +
        `spending requirement naturally while earning the sign-up bonus. ` +
        `${monthsSinceLastOpening === Infinity ? 'First card recommendation.' : 
          `${monthsSinceLastOpening.toFixed(0)} months since last opening (good spacing).`}`;
      
      milestones.push({
        date: milestoneDate,
        cardRecommendation: bestCard.name.replace(/_/g, ' '),
        signUpBonus: bestCard.details.signUpBonus as string,
        spendingRequirement: bestCard.spendingReq,
        timeframe: 3,
        reasoning,
        upcomingSpending: windowSpending,
        confidence
      });
      
      // Track this card opening
      cardOpenings.push({
        date: new Date(milestoneDate),
        card: bestCard.name
      });
      
      console.log(`🎯 [Milestones] Added milestone for ${bestCard.name} on ${milestoneDate}:`, {
        spendingRequirement: bestCard.spendingReq,
        upcomingSpending: windowSpending,
        confidence: confidence.toFixed(2),
        monthsSinceLastOpening: monthsSinceLastOpening === Infinity ? 'N/A' : monthsSinceLastOpening.toFixed(0)
      });
    }
  }
  
  console.log(`✅ [Milestones] Generated ${milestones.length} card opening milestones`);
  return milestones;
}

function createMockAnalysis(simulatedTransactions: FallbackTransaction[]): MockAnalysis {
  console.log('🔄 [Testing] Creating mock analysis from CSV transactions');
  
  // Calculate basic statistics
  const totalTransactions = simulatedTransactions.length;
  const recurringTransactions = simulatedTransactions.filter(t => t.isRecurring);
  const expenses = simulatedTransactions.filter(t => t.amount < 0);
  const income = simulatedTransactions.filter(t => t.amount > 0);
  
  const totalExpenses = expenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const totalIncome = income.reduce((sum, t) => sum + t.amount, 0);
  const averageTransactionAmount = totalTransactions > 0 ? 
    simulatedTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0) / totalTransactions : 0;
  
  // Get unique categories
  const categories = [...new Set(simulatedTransactions.map(t => t.category))];
  
  // Create mock patterns
  const recurringPatterns = recurringTransactions.slice(0, 10).map(t => ({
    description: t.description,
    averageAmount: Math.abs(t.amount),
    frequency: t.recurringPattern || 'monthly',
    category: t.category,
    confidence: t.confidence,
    nextOccurrence: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  }));
  
  // Calculate statistical significance for large transactions
  const expenseAmounts = expenses.map(t => Math.abs(t.amount));
  const mean = expenseAmounts.reduce((sum, amount) => sum + amount, 0) / expenseAmounts.length;
  const variance = expenseAmounts.reduce((sum, amount) => sum + Math.pow(amount - mean, 2), 0) / expenseAmounts.length;
  const standardDeviation = Math.sqrt(variance);
  const largeTransactionThreshold = mean + (2 * standardDeviation);
  
  console.log('📊 [API] Transaction statistics for mock analysis:', {
    totalExpenses: expenseAmounts.length,
    mean: mean.toFixed(2),
    standardDeviation: standardDeviation.toFixed(2),
    largeTransactionThreshold: largeTransactionThreshold.toFixed(2)
  });

  const significantTransactions = expenses
    .filter(t => Math.abs(t.amount) > largeTransactionThreshold)
    .slice(0, 5)
    .map(t => ({
      description: t.description,
      averageAmount: Math.abs(t.amount),
      frequency: 'irregular',
      category: t.category,
      lastOccurrence: t.date,
      predictedNext: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    }));
  
  const seasonalPatterns = [
    {
      season: 'summer',
      category: 'Utilities',
      averageIncrease: 35,
      reason: 'Higher electricity usage for cooling'
    },
    {
      season: 'winter',
      category: 'Shopping',
      averageIncrease: 200,
      reason: 'Holiday shopping and gifts'
    }
  ];
  
  return {
    simulatedTransactions,
    patterns: {
      recurringTransactions: recurringPatterns,
      significantTransactions: significantTransactions,
      seasonalPatterns: seasonalPatterns
    },
    insights: {
      totalPredictedTransactions: totalTransactions,
      recurringTransactionCount: recurringTransactions.length,
      averageTransactionAmount: averageTransactionAmount,
      primarySpendingCategories: categories.slice(0, 5),
      spendingTrend: totalExpenses > totalIncome ? 'increasing' : 'stable',
      riskFactors: [
        'High recurring expenses detected',
        'Large irregular purchases identified'
      ],
      recommendations: [
        'Consider setting up automatic savings transfers',
        'Review recurring subscriptions for potential savings',
        'Build emergency fund for large irregular expenses'
      ]
    },
    summary: {
      projectedTotalIncome: totalIncome,
      projectedTotalExpenses: totalExpenses,
      projectedNetChange: totalIncome - totalExpenses,
      confidenceScore: 0.85
    }
  };
}
