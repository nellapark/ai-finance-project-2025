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
Analyze the business "${businessName}" (types: ${businessTypes.join(', ')}) located at "${businessAddress}" and categorized as "${rewardCategory}" to find ONLY statement credits, annual credits, and special offers from the available cards.

AVAILABLE CREDIT CARDS:
${cardDetailsJson}

CREDIT ANALYSIS REQUIREMENTS:
ONLY look for and return:
1. Direct merchant credits (e.g., "Five Guys credit", "Cheesecake Factory credit")
2. Annual credits that could apply to this business type
3. Statement credits for specific merchants or categories
4. Special promotional offers

DO NOT include:
- General category multipliers (e.g., "4x points on dining")
- Basic reward rates
- Card recommendations based on multipliers

FOCUS ON:
- Exact business name matches in credit descriptions
- Category-specific annual credits
- Merchant-specific statement credits
- Limited-time promotional offers

EXAMPLE MATCHES:
- Five Guys → AMEX Gold: "$10 per month dining credit includes Five Guys"
- Cheesecake Factory → AMEX Gold: "Dining credit partners include Cheesecake Factory"
- Grocery store → Chase Sapphire Reserve: "DoorDash non-restaurant discount"
- Travel → Chase Sapphire Reserve: "$300 annual travel credit"

Return your analysis as a JSON object with this exact structure:
{
  "businessName": "${businessName}",
  "businessType": "${businessTypes.join(', ')}",
  "recommendations": [
    {
      "cardName": "EXACT_CARD_NAME_FROM_JSON",
      "creditType": "statement_credit|annual_credit|special_offer",
      "creditAmount": "Specific credit amount",
      "description": "Detailed description of the credit/offer",
      "requirements": "Any requirements or conditions",
      "confidence": 0.95,
      "reasoning": "Why this credit applies to this business"
    }
  ],
  "bestCard": null,
  "totalPotentialValue": null,
  "analysisConfidence": 0.88
}

IMPORTANT: Only return credits/offers that specifically apply to "${businessName}" or its category. If no specific credits are found, return an empty recommendations array.
`;
}

function createFallbackAnalysis(businessName: string, rewardCategory: string): BusinessCreditAnalysis {
  // Only return actual credits, not multiplier-based recommendations
  const recommendations: CreditRecommendation[] = [];
  
  // Add category-specific credits only
  switch (rewardCategory) {
    case 'dining':
      recommendations.push({
        cardName: 'AMEX_GOLD',
        creditType: 'statement_credit',
        creditAmount: 'Up to $120 per year',
        description: 'Statement credits for eligible purchases at participating dining partners.',
        confidence: 0.7,
        reasoning: 'AMEX Gold offers dining credits that may apply to restaurant purchases.'
      });
      break;
    
    case 'travel_general':
    case 'travel_flights':
    case 'travel_hotels':
      recommendations.push({
        cardName: 'CHASE_SAPPHIRE_RESERVE',
        creditType: 'annual_credit',
        creditAmount: '$300 annual travel credit',
        description: 'Receive up to $300 in statement credits each year for travel purchases.',
        confidence: 0.8,
        reasoning: 'Chase Sapphire Reserve offers annual travel credits that apply to travel expenses.'
      });
      break;
    
    default:
      // No specific credits for other categories
      break;
  }

  return {
    businessName,
    businessType: rewardCategory,
    recommendations,
    bestCard: null,
    totalPotentialValue: null,
    analysisConfidence: recommendations.length > 0 ? 0.6 : 0.1
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
