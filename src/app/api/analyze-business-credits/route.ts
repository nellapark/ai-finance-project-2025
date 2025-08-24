import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import cardDetails from '../../../../card-details/top-8-common-cards.json';
import type { BusinessCreditAnalysis, CreditRecommendation } from '../../../types/business';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface AnalyzeBusinessRequest {
  businessName: string;
  businessTypes: string[];
  businessAddress: string;
  rewardCategory: string;
}

export async function POST(request: NextRequest) {
  try {
    const { businessName, businessTypes, businessAddress, rewardCategory }: AnalyzeBusinessRequest = await request.json();
    
    console.log('🤖 [Business Credit Analysis] Starting analysis for:', {
      businessName,
      businessTypes,
      rewardCategory
    });

    // Create the prompt for GPT-4o
    const prompt = createBusinessAnalysisPrompt(businessName, businessTypes, businessAddress, rewardCategory);
    
    console.log('📝 [Business Credit Analysis] Sending prompt to GPT-4o...');
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a credit card rewards expert who analyzes businesses and recommends the best credit cards for maximizing rewards, credits, and benefits. You have deep knowledge of credit card terms, conditions, and promotional offers.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_completion_tokens: 8000,
      response_format: { type: 'json_object' }
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    console.log('✅ [Business Credit Analysis] GPT-4o response received');
    
    // Parse the JSON response
    let analysisResult: BusinessCreditAnalysis;
    try {
      // Clean the response before parsing
      const cleanedResponse = response
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .replace(/\/\/.*$/gm, '') // Remove comments
        .replace(/,(\s*[}\]])/g, '$1'); // Remove trailing commas
      
      analysisResult = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('❌ [Business Credit Analysis] JSON parsing error:', parseError);
      console.log('Raw response:', response);
      
      // Fallback analysis
      analysisResult = createFallbackAnalysis(businessName, rewardCategory);
    }

    // Validate and enhance the analysis
    analysisResult = validateAndEnhanceAnalysis(analysisResult, businessName, rewardCategory);

    console.log('🎯 [Business Credit Analysis] Analysis complete:', {
      businessName: analysisResult.businessName,
      recommendationsCount: analysisResult.recommendations.length,
      bestCard: analysisResult.bestCard,
      confidence: analysisResult.analysisConfidence
    });

    return NextResponse.json(analysisResult);

  } catch (error) {
    console.error('❌ [Business Credit Analysis] Error:', error);
    
    // Return a fallback analysis in case of error
    const fallbackAnalysis = createFallbackAnalysis('Unknown Business', 'catch_all_general_purchases');
    return NextResponse.json(fallbackAnalysis);
  }
}

function createBusinessAnalysisPrompt(businessName: string, businessTypes: string[], businessAddress: string, rewardCategory: string): string {
  const cardDetailsJson = JSON.stringify(cardDetails, null, 2);
  
  return `
Analyze the business "${businessName}" (types: ${businessTypes.join(', ')}) located at "${businessAddress}" and categorized as "${rewardCategory}" to find the best credit card recommendations from the available cards.

AVAILABLE CREDIT CARDS:
${cardDetailsJson}

ANALYSIS REQUIREMENTS:
1. Identify which credit cards offer the best rewards, credits, or benefits for this specific business
2. Look for:
   - Direct merchant credits (e.g., "Five Guys credit", "Cheesecake Factory credit")
   - Category bonuses that match the business type
   - Special promotions or partnerships
   - Annual credits that could apply
   - Statement credits for specific merchants

3. For each recommendation, provide:
   - Card name (exactly as shown in the JSON)
   - Credit type: "statement_credit", "bonus_points", "annual_credit", or "special_offer"
   - Credit amount (e.g., "$10 per month", "4x points", "$300 annual credit")
   - Detailed description of the benefit
   - Requirements (if any)
   - Confidence score (0.0 to 1.0)
   - Reasoning for the recommendation

4. Determine the single best card overall
5. Calculate total potential value if possible
6. Provide overall analysis confidence

IMPORTANT MATCHING RULES:
- Look for exact business name matches in credit descriptions
- Match business categories to card bonus categories
- Consider both ongoing benefits and limited-time offers
- Pay special attention to merchant-specific credits
- If no specific matches, recommend based on category multipliers

EXAMPLE SCENARIOS:
- Five Guys → AMEX Gold has "Five Guys" in dining credit partners
- Cheesecake Factory → AMEX Gold has "Cheesecake Factory" in dining credit partners  
- Grocery store → Cards with grocery category bonuses
- Gas station → Cards with gas station category bonuses
- Restaurant → Cards with dining category bonuses

Return your analysis as a JSON object with this exact structure:
{
  "businessName": "${businessName}",
  "businessType": "${businessTypes.join(', ')}",
  "recommendations": [
    {
      "cardName": "EXACT_CARD_NAME_FROM_JSON",
      "creditType": "statement_credit|bonus_points|annual_credit|special_offer",
      "creditAmount": "Specific amount or multiplier",
      "description": "Detailed description of the benefit",
      "requirements": "Any requirements or conditions",
      "confidence": 0.95,
      "reasoning": "Why this card is recommended for this business"
    }
  ],
  "bestCard": "BEST_CARD_NAME",
  "totalPotentialValue": 120.50,
  "analysisConfidence": 0.88
}

Focus on finding the most valuable and relevant recommendations for spending at "${businessName}".
`;
}

function createFallbackAnalysis(businessName: string, rewardCategory: string): BusinessCreditAnalysis {
  // Create basic recommendations based on reward category
  const recommendations: CreditRecommendation[] = [];
  
  // Add category-based recommendations
  switch (rewardCategory) {
    case 'dining':
      recommendations.push({
        cardName: 'AMEX_GOLD',
        creditType: 'bonus_points',
        creditAmount: '4x points on restaurants',
        description: 'Earn 4x Membership Rewards points on restaurants worldwide, up to $50,000 per year.',
        confidence: 0.9,
        reasoning: 'AMEX Gold offers the highest dining rewards rate among available cards.'
      });
      break;
    
    case 'grocery':
      recommendations.push({
        cardName: 'AMEX_BLUE_CASH_PREFERRED',
        creditType: 'bonus_points',
        creditAmount: '6% cash back on groceries',
        description: 'Earn 6% cash back at U.S. supermarkets, up to $6,000 per year.',
        confidence: 0.9,
        reasoning: 'AMEX Blue Cash Preferred offers the highest grocery rewards rate.'
      });
      break;
    
    case 'travel_general':
    case 'travel_flights':
    case 'travel_hotels':
      recommendations.push({
        cardName: 'CHASE_SAPPHIRE_RESERVE',
        creditType: 'bonus_points',
        creditAmount: '3x-8x points on travel',
        description: 'Earn enhanced points on travel purchases with valuable transfer partners.',
        confidence: 0.85,
        reasoning: 'Chase Sapphire Reserve offers excellent travel rewards and benefits.'
      });
      break;
    
    default:
      recommendations.push({
        cardName: 'WELLS_FARGO_ACTIVE_CASH',
        creditType: 'bonus_points',
        creditAmount: '2% cash back on all purchases',
        description: 'Earn 2% cash back on all eligible purchases with no category restrictions.',
        confidence: 0.7,
        reasoning: 'Wells Fargo Active Cash provides solid rewards for general purchases.'
      });
  }

  return {
    businessName,
    businessType: rewardCategory,
    recommendations,
    bestCard: recommendations[0]?.cardName,
    totalPotentialValue: 50,
    analysisConfidence: 0.6
  };
}

function validateAndEnhanceAnalysis(analysis: BusinessCreditAnalysis, businessName: string, rewardCategory: string): BusinessCreditAnalysis {
  // Ensure all required fields are present
  if (!analysis.businessName) analysis.businessName = businessName;
  if (!analysis.businessType) analysis.businessType = rewardCategory;
  if (!analysis.recommendations) analysis.recommendations = [];
  if (!analysis.analysisConfidence) analysis.analysisConfidence = 0.5;

  // Validate recommendations
  analysis.recommendations = analysis.recommendations.filter(rec => {
    return rec.cardName && rec.creditType && rec.creditAmount && rec.description;
  });

  // Ensure confidence scores are within valid range
  analysis.recommendations.forEach(rec => {
    if (rec.confidence < 0) rec.confidence = 0;
    if (rec.confidence > 1) rec.confidence = 1;
  });

  if (analysis.analysisConfidence < 0) analysis.analysisConfidence = 0;
  if (analysis.analysisConfidence > 1) analysis.analysisConfidence = 1;

  // Set best card if not provided
  if (!analysis.bestCard && analysis.recommendations.length > 0) {
    analysis.bestCard = analysis.recommendations[0].cardName;
  }

  return analysis;
}
