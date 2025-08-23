import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log('🚀 [API] Starting spending analysis request');
  
  try {
    const { transactionData, debtData } = await request.json();
    
    console.log('📊 [API] Received data:', {
      transactionCount: transactionData?.length || 0,
      debtCount: debtData?.length || 0,
      hasTransactionData: !!transactionData,
      hasDebtData: !!debtData
    });

    if (!transactionData && !debtData) {
      console.log('❌ [API] No data provided for analysis');
      return NextResponse.json(
        { error: 'No data provided for analysis' },
        { status: 400 }
      );
    }

    // Log sample data for debugging
    if (transactionData && transactionData.length > 0) {
      console.log('💳 [API] Sample transaction data:', {
        firstTransaction: transactionData[0],
        totalAmount: transactionData.reduce((sum: number, t: { amount?: number }) => sum + (t.amount || 0), 0),
        dateRange: {
          first: transactionData[0]?.date,
          last: transactionData[transactionData.length - 1]?.date
        }
      });
    }

    if (debtData && debtData.length > 0) {
      console.log('💳 [API] Sample debt data:', {
        firstDebt: debtData[0],
        totalDebt: debtData.reduce((sum: number, d: { current_balance?: number }) => sum + (d.current_balance || 0), 0)
      });
    }

    // Prepare data summary for the LLM
    console.log('📝 [API] Creating analysis prompt...');
    const prompt = createAnalysisPrompt(transactionData, debtData);
    
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
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a financial analyst AI that analyzes spending patterns and creates realistic spending projections. You must respond with valid JSON only, no additional text."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0,
      // max_tokens: 10000,
    });

    const apiCallDuration = Date.now() - apiCallStart;
    console.log('✅ [API] OpenAI API call completed in', apiCallDuration, 'ms');
    
    console.log('📊 [API] OpenAI response metadata:', {
      model: completion.model,
      usage: completion.usage,
      finishReason: completion.choices[0]?.finish_reason,
      responseLength: completion.choices[0]?.message?.content?.length || 0
    });

    const analysisResult = completion.choices[0].message.content;
    
    if (!analysisResult) {
      console.error('❌ [API] No analysis result from OpenAI');
      throw new Error('No analysis result from OpenAI');
    }

    console.log('📄 [API] Raw OpenAI response preview (first 500 chars):', 
      analysisResult.substring(0, 500) + '...');

    // Parse the JSON response
    console.log('🔄 [API] Parsing JSON response...');
    let analysis;
    try {
      analysis = JSON.parse(analysisResult);
      console.log('✅ [API] JSON parsing successful');
      console.log('📈 [API] Analysis summary:', {
        monthlyProjectionsCount: analysis.monthlyProjections?.length || 0,
        startingBalance: analysis.summary?.startingBalance,
        projectedEndBalance: analysis.summary?.projectedEndBalance,
        recommendationsCount: analysis.insights?.recommendations?.length || 0
      });
    } catch (parseError) {
      console.error('❌ [API] JSON parsing failed:', parseError);
      console.error('📄 [API] Raw response that failed to parse:', analysisResult);
      throw new Error(`Failed to parse OpenAI response as JSON: ${parseError}`);
    }

    const totalDuration = Date.now() - startTime;
    console.log('🎉 [API] Analysis completed successfully in', totalDuration, 'ms');

    return NextResponse.json(analysis);
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
  date?: string;
  description?: string;
  amount?: number;
  category?: string;
  account?: string;
  type?: string;
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

function createAnalysisPrompt(transactionData: TransactionDataInput[], debtData: DebtDataInput[]): string {
  let prompt = `Analyze the following financial data and create a 12-month spending projection. Return your response as valid JSON with this exact structure:

{
  "monthlyProjections": [
    {
      "month": 1,
      "date": "2024-01-01",
      "projectedBalance": 50000,
      "monthlyIncome": 4500,
      "monthlyExpenses": 3200,
      "debtPayments": 500,
      "netChange": 800
    }
    // ... 12 months total
  ],
  "insights": {
    "averageMonthlySpending": 3200,
    "primarySpendingCategories": ["Housing", "Food", "Transportation"],
    "spendingTrend": "increasing",
    "riskFactors": ["High debt-to-income ratio"],
    "recommendations": ["Reduce discretionary spending", "Focus on debt payoff"]
  },
  "summary": {
    "startingBalance": 50000,
    "projectedEndBalance": 45000,
    "totalDebtPayments": 6000,
    "averageMonthlyIncome": 4500
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
    
    // Include sample transactions
    prompt += `- Sample transactions:\n`;
    transactionData.slice(0, 10).forEach(t => {
      prompt += `  ${t.date}: ${t.description} - $${t.amount} (${t.category})\n`;
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

  prompt += `\nBased on this data, create realistic monthly projections that account for:
1. Seasonal spending variations
2. Debt payment obligations
3. Income stability
4. Spending pattern trends
5. Emergency fund considerations

Make the projections realistic and account for typical financial behavior patterns.`;

  return prompt;
}
