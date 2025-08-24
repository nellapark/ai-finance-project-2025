import Fuse from 'fuse.js';
import rewardCategories from '../../card-details/reward-categories.json';

// Levenshtein distance calculation
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i++) {
    matrix[0][i] = i;
  }

  for (let j = 0; j <= str2.length; j++) {
    matrix[j][0] = j;
  }

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }

  return matrix[str2.length][str1.length];
}

// Calculate similarity score (0-1, where 1 is perfect match)
function calculateSimilarity(str1: string, str2: string): number {
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 1;
  
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  return 1 - (distance / maxLength);
}

// Business type to reward category mappings
const businessTypeMapping: Record<string, string> = {
  // Dining
  'restaurant': 'dining',
  'food': 'dining',
  'meal_takeaway': 'dining',
  'meal_delivery': 'dining',
  'bar': 'dining',
  'cafe': 'dining',
  'bakery': 'dining',
  'fast_food': 'dining',
  
  // Grocery
  'grocery_or_supermarket': 'grocery',
  'supermarket': 'grocery',
  'convenience_store': 'grocery',
  'liquor_store': 'grocery',
  
  // Travel
  'lodging': 'travel_hotels',
  'hotel': 'travel_hotels',
  'airport': 'travel_flights',
  'travel_agency': 'travel_general',
  'tourist_attraction': 'travel_general',
  
  // Gas
  'gas_station': 'gas_stations',
  'fuel': 'gas_stations',
  
  // Entertainment
  'movie_theater': 'entertainment_and_recreation',
  'amusement_park': 'entertainment_and_recreation',
  'bowling_alley': 'entertainment_and_recreation',
  'casino': 'entertainment_and_recreation',
  'night_club': 'entertainment_and_recreation',
  'zoo': 'entertainment_and_recreation',
  'aquarium': 'entertainment_and_recreation',
  
  // Pharmacy
  'pharmacy': 'drugstores_and_pharmacies',
  'drugstore': 'drugstores_and_pharmacies',
  'health': 'drugstores_and_pharmacies',
  
  // Fitness
  'gym': 'fitness_and_wellness',
  'spa': 'fitness_and_wellness',
  'fitness': 'fitness_and_wellness',
  
  // Transit
  'taxi_stand': 'transit_and_rideshare',
  'subway_station': 'transit_and_rideshare',
  'bus_station': 'transit_and_rideshare',
  'train_station': 'transit_and_rideshare',
};

// Business name patterns for specific matching
const businessNamePatterns: Record<string, string> = {
  // Specific dining chains
  'starbucks': 'dining',
  'mcdonalds': 'dining',
  'subway': 'dining',
  'chipotle': 'dining',
  'five guys': 'dining',
  'cheesecake factory': 'dining',
  
  // Grocery chains
  'walmart': 'grocery',
  'target': 'grocery',
  'costco': 'grocery',
  'whole foods': 'grocery',
  'trader joe': 'grocery',
  
  // Gas stations
  'shell': 'gas_stations',
  'chevron': 'gas_stations',
  'exxon': 'gas_stations',
  'bp': 'gas_stations',
  
  // Pharmacies
  'cvs': 'drugstores_and_pharmacies',
  'walgreens': 'drugstores_and_pharmacies',
  'rite aid': 'drugstores_and_pharmacies',
  
  // Streaming (for online services)
  'netflix': 'streaming_services',
  'spotify': 'streaming_services',
  'hulu': 'streaming_services',
};

export function fuzzyMatchCategory(businessTypes: string[], businessName: string): string {
  console.log('🔍 [Category Matcher] Matching business:', { businessName, businessTypes });
  
  // First, try exact business type mapping
  for (const type of businessTypes) {
    const normalizedType = type.toLowerCase().replace(/_/g, ' ');
    if (businessTypeMapping[type] || businessTypeMapping[normalizedType]) {
      const category = businessTypeMapping[type] || businessTypeMapping[normalizedType];
      console.log('✅ [Category Matcher] Exact type match:', { type, category });
      return category;
    }
  }
  
  // Second, try business name pattern matching
  const normalizedName = businessName.toLowerCase();
  for (const [pattern, category] of Object.entries(businessNamePatterns)) {
    if (normalizedName.includes(pattern)) {
      console.log('✅ [Category Matcher] Name pattern match:', { pattern, category });
      return category;
    }
  }
  
  // Third, try fuzzy matching with reward categories
  const categoryDescriptions = rewardCategories.categoryDescriptions;
  const searchableCategories = Object.entries(categoryDescriptions).map(([key, description]) => ({
    key,
    description: description.toLowerCase(),
    searchText: `${key.replace(/_/g, ' ')} ${description}`.toLowerCase()
  }));
  
  // Create Fuse instance for fuzzy search
  const fuse = new Fuse(searchableCategories, {
    keys: ['searchText', 'description'],
    threshold: 0.4, // More lenient threshold
    includeScore: true
  });
  
  // Search using business types and name
  const searchTerms = [...businessTypes, businessName].join(' ').toLowerCase();
  const fuseResults = fuse.search(searchTerms);
  
  if (fuseResults.length > 0 && fuseResults[0].score && fuseResults[0].score < 0.6) {
    const category = fuseResults[0].item.key;
    console.log('✅ [Category Matcher] Fuse match:', { 
      searchTerms, 
      category, 
      score: fuseResults[0].score 
    });
    return category;
  }
  
  // Fourth, try Levenshtein distance matching
  let bestMatch = 'catch_all_general_purchases';
  let bestScore = 0;
  
  for (const [categoryKey, description] of Object.entries(categoryDescriptions)) {
    const categoryText = `${categoryKey.replace(/_/g, ' ')} ${description}`.toLowerCase();
    
    // Calculate similarity with business types and name
    for (const type of [...businessTypes, businessName]) {
      const similarity = calculateSimilarity(type.toLowerCase(), categoryText);
      if (similarity > bestScore && similarity > 0.6) { // Minimum threshold
        bestScore = similarity;
        bestMatch = categoryKey;
      }
    }
  }
  
  if (bestScore > 0.6) {
    console.log('✅ [Category Matcher] Levenshtein match:', { 
      bestMatch, 
      bestScore: bestScore.toFixed(3) 
    });
    return bestMatch;
  }
  
  // Default to catch-all category
  console.log('⚠️ [Category Matcher] No match found, using catch-all category');
  return 'catch_all_general_purchases';
}

// Helper function to get category display name
export function getCategoryDisplayName(categoryKey: string): string {
  return categoryKey
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

// Helper function to get category color for UI
export function getCategoryColor(categoryKey: string): string {
  const colorMap: Record<string, string> = {
    dining: '#ef4444',
    grocery: '#22c55e',
    travel_general: '#3b82f6',
    travel_flights: '#1d4ed8',
    travel_hotels: '#6366f1',
    gas_stations: '#f59e0b',
    entertainment_and_recreation: '#ec4899',
    streaming_services: '#8b5cf6',
    drugstores_and_pharmacies: '#06b6d4',
    fitness_and_wellness: '#10b981',
    transit_and_rideshare: '#f97316',
    catch_all_general_purchases: '#6b7280'
  };
  return colorMap[categoryKey] || colorMap.catch_all_general_purchases;
}
