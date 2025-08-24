import Fuse from 'fuse.js';
import rewardCategories from '../../card-details/reward-categories.json';
import cardDetails from '../../card-details/top-8-common-cards.json';

export interface TransactionWithRewards {
  date: string;
  description: string;
  amount: number;
  category: string;
  account: string;
  type: string;
  confidence: number;
  isRecurring: boolean;
  recurringPattern: string | null;
  credit_card?: string;
  // New fields for optimization
  rewardCategory: string;
  optimalCard: string;
  optimalPoints: number;
  actualPoints: number;
  isOptimal: boolean;
}

export interface CardReward {
  name: string;
  multiplier: number;
  description: string | null;
  category: string;
}

export interface CardDetails {
  rewards: CardReward[];
  credits: Array<{
    name: string;
    description: string;
    annualCredit: number | null;
    recurringRateTimesInYear: number | null;
  }>;
  targetCreditScore: string;
  signUpBonus: string;
}

// Fuzzy matching options for categories
const fuseOptions = {
  includeScore: true,
  threshold: 0.6, // Lower = more strict matching
  keys: ['category', 'description']
};

// Create search data for fuzzy matching
const categorySearchData = rewardCategories.rewardCategories.map(category => ({
  category,
  description: rewardCategories.categoryDescriptions[category as keyof typeof rewardCategories.categoryDescriptions]
}));

const fuse = new Fuse(categorySearchData, fuseOptions);

/**
 * Fuzzy match a transaction category to a reward category
 */
export function matchTransactionToRewardCategory(transactionCategory: string, description?: string): string {
  if (!transactionCategory) {
    return 'catch_all_general_purchases';
  }

  // First try exact matches (case insensitive)
  const exactMatch = rewardCategories.rewardCategories.find(category => 
    category.toLowerCase() === transactionCategory.toLowerCase()
  );
  
  if (exactMatch) {
    return exactMatch;
  }

  // Try fuzzy matching on category
  const searchText = `${transactionCategory} ${description || ''}`.toLowerCase();
  const results = fuse.search(searchText);

  if (results.length > 0 && results[0].score && results[0].score < 0.6) {
    return results[0].item.category;
  }

  // Manual mapping for common transaction categories
  const categoryMappings: Record<string, string> = {
    'food & drink': 'dining',
    'food': 'dining',
    'restaurants': 'dining',
    'groceries': 'grocery',
    'supermarkets': 'grocery',
    'travel': 'travel_general',
    'transportation': 'transit_and_rideshare',
    'gas': 'gas_stations',
    'fuel': 'gas_stations',
    'entertainment': 'entertainment_and_recreation',
    'streaming': 'streaming_services',
    'subscriptions': 'streaming_services',
    'pharmacy': 'drugstores_and_pharmacies',
    'health': 'drugstores_and_pharmacies',
    'fitness': 'fitness_and_wellness',
    'gym': 'fitness_and_wellness',
    'shopping': 'catch_all_general_purchases',
    'bills & utilities': 'catch_all_general_purchases',
    'personal': 'catch_all_general_purchases',
    'automotive': 'catch_all_general_purchases',
    'home': 'catch_all_general_purchases'
  };

  const mappedCategory = categoryMappings[transactionCategory.toLowerCase()];
  if (mappedCategory) {
    return mappedCategory;
  }

  // Default to catch-all
  return 'catch_all_general_purchases';
}

/**
 * Find the best card for a given reward category
 */
export function findBestCardForCategory(rewardCategory: string): { cardName: string; multiplier: number } {
  let bestCard = '';
  let bestMultiplier = 1; // Default 1x points

  Object.entries(cardDetails).forEach(([cardName, details]) => {
    const cardData = details as CardDetails;
    const matchingReward = cardData.rewards.find(reward => reward.category === rewardCategory);
    
    if (matchingReward && matchingReward.multiplier > bestMultiplier) {
      bestCard = cardName;
      bestMultiplier = matchingReward.multiplier;
    }
  });

  return {
    cardName: bestCard || 'AMEX_GOLD', // Default fallback
    multiplier: bestMultiplier
  };
}

/**
 * Get the actual points for a transaction based on the card used
 */
export function getActualPointsForTransaction(
  rewardCategory: string, 
  cardUsed: string, 
  amount: number
): number {
  if (!cardUsed || !cardDetails[cardUsed as keyof typeof cardDetails]) {
    return Math.abs(amount) * 1; // Default 1x points
  }

  const cardData = cardDetails[cardUsed as keyof typeof cardDetails] as CardDetails;
  const matchingReward = cardData.rewards.find(reward => reward.category === rewardCategory);
  
  const multiplier = matchingReward ? matchingReward.multiplier : 1;
  return Math.abs(amount) * multiplier;
}

/**
 * Process transactions to add reward optimization data
 */
export function processTransactionsWithRewards(transactions: Array<{
  date: string;
  description: string;
  amount: number;
  category: string;
  account: string;
  type: string;
  confidence: number;
  isRecurring: boolean;
  recurringPattern: string | null;
  credit_card?: string;
}>): TransactionWithRewards[] {
  return transactions.map(transaction => {
    // Match category to reward category
    const rewardCategory = matchTransactionToRewardCategory(
      transaction.category, 
      transaction.description
    );

    // Find optimal card for this category
    const { cardName: optimalCard, multiplier: optimalMultiplier } = findBestCardForCategory(rewardCategory);

    // Calculate optimal points
    const optimalPoints = Math.abs(transaction.amount) * optimalMultiplier;

    // Calculate actual points based on card used
    const actualPoints = getActualPointsForTransaction(
      rewardCategory, 
      transaction.credit_card || '', 
      transaction.amount
    );

    // Check if the user used the optimal card
    const isOptimal = transaction.credit_card === optimalCard;

    return {
      ...transaction,
      rewardCategory,
      optimalCard,
      optimalPoints,
      actualPoints,
      isOptimal
    };
  });
}

/**
 * Calculate cumulative points over time
 */
export function calculateCumulativePoints(transactions: TransactionWithRewards[]): {
  optimalCumulative: number[];
  actualCumulative: number[];
  dates: string[];
} {
  const sortedTransactions = [...transactions].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let optimalTotal = 0;
  let actualTotal = 0;
  
  const optimalCumulative: number[] = [];
  const actualCumulative: number[] = [];
  const dates: string[] = [];

  sortedTransactions.forEach(transaction => {
    optimalTotal += transaction.optimalPoints;
    actualTotal += transaction.actualPoints;
    
    optimalCumulative.push(optimalTotal);
    actualCumulative.push(actualTotal);
    dates.push(transaction.date);
  });

  return {
    optimalCumulative,
    actualCumulative,
    dates
  };
}

/**
 * Get optimization summary statistics
 */
export function getOptimizationSummary(transactions: TransactionWithRewards[]): {
  totalOptimalPoints: number;
  totalActualPoints: number;
  pointsLost: number;
  optimizationRate: number;
  nonOptimalTransactions: number;
  totalTransactions: number;
} {
  const totalOptimalPoints = transactions.reduce((sum, t) => sum + t.optimalPoints, 0);
  const totalActualPoints = transactions.reduce((sum, t) => sum + t.actualPoints, 0);
  const pointsLost = totalOptimalPoints - totalActualPoints;
  const optimizationRate = totalOptimalPoints > 0 ? (totalActualPoints / totalOptimalPoints) * 100 : 100;
  const nonOptimalTransactions = transactions.filter(t => !t.isOptimal).length;

  return {
    totalOptimalPoints,
    totalActualPoints,
    pointsLost,
    optimizationRate,
    nonOptimalTransactions,
    totalTransactions: transactions.length
  };
}
