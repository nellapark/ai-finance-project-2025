'use client';

import React from 'react';
import SpendingSimulationGraph from './components/spending-simulation-graph';

interface SpendingSimulationProps {
  className?: string;
}

const SpendingSimulation: React.FC<SpendingSimulationProps> = ({
  className = '',
}) => {
  return (
    <div className={`spending-simulation ${className}`}>
      <div className="container mx-auto px-4 py-8">
        {/* Header Section */}
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Spending Simulation
          </h1>
          <p className="text-gray-600 text-lg">
            Visualize your spending patterns over time and plan your financial future.
          </p>
        </header>

        {/* Main Content */}
        <main className="space-y-8">
          {/* Graph Section */}
          <section className="bg-gray-50 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Spending Over Time
            </h2>
            <div className="flex justify-center">
              <SpendingSimulationGraph
                width={800}
                height={400}
                className="max-w-full"
              />
            </div>
          </section>

          {/* Controls Section (placeholder for future enhancements) */}
          <section className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Simulation Controls
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Initial Amount
                </label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="$50,000"
                  disabled
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Monthly Spending
                </label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="$3,000"
                  disabled
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Time Period
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled
                >
                  <option>12 months</option>
                  <option>24 months</option>
                  <option>36 months</option>
                </select>
              </div>
            </div>
            <div className="mt-4">
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                disabled
              >
                Update Simulation
              </button>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Controls are currently disabled. This is a demonstration of the graph component.
            </p>
          </section>
        </main>
      </div>
    </div>
  );
};

export default SpendingSimulation;
