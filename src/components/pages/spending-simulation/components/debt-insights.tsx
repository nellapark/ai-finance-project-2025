'use client';

import React from 'react';
import { DebtInsight } from '../../../../utils/debtAnalysis';

interface DebtInsightsProps {
  insights: DebtInsight[];
  isLoading?: boolean;
}

export default function DebtInsights({ insights, isLoading = false }: DebtInsightsProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <h2 className="text-xl font-semibold text-gray-900">Analyzing Your Debt...</h2>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-100 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (insights.length === 0) {
    return null;
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-red-200 bg-red-50';
      case 'medium': return 'border-yellow-200 bg-yellow-50';
      case 'low': return 'border-green-200 bg-green-50';
      default: return 'border-gray-200 bg-gray-50';
    }
  };

  const getPriorityTextColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-800';
      case 'medium': return 'text-yellow-800';
      case 'low': return 'text-green-800';
      default: return 'text-gray-800';
    }
  };

  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">💡 Immediate Debt Insights</h2>
        <div className="text-sm text-gray-500">
          While your simulation loads...
        </div>
      </div>

      <div className="space-y-4">
        {insights.map((insight) => (
          <div
            key={insight.id}
            className={`border rounded-lg p-4 ${getPriorityColor(insight.priority)}`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{insight.icon}</span>
                <div>
                  <h3 className={`font-semibold ${getPriorityTextColor(insight.priority)}`}>
                    {insight.title}
                  </h3>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityBadgeColor(insight.priority)}`}>
                      {insight.priority.toUpperCase()} PRIORITY
                    </span>
                    {insight.potentialSavings && (
                      <span className="text-sm text-green-600 font-medium">
                        💰 Save up to ${insight.potentialSavings.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <p className={`text-sm mb-4 ${getPriorityTextColor(insight.priority)}`}>
              {insight.description}
            </p>

            <div className="space-y-2">
              <h4 className={`text-sm font-medium ${getPriorityTextColor(insight.priority)}`}>
                Action Items:
              </h4>
              <ul className="space-y-1">
                {insight.actionItems.map((action, index) => (
                  <li key={index} className={`text-sm flex items-start space-x-2 ${getPriorityTextColor(insight.priority)}`}>
                    <span className="text-blue-500 mt-1">•</span>
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start space-x-3">
          <span className="text-blue-500 text-lg">ℹ️</span>
          <div>
            <h4 className="font-medium text-blue-800 mb-1">About These Insights</h4>
            <p className="text-sm text-blue-700">
              These recommendations are based on your uploaded debt data and general financial best practices. 
              Consider consulting with a financial advisor for personalized advice. Your spending simulation 
              will provide additional insights once the analysis is complete.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
