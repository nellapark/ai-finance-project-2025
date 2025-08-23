import Papa from 'papaparse';

export interface TransactionData {
  transaction_date: string;
  post_date: string;
  description: string;
  category: string;
  type: string;
  amount: number;
  memo: string;
}

export interface DebtData {
  account_type: string;
  account_name: string;
  current_balance: number;
  credit_limit?: number;
  original_amount?: number;
  interest_rate: number;
  minimum_payment: number;
  due_date: string;
  payment_history: string;
  account_status: string;
}

export function parseTransactionCSV(file: File): Promise<TransactionData[]> {
  console.log('📄 [CSV Parser] Starting transaction CSV parsing:', {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type
  });

  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transform: (value, field) => {
        // Convert amount to number
        if ((field as string) === 'Amount' || (field as string) === 'amount') {
          return parseFloat(String(value)) || 0;
        }
        return value;
      },
      complete: (results) => {
        try {
          console.log('📊 [CSV Parser] Raw parsing results:', {
            totalRows: results.data.length,
            errors: results.errors.length,
            meta: results.meta
          });

          if (results.errors.length > 0) {
            console.warn('⚠️ [CSV Parser] Parsing warnings:', results.errors);
          }

          const transactions: TransactionData[] = results.data.map((row: Record<string, any>, index: number) => {
            const transaction = {
              transaction_date: row['Transaction Date'] || row.transaction_date || row.Date || row.date || '',
              post_date: row['Post Date'] || row.post_date || row['Transaction Date'] || row.transaction_date || row.Date || row.date || '',
              description: row.Description || row.description || '',
              category: row.Category || row.category || '',
              type: row.Type || row.type || '',
              amount: parseFloat(row.Amount || row.amount || '0'),
              memo: row.Memo || row.memo || '',
            };

            if (index < 3) {
              console.log(`📝 [CSV Parser] Sample transaction ${index + 1}:`, transaction);
            }

            return transaction;
          });
          
          // Filter out invalid transactions
          const validTransactions = transactions.filter(t => 
            t.transaction_date && t.description && !isNaN(t.amount)
          );

          const invalidCount = transactions.length - validTransactions.length;
          
          console.log('✅ [CSV Parser] Transaction parsing completed:', {
            totalParsed: transactions.length,
            validTransactions: validTransactions.length,
            invalidTransactions: invalidCount,
            dateRange: validTransactions.length > 0 ? {
              first: validTransactions[0].transaction_date,
              last: validTransactions[validTransactions.length - 1].transaction_date
            } : null,
            totalAmount: validTransactions.reduce((sum, t) => sum + t.amount, 0)
          });

          if (invalidCount > 0) {
            console.warn('⚠️ [CSV Parser] Filtered out invalid transactions:', invalidCount);
          }
          
          resolve(validTransactions);
        } catch (error) {
          console.error('❌ [CSV Parser] Transaction parsing failed:', error);
          reject(new Error('Failed to parse transaction data'));
        }
      },
      error: (error) => {
        console.error('❌ [CSV Parser] CSV parsing error:', error);
        reject(new Error(`CSV parsing error: ${error.message}`));
      }
    });
  });
}

export function parseDebtCSV(file: File): Promise<DebtData[]> {
  console.log('📄 [CSV Parser] Starting debt CSV parsing:', {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type
  });

  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transform: (value, field) => {
        // Convert numeric fields
        const numericFields = [
          'Current_Balance', 'current_balance',
          'Credit_Limit', 'credit_limit',
          'Original_Amount', 'original_amount',
          'Interest_Rate', 'interest_rate',
          'Minimum_Payment', 'minimum_payment'
        ];
        
        if (numericFields.includes(field as string)) {
          return parseFloat(String(value)) || 0;
        }
        return value;
      },
      complete: (results) => {
        try {
          console.log('📊 [CSV Parser] Raw debt parsing results:', {
            totalRows: results.data.length,
            errors: results.errors.length,
            meta: results.meta
          });

          if (results.errors.length > 0) {
            console.warn('⚠️ [CSV Parser] Debt parsing warnings:', results.errors);
          }

          const debts: DebtData[] = results.data.map((row: Record<string, any>, index: number) => {
            const debt = {
              account_type: row.Account_Type || row.account_type || '',
              account_name: row.Account_Name || row.account_name || '',
              current_balance: parseFloat(row.Current_Balance || row.current_balance || '0'),
              credit_limit: parseFloat(row.Credit_Limit || row.credit_limit || '0') || undefined,
              original_amount: parseFloat(row.Original_Amount || row.original_amount || '0') || undefined,
              interest_rate: parseFloat(row.Interest_Rate || row.interest_rate || '0'),
              minimum_payment: parseFloat(row.Minimum_Payment || row.minimum_payment || '0'),
              due_date: row.Due_Date || row.due_date || '',
              payment_history: row.Payment_History || row.payment_history || '',
              account_status: row.Account_Status || row.account_status || '',
            };

            if (index < 3) {
              console.log(`💳 [CSV Parser] Sample debt ${index + 1}:`, debt);
            }

            return debt;
          });
          
          // Filter out invalid debt records
          const validDebts = debts.filter(d => 
            d.account_type && d.current_balance > 0
          );

          const invalidCount = debts.length - validDebts.length;
          const totalDebt = validDebts.reduce((sum, d) => sum + d.current_balance, 0);
          const totalMinPayments = validDebts.reduce((sum, d) => sum + d.minimum_payment, 0);
          
          console.log('✅ [CSV Parser] Debt parsing completed:', {
            totalParsed: debts.length,
            validDebts: validDebts.length,
            invalidDebts: invalidCount,
            totalDebtAmount: totalDebt,
            totalMinimumPayments: totalMinPayments,
            accountTypes: [...new Set(validDebts.map(d => d.account_type))]
          });

          if (invalidCount > 0) {
            console.warn('⚠️ [CSV Parser] Filtered out invalid debt records:', invalidCount);
          }
          
          resolve(validDebts);
        } catch (error) {
          console.error('❌ [CSV Parser] Debt parsing failed:', error);
          reject(new Error('Failed to parse debt data'));
        }
      },
      error: (error) => {
        console.error('❌ [CSV Parser] Debt CSV parsing error:', error);
        reject(new Error(`CSV parsing error: ${error.message}`));
      }
    });
  });
}
