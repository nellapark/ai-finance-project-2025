'use client';

import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface DataPoint {
  time: Date;
  amount: number;
  cumulativeBalance?: number;
  originalAmount?: number;
  description?: string;
  category?: string;
  confidence?: number;
  isRecurring?: boolean;
  type?: string;
  recurringGroup?: string; // Identifier for grouping related recurring transactions
  adjustmentType?: string; // Which adjustment this transaction triggered
  adjustmentCategory?: string; // lifeEvents, behavioralChanges, externalFactors
}

interface SpendingSimulationGraphProps {
  data?: DataPoint[];
  width?: number;
  height?: number;
  className?: string;
  isCumulative?: boolean;
  highlightedAdjustment?: string | null; // Which adjustment to highlight
  toggledAdjustments?: Set<string>; // Which adjustments are persistently toggled
  showAdjustmentDataPoints?: boolean; // Whether to show adjustment data points
}

const SpendingSimulationGraph: React.FC<SpendingSimulationGraphProps> = ({
  data = [],
  width = 1200,
  height = 500,
  className = '',
  isCumulative = false,
  highlightedAdjustment = null,
  toggledAdjustments = new Set(),
  showAdjustmentDataPoints = true,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  // Helper function to get adjustment info
  const getAdjustmentInfo = (adjustmentKey: string) => {
    const adjustmentInfo: Record<string, { label: string; icon: string }> = {
      recentMove: { label: 'Recent Move', icon: '🏠' },
      newMarriage: { label: 'New Marriage', icon: '💒' },
      newBaby: { label: 'New Baby', icon: '👶' },
      dietaryShift: { label: 'Dietary Shift', icon: '🥗' },
      fitnessChange: { label: 'Fitness Change', icon: '💪' },
      transportationChange: { label: 'Transportation Change', icon: '🚗' },
      socialTrends: { label: 'Social Trends', icon: '📱' },
    };
    return adjustmentInfo[adjustmentKey] || { label: adjustmentKey, icon: '⚙️' };
  };

  useEffect(() => {
    console.log('🎨 [Graph] Rendering with data:', {
      dataLength: data?.length || 0,
      hasData: !!data,
      isCumulative,
      highlightedAdjustment,
      sampleData: data?.slice(0, 2)
    });
    
    if (!svgRef.current || !data || !data.length) {
      console.log('🚫 [Graph] Early return - no data or SVG ref');
      return;
    }
    
    // Filter out any invalid data points
    const validData = data.filter(d => d && d.time && d.amount !== undefined && d.amount !== null);
    console.log('✅ [Graph] Valid data points:', validData.length);
    
    if (validData.length === 0) {
      console.log('🚫 [Graph] No valid data points to render');
      return;
    }

    // Clear previous content
    d3.select(svgRef.current).selectAll('*').remove();

    // Set up dimensions and margins
    const margin = { top: 20, right: 30, bottom: 40, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Create SVG container
    const svg = d3.select(svgRef.current);
    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Set up scales
    const xScale = d3
      .scaleTime()
      .domain(d3.extent(validData, (d) => d.time) as [Date, Date])
      .range([0, innerWidth]);

    const yScale = d3
      .scaleLinear()
      .domain(isCumulative 
        ? [0, d3.max(validData, (d) => d.cumulativeBalance || d.amount) as number]
        : [0, d3.max(validData, (d) => d.amount) as number]
      )
      .nice()
      .range([innerHeight, 0]);

    // Add X axis
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).tickFormat(d3.timeFormat('%b %Y') as (domainValue: Date | d3.NumberValue, index: number) => string))
      .append('text')
      .attr('x', innerWidth / 2)
      .attr('y', 35)
      .attr('fill', 'currentColor')
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .text('Time');

    // Add Y axis
    g.append('g')
      .call(d3.axisLeft(yScale).tickFormat(d3.format('$,.0f')))
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -40)
      .attr('x', -innerHeight / 2)
      .attr('fill', 'currentColor')
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .text(isCumulative ? 'Cumulative Spending ($)' : 'Transaction Amount ($)');

    // Add line graph for cumulative mode
    if (isCumulative) {
      const line = d3
        .line<DataPoint>()
        .x((d) => xScale(d.time))
        .y((d) => yScale(d.cumulativeBalance || d.amount))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(validData)
        .attr('fill', 'none')
        .attr('stroke', '#3b82f6')
        .attr('stroke-width', 3)
        .attr('d', line);
    }

    // Add transaction points with different styles for recurring vs one-time and adjustment highlighting
    g.selectAll('.transaction-point')
      .data(validData)
      .enter()
      .append('circle')
      .attr('class', 'transaction-point')
      .attr('cx', (d) => xScale(d.time))
      .attr('cy', (d) => isCumulative ? yScale(d.cumulativeBalance || d.amount) : yScale(d.amount))
      .attr('r', (d) => {
        // Check if this transaction is part of any active adjustment
        const isHighlighted = highlightedAdjustment && d.adjustmentType === highlightedAdjustment;
        const isToggled = d.adjustmentType && toggledAdjustments.has(d.adjustmentType);
        
        if (isHighlighted) return 8; // Extra large for hover
        if (isToggled) return 7; // Large for toggled
        return 4; // Default size
      })
      .attr('fill', (d) => {
        // Check if this transaction is part of any active adjustment
        const isHighlighted = highlightedAdjustment && d.adjustmentType === highlightedAdjustment;
        const isToggled = d.adjustmentType && toggledAdjustments.has(d.adjustmentType);
        
        if (isHighlighted || isToggled) {
          if (d.adjustmentCategory === 'lifeEvents') return '#dc2626'; // Red for life events
          if (d.adjustmentCategory === 'behavioralChanges') return '#ea580c'; // Orange for behavioral
          if (d.adjustmentCategory === 'externalFactors') return '#7c3aed'; // Purple for external
        }
        // Default colors
        return d.isRecurring ? '#10b981' : '#3b82f6'; // Green for recurring, blue for one-time
      })
      .attr('stroke', (d) => {
        const isHighlighted = highlightedAdjustment && d.adjustmentType === highlightedAdjustment;
        const isToggled = d.adjustmentType && toggledAdjustments.has(d.adjustmentType);
        
        if (isHighlighted || isToggled) return '#ffffff';
        return '#ffffff';
      })
      .attr('stroke-width', (d) => {
        const isHighlighted = highlightedAdjustment && d.adjustmentType === highlightedAdjustment;
        const isToggled = d.adjustmentType && toggledAdjustments.has(d.adjustmentType);
        
        if (isHighlighted) return 4; // Extra thick for hover
        if (isToggled) return 3; // Thick for toggled
        return 2; // Default
      })
      .style('cursor', 'pointer')
      .style('opacity', (d) => {
        const isHighlighted = highlightedAdjustment && d.adjustmentType === highlightedAdjustment;
        const isToggled = d.adjustmentType && toggledAdjustments.has(d.adjustmentType);
        
        // Handle visibility toggle
        if (!showAdjustmentDataPoints && (isHighlighted || isToggled)) {
          return 0.1; // Nearly invisible when adjustment data points are hidden
        }
        
        // If we're highlighting something specific
        if (highlightedAdjustment) {
          return isHighlighted ? 1.0 : 0.15; // Much more dramatic contrast
        }
        
        // If we have toggled adjustments, show them prominently
        if (toggledAdjustments.size > 0) {
          return isToggled ? 1.0 : 0.25; // More dramatic contrast for toggled
        }
        
        // Default opacity
        return d.isRecurring ? 0.9 : 0.7;
      })
      .style('filter', (d) => {
        const isHighlighted = highlightedAdjustment && d.adjustmentType === highlightedAdjustment;
        const isToggled = d.adjustmentType && toggledAdjustments.has(d.adjustmentType);
        
        if (!showAdjustmentDataPoints && (isHighlighted || isToggled)) {
          return 'none'; // No special effects when hidden
        }
        
        if (isHighlighted) return 'drop-shadow(0 0 12px rgba(220, 38, 38, 0.8)) drop-shadow(0 0 20px rgba(220, 38, 38, 0.4))'; // Strong red glow for hover
        if (isToggled) return 'drop-shadow(0 0 8px rgba(220, 38, 38, 0.6)) drop-shadow(0 0 16px rgba(220, 38, 38, 0.3))'; // Medium glow for toggled
        return 'none';
      });

    // Add connecting lines and background highlighting for adjustment transactions
    if (showAdjustmentDataPoints && (highlightedAdjustment || toggledAdjustments.size > 0)) {
      const activeAdjustments = highlightedAdjustment ? [highlightedAdjustment] : Array.from(toggledAdjustments);
      
      activeAdjustments.forEach(adjustment => {
        const adjustmentTransactions = validData.filter(d => d.adjustmentType === adjustment);
        
        if (adjustmentTransactions.length > 1) {
          // Sort by time for connecting lines
          const sortedAdjustmentTransactions = adjustmentTransactions.sort((a, b) => a.time.getTime() - b.time.getTime());
          
          // Add background highlight area
          const xPositions = sortedAdjustmentTransactions.map(d => xScale(d.time));
          const minX = Math.min(...xPositions) - 15;
          const maxX = Math.max(...xPositions) + 15;
          
          g.append('rect')
            .attr('class', 'adjustment-background')
            .attr('x', minX)
            .attr('y', 0)
            .attr('width', maxX - minX)
            .attr('height', height - margin.bottom - margin.top)
            .attr('fill', adjustment === highlightedAdjustment ? 'rgba(220, 38, 38, 0.08)' : 'rgba(220, 38, 38, 0.04)')
            .attr('stroke', 'rgba(220, 38, 38, 0.4)')
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', '8,4')
            .style('pointer-events', 'none');
          
          // Add connecting lines between adjustment transactions
          const lineGenerator = d3.line<DataPoint>()
            .x(d => xScale(d.time))
            .y(d => isCumulative ? yScale(d.cumulativeBalance || d.amount) : yScale(d.amount))
            .curve(d3.curveCardinal);
          
          g.append('path')
            .datum(sortedAdjustmentTransactions)
            .attr('class', 'adjustment-connection-line')
            .attr('fill', 'none')
            .attr('stroke', adjustment === highlightedAdjustment ? 'rgba(220, 38, 38, 0.9)' : 'rgba(220, 38, 38, 0.7)')
            .attr('stroke-width', adjustment === highlightedAdjustment ? 4 : 3)
            .attr('stroke-dasharray', '10,5')
            .attr('d', lineGenerator)
            .style('pointer-events', 'none');
          
          // Add labels for adjustment groups
          const midPoint = sortedAdjustmentTransactions[Math.floor(sortedAdjustmentTransactions.length / 2)];
          const adjustmentInfo = getAdjustmentInfo(adjustment);
          
          g.append('text')
            .attr('class', 'adjustment-label')
            .attr('x', xScale(midPoint.time))
            .attr('y', (isCumulative ? yScale(midPoint.cumulativeBalance || midPoint.amount) : yScale(midPoint.amount)) - 25)
            .attr('text-anchor', 'middle')
            .attr('font-size', '14px')
            .attr('font-weight', 'bold')
            .attr('fill', 'rgba(220, 38, 38, 1)')
            .attr('stroke', 'white')
            .attr('stroke-width', 3)
            .attr('paint-order', 'stroke')
            .text(`${adjustmentInfo.icon} ${adjustmentInfo.label}`)
            .style('pointer-events', 'none');
        }
      });
    }

    // Calculate statistical significance for large transactions
    const amounts = validData.map(d => Math.abs(d.originalAmount || d.amount));
    
    // Handle edge cases
    if (amounts.length === 0) {
      console.warn('🚫 [Graph] No transaction amounts to analyze');
      return;
    }
    
    const mean = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
    const variance = amounts.length > 1 
      ? amounts.reduce((sum, amount) => sum + Math.pow(amount - mean, 2), 0) / (amounts.length - 1) // Sample variance
      : 0;
    const standardDeviation = Math.sqrt(variance);
    
    // Define large transactions as those more than 2 standard deviations from the mean (outside the 95% within the mean)
    // Use a minimum threshold to avoid marking tiny variations as significant
    const statisticalThreshold = mean + (2 * standardDeviation);
    const minimumThreshold = mean * 1.5; // At least 50% above mean
    const largeTransactionThreshold = Math.max(statisticalThreshold, minimumThreshold);
    
    // Calculate recurring transaction statistics
    const recurringTransactions = validData.filter(d => d.isRecurring);
    const oneTimeTransactions = validData.filter(d => !d.isRecurring);
    
    // Analyze recurring groups
    const recurringGroups: { [key: string]: DataPoint[] } = {};
    recurringTransactions.forEach(transaction => {
      if (transaction.recurringGroup) {
        if (!recurringGroups[transaction.recurringGroup]) {
          recurringGroups[transaction.recurringGroup] = [];
        }
        recurringGroups[transaction.recurringGroup].push(transaction);
      }
    });

    console.log('📊 [Graph] Transaction statistics:', {
      totalTransactions: amounts.length,
      mean: mean.toFixed(2),
      standardDeviation: standardDeviation.toFixed(2),
      statisticalThreshold: statisticalThreshold.toFixed(2),
      minimumThreshold: minimumThreshold.toFixed(2),
      finalThreshold: largeTransactionThreshold.toFixed(2),
      largeTransactionCount: amounts.filter(amount => amount > largeTransactionThreshold).length,
      percentageOutliers: ((amounts.filter(amount => amount > largeTransactionThreshold).length / amounts.length) * 100).toFixed(1) + '%',
      recurringCount: recurringTransactions.length,
      oneTimeCount: oneTimeTransactions.length,
      percentageRecurring: ((recurringTransactions.length / validData.length) * 100).toFixed(1) + '%',
      recurringGroups: Object.keys(recurringGroups).length,
      recurringGroupDetails: Object.entries(recurringGroups).map(([group, transactions]) => ({
        group,
        count: transactions.length,
        avgAmount: (transactions.reduce((sum, t) => sum + t.amount, 0) / transactions.length).toFixed(2)
      }))
    });

    // Add special indicators for statistically large transactions
    g.selectAll('.large-transaction')
      .data(validData.filter(d => Math.abs(d.originalAmount || d.amount) > largeTransactionThreshold))
      .enter()
      .append('circle')
      .attr('class', 'large-transaction')
      .attr('cx', (d) => xScale(d.time))
      .attr('cy', (d) => isCumulative ? yScale(d.cumulativeBalance || d.amount) : yScale(d.amount))
      .attr('r', 8)
      .attr('fill', 'none')
      .attr('stroke', '#ef4444')
      .attr('stroke-width', 2)
      .attr('opacity', 0.8);

    // Add tooltip functionality
    const tooltip = d3.select('body').append('div')
      .attr('class', 'tooltip')
      .style('position', 'absolute')
      .style('visibility', 'hidden')
      .style('background', 'rgba(0, 0, 0, 0.8)')
      .style('color', 'white')
      .style('padding', '8px')
      .style('border-radius', '4px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('z-index', '1000');

    g.selectAll('.transaction-point')
      .on('mouseover', function(event, d) {
        const dataPoint = d as DataPoint;
        
        // Highlight all transactions in the same recurring group
        if (dataPoint.isRecurring && dataPoint.recurringGroup) {
          g.selectAll('.transaction-point')
            .style('opacity', (pointData: unknown) => {
              const point = pointData as DataPoint;
              return point.recurringGroup === dataPoint.recurringGroup ? 1.0 : 0.3;
            })
            .attr('stroke-width', (pointData: unknown) => {
              const point = pointData as DataPoint;
              return point.recurringGroup === dataPoint.recurringGroup ? 3 : 2;
            })
            .attr('r', (pointData: unknown) => {
              const point = pointData as DataPoint;
              return point.recurringGroup === dataPoint.recurringGroup ? 6 : 4;
            });
          
          // Draw connecting lines between related recurring transactions
          const relatedTransactions = validData
            .filter(t => t.recurringGroup === dataPoint.recurringGroup)
            .sort((a, b) => a.time.getTime() - b.time.getTime());
          
          if (relatedTransactions.length > 1) {
            // Create a line connecting all related transactions
            const lineGenerator = d3.line<DataPoint>()
              .x(d => xScale(d.time))
              .y(d => isCumulative ? yScale(d.cumulativeBalance || d.amount) : yScale(d.amount))
              .curve(d3.curveLinear);
            
            g.append('path')
              .datum(relatedTransactions)
              .attr('class', 'recurring-connection-line')
              .attr('fill', 'none')
              .attr('stroke', '#10b981')
              .attr('stroke-width', 2)
              .attr('stroke-dasharray', '5,5')
              .attr('opacity', 0.8)
              .attr('d', lineGenerator);
          }
          
          tooltip.style('visibility', 'visible')
            .html(`
              <strong>${dataPoint.description || 'Transaction'}</strong><br/>
              ${isCumulative ? `Cumulative Total: $${(dataPoint.cumulativeBalance || dataPoint.amount).toLocaleString()}<br/>` : ''}
              Amount: $${dataPoint.amount.toLocaleString()}<br/>
              Original: $${(dataPoint.originalAmount || 0).toFixed(2)}<br/>
              Category: ${dataPoint.category || 'N/A'}<br/>
              Date: ${dataPoint.time.toLocaleDateString()}<br/>
              <strong>Recurring Pattern: ${relatedTransactions.length} occurrences</strong><br/>
              ${dataPoint.confidence ? `Confidence: ${(dataPoint.confidence * 100).toFixed(0)}%` : ''}
            `);
        } else {
          // Non-recurring transaction - just highlight this one
          d3.select(this)
            .attr('r', 6)
            .attr('stroke-width', 3);
          
          tooltip.style('visibility', 'visible')
            .html(`
              <strong>${dataPoint.description || 'Transaction'}</strong><br/>
              ${isCumulative ? `Cumulative Total: $${(dataPoint.cumulativeBalance || dataPoint.amount).toLocaleString()}<br/>` : ''}
              Amount: $${dataPoint.amount.toLocaleString()}<br/>
              Original: $${(dataPoint.originalAmount || 0).toFixed(2)}<br/>
              Category: ${dataPoint.category || 'N/A'}<br/>
              Date: ${dataPoint.time.toLocaleDateString()}<br/>
              ${dataPoint.isRecurring ? `Recurring: Yes` : 'One-time Transaction'}<br/>
              ${dataPoint.confidence ? `Confidence: ${(dataPoint.confidence * 100).toFixed(0)}%` : ''}
            `);
        }
      })
      .on('mousemove', function(event) {
        tooltip.style('top', (event.pageY - 10) + 'px')
          .style('left', (event.pageX + 10) + 'px');
      })
      .on('mouseout', function() {
        tooltip.style('visibility', 'hidden');
        
        // Reset all transaction points to their original state
        g.selectAll('.transaction-point')
          .style('opacity', (d: unknown) => {
            const point = d as DataPoint;
            return point.isRecurring ? 0.9 : 0.7;
          })
          .attr('r', 4)
          .attr('stroke-width', 2);
        
        // Remove any recurring connection lines
        g.selectAll('.recurring-connection-line').remove();
      });

    // Add grid lines
    g.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(
        d3
          .axisBottom(xScale)
          .tickSize(-innerHeight)
          .tickFormat(() => '')
      )
      .style('stroke-dasharray', '3,3')
      .style('opacity', 0.3);

    g.append('g')
      .attr('class', 'grid')
      .call(
        d3
          .axisLeft(yScale)
          .tickSize(-innerWidth)
          .tickFormat(() => '')
      )
      .style('stroke-dasharray', '3,3')
      .style('opacity', 0.3);

    // Add legend
    const legend = svg.append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${width - 200}, 20)`);

    let legendY = 10;

    // Line legend for cumulative mode
    if (isCumulative) {
      legend.append('line')
        .attr('x1', 0)
        .attr('y1', legendY)
        .attr('x2', 20)
        .attr('y2', legendY)
        .attr('stroke', '#3b82f6')
        .attr('stroke-width', 3);
      
      legend.append('text')
        .attr('x', 25)
        .attr('y', legendY + 5)
        .style('font-size', '12px')
        .text('Cumulative Spending');
      
      legendY += 20;
    }

    // One-time transactions legend
    legend.append('circle')
      .attr('cx', 10)
      .attr('cy', legendY)
      .attr('r', 4)
      .attr('fill', '#3b82f6')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2)
      .style('opacity', 0.7);
    
    legend.append('text')
      .attr('x', 25)
      .attr('y', legendY + 5)
      .style('font-size', '12px')
      .text('One-time Transactions');

    legendY += 20;

    // Recurring transactions legend
    legend.append('circle')
      .attr('cx', 10)
      .attr('cy', legendY)
      .attr('r', 4)
      .attr('fill', '#10b981')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2)
      .style('opacity', 0.9);
    
    legend.append('text')
      .attr('x', 25)
      .attr('y', legendY + 5)
      .style('font-size', '12px')
      .text('Recurring Transactions');

    legendY += 20;

    // Large transaction legend
    legend.append('circle')
      .attr('cx', 10)
      .attr('cy', legendY)
      .attr('r', 6)
      .attr('fill', 'none')
      .attr('stroke', '#ef4444')
      .attr('stroke-width', 2);
    
    legend.append('text')
      .attr('x', 25)
      .attr('y', legendY + 5)
      .style('font-size', '12px')
      .text(`Statistical Outliers (>${largeTransactionThreshold.toFixed(0)})`);

    // Cleanup tooltip and adjustment elements on component unmount
    return () => {
      d3.select('body').selectAll('.tooltip').remove();
      if (svgRef.current) {
        d3.select(svgRef.current).selectAll('.adjustment-background').remove();
        d3.select(svgRef.current).selectAll('.adjustment-connection-line').remove();
        d3.select(svgRef.current).selectAll('.adjustment-label').remove();
      }
    };
  }, [data, width, height, isCumulative, highlightedAdjustment, toggledAdjustments, showAdjustmentDataPoints]);

  return (
    <div className={`spending-simulation-graph w-full ${className}`}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="border border-gray-200 rounded-lg bg-white w-full"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
      />
    </div>
  );
};



export default SpendingSimulationGraph;
export type { DataPoint, SpendingSimulationGraphProps };
