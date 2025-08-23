# Sample Financial Data Files

This folder contains sample data files that you can use to test the Spending Simulation feature. These files contain realistic but fictional financial data.

## Available Files

### Transaction Data
- **`sample-transaction-data.csv`** - Comprehensive transaction history in CSV format
- **`simple-transaction-data.csv`** - Simplified transaction data with basic monthly transactions

### Debt & Credit Information  
- **`sample-debt-data.csv`** - Credit cards, loans, and debt information in CSV format

## How to Use

1. **Access the Spending Simulation**: Navigate to the main page of the application
2. **Click "Connect Your Banks"**: This opens the file upload modal
3. **Upload Sample Files**: 
   - Drag and drop or browse to select one or both sample CSV files
4. **Process Data**: Click "Process Data" to analyze the uploaded information
5. **View Results**: See your personalized spending simulation and insights

## File Format Supported

### CSV Format
- **Headers required**: First row must contain column names
- **Encoding**: UTF-8
- **Delimiter**: Comma (,)

## Sample Data Overview

### Transaction Data Includes:
- **6 months** of transaction history (Jan-Jun 2024)
- **75+ transactions** across various categories
- **Realistic spending patterns**:
  - Monthly salary deposits ($4,500)
  - Rent payments ($1,800/month)
  - Groceries, dining, utilities, transportation
  - Entertainment, shopping, healthcare expenses

### Debt Data Includes:
- **10 different accounts** across various debt types
- **Credit Cards**: Chase, Capital One, Discover, Amazon, Target
- **Loans**: Auto loan, mortgage, student loan, personal loan, HELOC
- **Key Information**:
  - Current balances and credit limits
  - Interest rates (3.75% - 24.99%)
  - Minimum payments and due dates
  - Payment history status

## Expected Results

When you upload these sample files, you should see:

- **Starting Balance**: ~$75,000
- **Average Monthly Spending**: ~$3,000-4,500
- **Debt Obligations**: ~$320,000 total debt
- **Monthly Debt Payments**: ~$2,500

The spending simulation will show how your balance changes over time considering both your spending patterns and debt obligations.

## Privacy Note

These are completely fictional sample files created for demonstration purposes. No real financial data is included. Your actual financial data uploaded to the application is processed locally in your browser and never sent to any servers.

## File Details

### Transaction Data Fields:
- `Date`: Transaction date (YYYY-MM-DD)
- `Description`: Transaction description
- `Amount`: Transaction amount (negative for expenses, positive for income)
- `Category`: Spending category
- `Account`: Account type (Checking, Credit Card, etc.)
- `Type`: Credit or Debit

### Debt Data Fields:
- `Account_Type`: Type of debt account
- `Account_Name`: Name/description of account
- `Current_Balance`: Outstanding balance
- `Credit_Limit` / `Original_Amount`: Credit limit or original loan amount
- `Interest_Rate`: Annual percentage rate
- `Minimum_Payment`: Required monthly payment
- `Due_Date`: Next payment due date
- `Payment_History`: Payment status
- `Account_Status`: Account status (Active, Closed, etc.)
