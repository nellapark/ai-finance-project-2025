import cardDetails from '../../card-details/top-8-common-cards.json';
import { getCategoryDisplayName } from './businessCategoryMatcher';

export interface CardRecommendation {
  cardName: string;
  cardDisplayName: string;
  multiplier: number;
  rewardType: 'points' | 'cash_back' | 'miles';
  category: string;
  categoryDisplayName: string;
  description: string;
  annualFee?: number;
  isTopChoice: boolean;
}

export interface InstantCardAnalysis {
  businessName: string;
  rewardCategory: string;
  categoryDisplayName: string;
  recommendations: CardRecommendation[];
  bestCard: CardRecommendation | null;
  analysisTimestamp: number;
}

// Map card names to display names
const cardDisplayNames: Record<string, string> = {
  'CHASE_FREEDOM_UNLIMITED': 'Chase Freedom Unlimited',
  'WELLS_FARGO_ACTIVE_CASH': 'Wells Fargo Active Cash',
  'CAPITAL_ONE_SAVOR_REWARDS': 'Capital One Savor',
  'CITI_DOUBLE_CASH': 'Citi Double Cash',
  'CHASE_SAPPHIRE_RESERVE': 'Chase Sapphire Reserve',
  'AMEX_GOLD': 'American Express Gold',
  'AMEX_BLUE_CASH_PREFERRED': 'American Express Blue Cash Preferred',
  'CAPITAL_ONE_VENTURE_X_REWARDS': 'Capital One Venture X'
};

// Determine reward type based on card and description
function getRewardType(cardName: string, description: string): 'points' | 'cash_back' | 'miles' {
  const lowerDesc = description.toLowerCase();
  
  if (lowerDesc.includes('cash back') || lowerDesc.includes('cash')) {
    return 'cash_back';
  }
  
  if (lowerDesc.includes('miles') || cardName.includes('VENTURE')) {
    return 'miles';
  }
  
  return 'points';
}

// Get annual fee for a card (simplified - in real app would be in card data)
function getAnnualFee(cardName: string): number {
  const annualFees: Record<string, number> = {
    'CHASE_FREEDOM_UNLIMITED': 0,
    'WELLS_FARGO_ACTIVE_CASH': 0,
    'CAPITAL_ONE_SAVOR_REWARDS': 0,
    'CITI_DOUBLE_CASH': 0,
    'CHASE_SAPPHIRE_RESERVE': 550,
    'AMEX_GOLD': 250,
    'AMEX_BLUE_CASH_PREFERRED': 95,
    'CAPITAL_ONE_VENTURE_X_REWARDS': 395
  };
  
  return annualFees[cardName] || 0;
}

export function getInstantCardRecommendations(businessName: string, rewardCategory: string): InstantCardAnalysis {
  console.log('⚡ [Instant Matcher] Analyzing cards for:', { businessName, rewardCategory });
  
  const recommendations: CardRecommendation[] = [];
  
  // Iterate through all cards and find matches for the reward category
  Object.entries(cardDetails).forEach(([cardKey, cardData]) => {
    const cardInfo = cardData as Record<string, unknown>;
    const rewards = (cardInfo.rewards as Array<Record<string, unknown>>) || [];
    
    // Find the best multiplier for this category
    let bestMultiplier = 0;
    let bestReward: Record<string, unknown> | null = null;
    
    // Check for exact category match
    rewards.forEach((reward: Record<string, unknown>) => {
      if (reward.category === rewardCategory && (reward.multiplier as number) > bestMultiplier) {
        bestMultiplier = reward.multiplier as number;
        bestReward = reward;
      }
    });
    
    // If no exact match, check for catch-all category
    if (bestMultiplier === 0) {
      rewards.forEach((reward: Record<string, unknown>) => {
        if (reward.category === 'catch_all_general_purchases' && (reward.multiplier as number) > bestMultiplier) {
          bestMultiplier = reward.multiplier as number;
          bestReward = reward;
        }
      });
    }
    
    // If we found a reward, add it to recommendations
    if (bestReward && bestMultiplier > 0) {
      const cardRecommendation: CardRecommendation = {
        cardName: cardKey,
        cardDisplayName: cardDisplayNames[cardKey] || cardKey.replace(/_/g, ' '),
        multiplier: bestMultiplier,
        rewardType: getRewardType(cardKey, (bestReward.description as string) || ''),
        category: bestReward.category as string,
        categoryDisplayName: getCategoryDisplayName(bestReward.category as string),
        description: (bestReward.description as string) || `${bestMultiplier}x rewards on ${getCategoryDisplayName(bestReward.category as string)}`,
        annualFee: getAnnualFee(cardKey),
        isTopChoice: false // Will be set later
      };
      
      recommendations.push(cardRecommendation);
    }
  });
  
  // Sort by multiplier (descending), then by annual fee (ascending)
  recommendations.sort((a, b) => {
    if (b.multiplier !== a.multiplier) {
      return b.multiplier - a.multiplier;
    }
    return (a.annualFee || 0) - (b.annualFee || 0);
  });
  
  // Mark the top choice
  if (recommendations.length > 0) {
    recommendations[0].isTopChoice = true;
  }
  
  console.log('✅ [Instant Matcher] Found recommendations:', {
    count: recommendations.length,
    topCard: recommendations[0]?.cardDisplayName,
    topMultiplier: recommendations[0]?.multiplier
  });
  
  return {
    businessName,
    rewardCategory,
    categoryDisplayName: getCategoryDisplayName(rewardCategory),
    recommendations,
    bestCard: recommendations[0] || null,
    analysisTimestamp: Date.now()
  };
}

// Calculate potential value for a spending amount
export function calculatePotentialValue(recommendation: CardRecommendation, spendingAmount: number): number {
  const baseValue = spendingAmount * (recommendation.multiplier / 100);
  
  // Adjust value based on reward type
  switch (recommendation.rewardType) {
    case 'cash_back':
      return baseValue; // Direct cash value
    case 'points':
      return baseValue * 1.2; // Assume 1.2 cents per point average
    case 'miles':
      return baseValue * 1.5; // Assume 1.5 cents per mile average
    default:
      return baseValue;
  }
}

// Get category-specific spending estimates
export function getEstimatedMonthlySpending(rewardCategory: string): number {
  const estimates: Record<string, number> = {
    dining: 400,
    grocery: 500,
    gas_stations: 200,
    travel_general: 300,
    travel_flights: 200,
    travel_hotels: 250,
    entertainment_and_recreation: 150,
    streaming_services: 50,
    drugstores_and_pharmacies: 100,
    fitness_and_wellness: 100,
    transit_and_rideshare: 150,
    catch_all_general_purchases: 200
  };
  
  return estimates[rewardCategory] || 200;
}
