'use client';

import React, { useState, useEffect } from 'react';
import { getCategoryDisplayName, getCategoryColor } from '../../../../utils/businessCategoryMatcher';
import { getInstantCardRecommendations, calculatePotentialValue, getEstimatedMonthlySpending } from '../../../../utils/instantCardMatcher';
import type { Business, BusinessCreditAnalysis, CreditRecommendation } from '../../../../types/business';
import type { InstantCardAnalysis } from '../../../../utils/instantCardMatcher';

interface BusinessSidebarProps {
  business: Business | null;
  isOpen: boolean;
  onClose: () => void;
}

const BusinessSidebar: React.FC<BusinessSidebarProps> = ({ business, isOpen, onClose }) => {
  const [instantAnalysis, setInstantAnalysis] = useState<InstantCardAnalysis | null>(null);
  const [creditAnalysis, setCreditAnalysis] = useState<BusinessCreditAnalysis | null>(null);
  const [isAnalyzingCredits, setIsAnalyzingCredits] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Analyze business when business changes
  useEffect(() => {
    if (business && isOpen) {
      // Instant card matching
      const instant = getInstantCardRecommendations(business.name, business.rewardCategory);
      setInstantAnalysis(instant);
      
      // Separate credit analysis
      analyzeBusiness(business);
    } else {
      setInstantAnalysis(null);
      setCreditAnalysis(null);
      setAnalysisError(null);
    }
  }, [business, isOpen]);

  const analyzeBusiness = async (businessData: Business) => {
    setIsAnalyzingCredits(true);
    setAnalysisError(null);
    console.log('💳 [Credit Analysis] Analyzing credits for business:', businessData.name);

    try {
      const response = await fetch('/api/analyze-business-credits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          businessName: businessData.name,
          businessTypes: businessData.types,
          businessAddress: businessData.address,
          rewardCategory: businessData.rewardCategory
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const analysis: BusinessCreditAnalysis = await response.json();
      setCreditAnalysis(analysis);
      console.log('✅ [Credit Analysis] Analysis complete:', analysis);
    } catch (error) {
      console.error('❌ [Credit Analysis] Error:', error);
      setAnalysisError('Failed to analyze credit opportunities. Please try again.');
    } finally {
      setIsAnalyzingCredits(false);
    }
  };

  const getCreditTypeIcon = (creditType: CreditRecommendation['creditType']) => {
    switch (creditType) {
      case 'statement_credit': return '💳';
      case 'bonus_points': return '⭐';
      case 'annual_credit': return '🎁';
      case 'special_offer': return '🎯';
      default: return '💰';
    }
  };

  const getCreditTypeColor = (creditType: CreditRecommendation['creditType']) => {
    switch (creditType) {
      case 'statement_credit': return 'bg-green-100 text-green-800';
      case 'bonus_points': return 'bg-blue-100 text-blue-800';
      case 'annual_credit': return 'bg-purple-100 text-purple-800';
      case 'special_offer': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="w-96 bg-white border-l border-gray-200 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Business Details</h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title="Close sidebar"
        >
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {business ? (
        <div className="flex flex-col h-full">
          {/* Business Info */}
          <div className="p-4 border-b border-gray-200">
            {business.photoUrl && (
              <img
                src={business.photoUrl}
                alt={business.name}
                className="w-full h-32 object-cover rounded-lg mb-3"
              />
            )}
            
            <h3 className="text-xl font-bold text-gray-900 mb-2">{business.name}</h3>
            <p className="text-gray-600 text-sm mb-3">{business.address}</p>
            
            {/* Rating and Status */}
            <div className="flex items-center justify-between mb-3">
              {business.rating && (
                <div className="flex items-center">
                  <span className="text-yellow-500 text-lg">★</span>
                  <span className="text-gray-700 ml-1 font-medium">{business.rating}</span>
                </div>
              )}
              {business.isOpen !== undefined && (
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  business.isOpen ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {business.isOpen ? 'Open' : 'Closed'}
                </span>
              )}
            </div>

            {/* Price Level */}
            {business.priceLevel && (
              <div className="mb-3">
                <span className="text-gray-600 text-sm">Price Level: </span>
                <span className="text-gray-900">
                  {'$'.repeat(business.priceLevel)}
                </span>
              </div>
            )}

            {/* Reward Category */}
            <div className="mb-3">
              <span 
                className="inline-block px-3 py-1 rounded-full text-sm font-medium text-white"
                style={{ backgroundColor: getCategoryColor(business.rewardCategory) }}
              >
                {getCategoryDisplayName(business.rewardCategory)}
              </span>
            </div>
          </div>

          {/* Card Recommendations Section */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4">
              {/* Instant Card Recommendations */}
              {instantAnalysis && (
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                    <span className="mr-2">⚡</span>
                    Best Cards for {instantAnalysis.categoryDisplayName}
                  </h4>

                  <div className="space-y-3">
                    {instantAnalysis.recommendations.slice(0, 3).map((recommendation) => (
                      <div 
                        key={recommendation.cardName}
                        className={`border rounded-lg p-4 ${
                          recommendation.isTopChoice 
                            ? 'border-green-200 bg-green-50' 
                            : 'border-gray-200 bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center">
                            {recommendation.isTopChoice && (
                              <span className="text-lg mr-2">🏆</span>
                            )}
                            <h6 className="font-semibold text-gray-900">
                              {recommendation.cardDisplayName}
                            </h6>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-green-600">
                              {recommendation.multiplier}x
                            </div>
                            <div className="text-xs text-gray-500">
                              {recommendation.rewardType.replace('_', ' ')}
                            </div>
                          </div>
                        </div>

                        <p className="text-sm text-gray-700 mb-2">
                          {recommendation.description}
                        </p>

                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">
                            Annual Fee: {recommendation.annualFee ? `$${recommendation.annualFee}` : 'Free'}
                          </span>
                          <span className="text-green-600 font-medium">
                            ~${calculatePotentialValue(recommendation, getEstimatedMonthlySpending(recommendation.category)).toFixed(0)}/month value
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Credit Analysis Section */}
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <span className="mr-2">💳</span>
                  Available Credits & Offers
                </h4>

              {isAnalyzingCredits ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
                    <p className="text-gray-600">Analyzing available credits...</p>
                    <p className="text-sm text-gray-500 mt-1">Checking for statement credits and special offers</p>
                  </div>
                </div>
              ) : analysisError ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <p className="text-red-800 text-sm">{analysisError}</p>
                  </div>
                  <button
                    onClick={() => analyzeBusiness(business)}
                    className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
                  >
                    Try again
                  </button>
                </div>
              ) : creditAnalysis ? (
                <div className="space-y-4">
                  {/* Best Card Recommendation */}
                  {creditAnalysis.bestCard && (
                    <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center mb-2">
                        <span className="text-2xl mr-2">🏆</span>
                        <h5 className="font-semibold text-blue-900">Best Card for This Purchase</h5>
                      </div>
                      <p className="text-blue-800 font-medium">{creditAnalysis.bestCard}</p>
                      {creditAnalysis.totalPotentialValue && (
                        <p className="text-sm text-blue-700 mt-1">
                          Potential value: ${creditAnalysis.totalPotentialValue.toFixed(2)}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Credit Recommendations */}
                  <div className="space-y-3">
                    {creditAnalysis.recommendations.map((recommendation, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center">
                            <span className="text-xl mr-2">
                              {getCreditTypeIcon(recommendation.creditType)}
                            </span>
                            <h6 className="font-semibold text-gray-900">
                              {recommendation.cardName}
                            </h6>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCreditTypeColor(recommendation.creditType)}`}>
                            {recommendation.creditType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </span>
                        </div>

                        <div className="mb-2">
                          <p className="text-green-600 font-medium">{recommendation.creditAmount}</p>
                        </div>

                        <p className="text-gray-700 text-sm mb-2">{recommendation.description}</p>

                        {recommendation.requirements && (
                          <div className="mb-2">
                            <p className="text-xs text-gray-500">
                              <span className="font-medium">Requirements:</span> {recommendation.requirements}
                            </p>
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <span className="text-xs text-gray-500">Confidence:</span>
                            <div className="ml-2 flex items-center">
                              {[...Array(5)].map((_, i) => (
                                <svg
                                  key={i}
                                  className={`w-3 h-3 ${
                                    i < Math.round(recommendation.confidence * 5)
                                      ? 'text-yellow-400'
                                      : 'text-gray-300'
                                  }`}
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                              ))}
                            </div>
                          </div>
                        </div>

                        <details className="mt-3">
                          <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-800">
                            Show reasoning
                          </summary>
                          <p className="text-xs text-gray-600 mt-2 pl-4 border-l-2 border-gray-200">
                            {recommendation.reasoning}
                          </p>
                        </details>
                      </div>
                    ))}
                  </div>

                  {/* Analysis Confidence */}
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Analysis Confidence</span>
                      <span className="text-sm font-medium text-gray-900">
                        {(creditAnalysis.analysisConfidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${creditAnalysis.analysisConfidence * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ) : !isAnalyzingCredits && (
                <div className="text-center py-4">
                  <p className="text-gray-500 text-sm">No special credits found for this business</p>
                </div>
              )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-500">No business selected</p>
        </div>
      )}
    </div>
  );
};

export default BusinessSidebar;
