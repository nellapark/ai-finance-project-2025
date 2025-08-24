export interface Business {
  id: string;
  name: string;
  address: string;
  location: {
    lat: number;
    lng: number;
  };
  types: string[];
  rating?: number;
  priceLevel?: number;
  photoUrl?: string;
  rewardCategory: string;
  isOpen?: boolean;
  placeId?: string;
}

export interface BusinessSearchResult {
  businesses: Business[];
  totalResults: number;
  searchQuery: string;
}

export interface CreditRecommendation {
  cardName: string;
  creditType: 'statement_credit' | 'bonus_points' | 'annual_credit' | 'special_offer';
  creditAmount: string;
  description: string;
  requirements?: string;
  confidence: number;
  reasoning: string;
}

export interface BusinessCreditAnalysis {
  businessName: string;
  businessType: string;
  recommendations: CreditRecommendation[];
  bestCard?: string;
  totalPotentialValue?: number;
  analysisConfidence: number;
}
