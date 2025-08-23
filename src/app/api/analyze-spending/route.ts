import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log('🚀 [API] Starting spending analysis request');
  
  try {
    const { transactionData, debtData, isTesting = false } = await request.json();
    
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
        
        return NextResponse.json(analysis);
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
      model: "gpt-5-mini",
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
      // Clean the response to remove any comments or invalid JSON
      let cleanedResponse = analysisResult;
      
      // Remove JavaScript-style comments
      cleanedResponse = cleanedResponse.replace(/\/\/.*$/gm, '');
      
      // Remove any trailing commas before closing brackets/braces
      cleanedResponse = cleanedResponse.replace(/,(\s*[}\]])/g, '$1');
      
      // Try to find and extract just the JSON object
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedResponse = jsonMatch[0];
      }
      
      console.log('🧹 [API] Cleaned response length:', cleanedResponse.length);
      
      analysis = JSON.parse(cleanedResponse);
      console.log('✅ [API] JSON parsing successful');
      console.log('📈 [API] Analysis summary:', {
        simulatedTransactionsCount: analysis.simulatedTransactions?.length || 0,
        recurringTransactionsCount: analysis.patterns?.recurringTransactions?.length || 0,
        significantTransactionsCount: analysis.patterns?.significantTransactions?.length || 0,
        seasonalPatternsCount: analysis.patterns?.seasonalPatterns?.length || 0,
        recommendationsCount: analysis.insights?.recommendations?.length || 0,
        totalPredictedTransactions: analysis.insights?.totalPredictedTransactions || 0
      });

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
      const fallbackTransactions = generateFallbackTransactions(transactionData, debtData);
      analysis = createMockAnalysis(fallbackTransactions);
      
      console.log('✅ [API] Created fallback analysis with', fallbackTransactions.length, 'transactions');
    }

    const totalDuration = Date.now() - startTime;
    console.log('🎉 [API] Analysis completed successfully in', totalDuration, 'ms');

    // Check if we have enough transactions, if not, generate fallback data
    if (!analysis.simulatedTransactions || analysis.simulatedTransactions.length < 50) {
      console.log('⚠️ [API] Insufficient transactions generated, creating fallback data');
      analysis.simulatedTransactions = generateFallbackTransactions(transactionData, debtData);
      console.log(`📊 [API] Generated ${analysis.simulatedTransactions.length} fallback transactions`);
    }

    // Export simulated transactions to CSV
    try {
      await exportTransactionsToCSV(analysis.simulatedTransactions);
      console.log('📄 [API] Transactions exported to CSV successfully');
    } catch (exportError) {
      console.error('❌ [API] Failed to export transactions to CSV:', exportError);
    }

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

function createAnalysisPrompt(transactionData: TransactionDataInput[], debtData: DebtDataInput[]): string {
  let prompt = `Analyze the following financial data and simulate individual CREDIT CARD transactions for the next 12 months. 

IMPORTANT: Generate ONLY credit card transactions. Do not include:
- Salary deposits or income
- Rent payments or mortgage payments  
- Bank transfers or direct debits
- Loan payments or debt payments

Focus on credit card spending patterns, recurring subscriptions, and purchases. 

CRITICAL: Return ONLY valid JSON. Do not include:
- Comments (// or /* */)
- Explanatory text before or after JSON
- Trailing commas
- Any text outside the JSON object

Return your response as valid JSON with this exact structure:

{
  "simulatedTransactions": [
    {
      "date": "2024-07-05",
      "description": "Grocery Store",
      "amount": -127.43,
      "category": "Groceries",
      "account": "Credit Card",
      "type": "Debit",
      "confidence": 0.75,
      "isRecurring": false,
      "recurringPattern": null
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
      "recurringPattern": "monthly"
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
      "recurringPattern": null
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
        "description": "Large purchase pattern",
        "averageAmount": -500.00,
        "frequency": "quarterly",
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
    "totalPredictedTransactions": 150,
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

  prompt += `\nBased on this data, simulate individual transactions for the next 12 months by:

1. IDENTIFYING PATTERNS FROM HISTORICAL DATA:
   - Find ALL recurring transactions (salary, rent, utilities, subscriptions, loan payments)
   - Calculate average amounts and frequencies for each recurring transaction
   - Detect seasonal patterns (higher utilities in summer/winter, holiday spending)
   - Identify irregular large purchases and their typical frequency
   - Analyze spending categories and their typical amounts and frequency

2. GENERATING COMPREHENSIVE TRANSACTIONS (MINIMUM 150 TRANSACTIONS):
   - Create monthly recurring transactions: salary (1x/month), rent (1x/month), utilities (1x/month)
   - Add weekly/bi-weekly transactions: groceries (4x/month), gas (2x/month), dining (8x/month)
   - Include debt payments from debt data as monthly recurring transactions
   - Add variable expenses: shopping, entertainment, healthcare, subscriptions
   - Vary amounts realistically: groceries ($80-150), gas ($35-65), dining ($15-80)
   - Account for seasonal variations: utilities +30% in summer/winter, holiday spending in Dec
   - Include occasional large purchases based on historical patterns (quarterly/annually)

3. TRANSACTION DISTRIBUTION PER MONTH:
   - Month 1-12: Each month should have 12-20 transactions minimum
   - Include: 1 salary, 1 rent, 1-2 utilities, 4 groceries, 2 gas, 6-10 other expenses
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
   - Low confidence (0.5-0.7): Irregular purchases, entertainment, large purchases

CRITICAL REQUIREMENTS:
1. Generate EXACTLY 150-200 individual transactions covering the full 12-month period
2. Each month must have 12-17 transactions
3. Do NOT include comments like "// ... continue for 12 months"
4. Return ONLY valid JSON - no explanatory text
5. Ensure all JSON arrays are properly closed with commas between elements
6. Focus on creating a realistic spending simulation that mirrors the user's historical patterns

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
  const csvHeader = 'Date,Description,Amount,Category,Account,Type,Confidence,IsRecurring,RecurringPattern\n';

  // Convert transactions to CSV rows
  const csvRows = transactions.map((transaction: FallbackTransaction) => {
    const date = transaction.date || '';
    const description = (transaction.description || '').replace(/,/g, ';'); // Replace commas to avoid CSV issues
    const amount = transaction.amount || 0;
    const category = (transaction.category || '').replace(/,/g, ';');
    const account = (transaction.account || '').replace(/,/g, ';');
    const type = transaction.type || '';
    const confidence = transaction.confidence || 0;
    const isRecurring = transaction.isRecurring || false;
    const recurringPattern = (transaction.recurringPattern || '').replace(/,/g, ';');

    return `${date},"${description}",${amount},"${category}","${account}","${type}",${confidence},${isRecurring},"${recurringPattern}"`;
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
}

function generateFallbackTransactions(_transactionData: TransactionDataInput[], debtData: DebtDataInput[]): FallbackTransaction[] {
  console.log('🔄 [Fallback] Generating fallback transactions');
  
  const transactions: FallbackTransaction[] = [];
  const startDate = new Date('2024-07-01');
  
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
      recurringPattern: 'monthly'
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
        recurringPattern: null
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
        recurringPattern: null
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
        recurringPattern: null
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
            recurringPattern: index < 2 ? 'monthly' : 'quarterly'
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
        recurringPattern: null
      });
    }
  }
  
  // Sort by date
  transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  console.log(`✅ [Fallback] Generated ${transactions.length} fallback transactions`);
  return transactions;
}

async function readExistingCSV(): Promise<FallbackTransaction[]> {
  console.log('📄 [Testing] Reading existing CSV file from simulated-outputs');
  
  const outputDir = path.join(process.cwd(), 'simulated-outputs');
  
  if (!fs.existsSync(outputDir)) {
    throw new Error('simulated-outputs directory does not exist');
  }
  
  // Find any CSV file in the directory
  const files = fs.readdirSync(outputDir)
    .filter(file => file.endsWith('.csv'))
    .sort()
    .reverse(); // Most recent first
  
  if (files.length === 0) {
    throw new Error('No CSV files found in simulated-outputs directory');
  }
  
  const csvFile = files[0];
  const csvPath = path.join(outputDir, csvFile);
  
  console.log(`📄 [Testing] Using CSV file: ${csvFile}`);
  
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
    
    if (values.length >= 9) {
      transactions.push({
        date: values[0],
        description: values[1].replace(/"/g, ''),
        amount: parseFloat(values[2]) || 0,
        category: values[3].replace(/"/g, ''),
        account: values[4].replace(/"/g, ''),
        type: values[5].replace(/"/g, ''),
        confidence: parseFloat(values[6]) || 0,
        isRecurring: values[7].toLowerCase() === 'true',
        recurringPattern: values[8].replace(/"/g, '') || null
      });
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
  
  const significantTransactions = expenses
    .filter(t => Math.abs(t.amount) > 500)
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
