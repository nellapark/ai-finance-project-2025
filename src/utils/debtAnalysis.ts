export interface DebtAccount {
  accountName: string;
  accountType: string;
  balance: number;
  apr: number;
  minimumPayment: number;
  creditLimit?: number;
}

export interface DebtInsight {
  id: string;
  type: 'balance_transfer' | 'payoff_strategy' | 'refinance' | 'utilization' | 'warning';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  potentialSavings?: number;
  actionItems: string[];
  icon: string;
}

export function analyzeDebtData(debtAccounts: DebtAccount[]): DebtInsight[] {
  const insights: DebtInsight[] = [];
  
  // Filter accounts with balances
  const accountsWithBalance = debtAccounts.filter(account => account.balance > 0);
  
  if (accountsWithBalance.length === 0) {
    insights.push({
      id: 'no_debt',
      type: 'warning',
      title: '🎉 Excellent Debt Management!',
      description: 'You have no outstanding debt balances. This puts you in a great position to focus on maximizing rewards and building wealth.',
      priority: 'low',
      actionItems: [
        'Continue using credit cards responsibly',
        'Focus on maximizing rewards from your spending',
        'Consider investing surplus funds for long-term growth'
      ],
      icon: '🎉'
    });
    return insights;
  }

  // 1. High APR Balance Transfer Opportunities
  const highAprAccounts = accountsWithBalance.filter(account => account.apr > 15);
  if (highAprAccounts.length > 0) {
    const totalHighAprBalance = highAprAccounts.reduce((sum, account) => sum + account.balance, 0);
    const avgApr = highAprAccounts.reduce((sum, account) => sum + account.apr, 0) / highAprAccounts.length;
    const annualInterest = totalHighAprBalance * (avgApr / 100);
    
    insights.push({
      id: 'balance_transfer',
      type: 'balance_transfer',
      title: '💳 Balance Transfer Opportunity Detected',
      description: `You have $${totalHighAprBalance.toLocaleString()} in high-APR debt (avg ${avgApr.toFixed(1)}% APR). A 0% APR balance transfer card could save you significant interest.`,
      priority: 'high',
      potentialSavings: annualInterest * 0.75, // Assume 18 months at 0%
      actionItems: [
        'Apply for a 0% APR balance transfer card (Chase Slate Edge, Citi Simplicity)',
        `Transfer $${totalHighAprBalance.toLocaleString()} to eliminate interest charges`,
        'Create aggressive payoff plan during 0% period',
        'Avoid new purchases on transferred balances'
      ],
      icon: '💳'
    });
  }

  // 2. Debt Avalanche Strategy
  if (accountsWithBalance.length > 1) {
    const sortedByApr = [...accountsWithBalance].sort((a, b) => b.apr - a.balance);
    const highestAprAccount = sortedByApr[0];
    const totalMinPayments = accountsWithBalance.reduce((sum, account) => sum + account.minimumPayment, 0);
    
    insights.push({
      id: 'debt_avalanche',
      type: 'payoff_strategy',
      title: '🎯 Optimal Debt Payoff Strategy',
      description: `Using the mathematically optimal "Debt Avalanche" method, focus extra payments on ${highestAprAccount.accountName} (${highestAprAccount.apr}% APR) first.`,
      priority: 'medium',
      potentialSavings: calculateAvalancheSavings(accountsWithBalance),
      actionItems: [
        `Pay minimum on all accounts ($${totalMinPayments.toLocaleString()}/month)`,
        `Put ALL extra payments toward ${highestAprAccount.accountName}`,
        `After paying off ${highestAprAccount.accountName}, target next highest APR`,
        'Consider increasing monthly payment by 20-50% if possible'
      ],
      icon: '🎯'
    });
  }

  // 3. Credit Utilization Warnings
  const creditCards = accountsWithBalance.filter(account => 
    account.accountType.toLowerCase().includes('credit') && account.creditLimit
  );
  
  const highUtilizationCards = creditCards.filter(account => 
    account.creditLimit && (account.balance / account.creditLimit) > 0.3
  );
  
  if (highUtilizationCards.length > 0) {
    const avgUtilization = highUtilizationCards.reduce((sum, account) => 
      sum + (account.balance / (account.creditLimit || 1)), 0
    ) / highUtilizationCards.length;
    
    insights.push({
      id: 'high_utilization',
      type: 'utilization',
      title: '⚠️ High Credit Utilization Detected',
      description: `${highUtilizationCards.length} card(s) have >30% utilization (avg ${(avgUtilization * 100).toFixed(1)}%). This may be hurting your credit score.`,
      priority: 'medium',
      actionItems: [
        'Pay down balances to below 30% of credit limits',
        'Consider making multiple payments per month',
        'Request credit limit increases on existing cards',
        'Avoid closing old credit cards (reduces available credit)'
      ],
      icon: '⚠️'
    });
  }

  // 4. Refinancing Opportunities
  const mortgageAccounts = accountsWithBalance.filter(account => 
    account.accountType.toLowerCase().includes('mortgage') || 
    account.accountType.toLowerCase().includes('home')
  );
  
  if (mortgageAccounts.length > 0) {
    const highRateMortgages = mortgageAccounts.filter(account => account.apr > 5.5);
    if (highRateMortgages.length > 0) {
      const totalMortgageBalance = highRateMortgages.reduce((sum, account) => sum + account.balance, 0);
      const avgMortgageRate = highRateMortgages.reduce((sum, account) => sum + account.apr, 0) / highRateMortgages.length;
      
      insights.push({
        id: 'refinance_opportunity',
        type: 'refinance',
        title: '🏠 Mortgage Refinancing Opportunity',
        description: `Your mortgage rate of ${avgMortgageRate.toFixed(2)}% may be higher than current market rates. Refinancing could reduce monthly payments.`,
        priority: 'medium',
        potentialSavings: totalMortgageBalance * 0.01, // Rough estimate of 1% rate reduction
        actionItems: [
          'Check current mortgage rates with multiple lenders',
          'Calculate break-even point including closing costs',
          'Consider cash-out refinancing for debt consolidation',
          'Shop around for best rates and terms'
        ],
        icon: '🏠'
      });
    }
  }

  // 5. Emergency High-Interest Warning
  const emergencyHighApr = accountsWithBalance.filter(account => account.apr > 25);
  if (emergencyHighApr.length > 0) {
    const totalEmergencyDebt = emergencyHighApr.reduce((sum, account) => sum + account.balance, 0);
    
    insights.push({
      id: 'emergency_high_apr',
      type: 'warning',
      title: '🚨 Emergency: Extremely High Interest Debt',
      description: `You have $${totalEmergencyDebt.toLocaleString()} in extremely high-interest debt (>25% APR). This should be your absolute top priority.`,
      priority: 'high',
      actionItems: [
        'Stop all non-essential spending immediately',
        'Consider personal loan for debt consolidation (lower APR)',
        'Look into credit counseling services',
        'Negotiate payment plans with creditors',
        'Consider balance transfer as emergency measure'
      ],
      icon: '🚨'
    });
  }

  // Sort insights by priority
  return insights.sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });
}

function calculateAvalancheSavings(accounts: DebtAccount[]): number {
  // Simplified calculation - assumes extra $200/month payment
  const extraPayment = 200;
  const totalBalance = accounts.reduce((sum, account) => sum + account.balance, 0);
  const weightedAvgApr = accounts.reduce((sum, account) => 
    sum + (account.balance / totalBalance) * account.apr, 0
  );
  
  // Rough estimate of interest savings over 2 years
  return (totalBalance * (weightedAvgApr / 100) * 2) * 0.3; // 30% savings estimate
}

export function parseDebtCSV(csvContent: string): DebtAccount[] {
  const lines = csvContent.trim().split('\n').filter(line => line.trim() !== '');
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/_/g, ''));
  
  const accounts: DebtAccount[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    
    if (values.length < headers.length || values.every(v => v === '')) continue;
    
    // Handle both old and new CSV formats
    const account: DebtAccount = {
      accountName: values[headers.indexOf('accountname')] || 
                  values[headers.indexOf('account')] || 
                  values[1] || // Second column in sample-debt-accounts.csv
                  `Account ${i}`,
      accountType: values[headers.indexOf('accounttype')] || 
                  values[headers.indexOf('type')] || 
                  values[0] || // First column in sample-debt-accounts.csv
                  'Credit Card',
      balance: parseFloat(values[headers.indexOf('currentbalance')] || 
                         values[headers.indexOf('balance')] || 
                         values[2] || // Third column in sample-debt-accounts.csv
                         '0'),
      apr: parseFloat(values[headers.indexOf('interestrate')] || 
                     values[headers.indexOf('apr')] || 
                     values[3] || // Fourth column in sample-debt-accounts.csv
                     '0'),
      minimumPayment: parseFloat(values[headers.indexOf('minimumpayment')] || 
                                values[headers.indexOf('minpayment')] || 
                                values[4] || // Fifth column in sample-debt-accounts.csv
                                '0'),
      creditLimit: parseFloat(values[headers.indexOf('creditlimit')] || 
                             values[headers.indexOf('limit')] || 
                             values[6] || // Seventh column in sample-debt-accounts.csv
                             '0') || undefined
    };
    
    accounts.push(account);
  }
  
  return accounts;
}
