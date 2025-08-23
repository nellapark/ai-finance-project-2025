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
}

interface SpendingSimulationGraphProps {
  data?: DataPoint[];
  width?: number;
  height?: number;
  className?: string;
  isCumulative?: boolean;
}

const SpendingSimulationGraph: React.FC<SpendingSimulationGraphProps> = ({
  data = generateSampleData(),
  width = 1200,
  height = 500,
  className = '',
  isCumulative = false,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !data.length) return;

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
      .domain(d3.extent(data, (d) => d.time) as [Date, Date])
      .range([0, innerWidth]);

    const yScale = d3
      .scaleLinear()
      .domain(isCumulative 
        ? [0, d3.max(data, (d) => d.cumulativeBalance || d.amount) as number]
        : [0, d3.max(data, (d) => d.amount) as number]
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
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', '#3b82f6')
        .attr('stroke-width', 3)
        .attr('d', line);
    }

    // Add transaction points
    g.selectAll('.transaction-point')
      .data(data)
      .enter()
      .append('circle')
      .attr('class', 'transaction-point')
      .attr('cx', (d) => xScale(d.time))
      .attr('cy', (d) => isCumulative ? yScale(d.cumulativeBalance || d.amount) : yScale(d.amount))
      .attr('r', 4)
      .attr('fill', '#3b82f6')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer');

    // Add special indicators for large transactions
    g.selectAll('.large-transaction')
      .data(data.filter(d => Math.abs(d.originalAmount || d.amount) > 500))
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
      .on('mouseover', function(event, d: DataPoint) {
        tooltip.style('visibility', 'visible')
          .html(`
            <strong>${d.description || 'Transaction'}</strong><br/>
            ${isCumulative ? `Cumulative Total: $${(d.cumulativeBalance || d.amount).toLocaleString()}<br/>` : ''}
            Amount: $${d.amount.toLocaleString()}<br/>
            Original: $${(d.originalAmount || 0).toFixed(2)}<br/>
            Category: ${d.category || 'N/A'}<br/>
            Date: ${d.time.toLocaleDateString()}<br/>
            ${d.isRecurring ? `Recurring: Yes` : ''}<br/>
            ${d.confidence ? `Confidence: ${(d.confidence * 100).toFixed(0)}%` : ''}
          `);
        
        d3.select(this)
          .attr('r', 6)
          .attr('stroke-width', 3);
      })
      .on('mousemove', function(event) {
        tooltip.style('top', (event.pageY - 10) + 'px')
          .style('left', (event.pageX + 10) + 'px');
      })
      .on('mouseout', function(event, d) {
        tooltip.style('visibility', 'hidden');
        
        d3.select(this)
          .attr('r', 4)
          .attr('stroke-width', 2);
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

    // Transaction points legend
    legend.append('circle')
      .attr('cx', 10)
      .attr('cy', legendY)
      .attr('r', 4)
      .attr('fill', '#3b82f6')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2);
    
    legend.append('text')
      .attr('x', 25)
      .attr('y', legendY + 5)
      .style('font-size', '12px')
      .text(isCumulative ? 'Spending Points' : 'Transaction Amounts');

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
      .text('Large Transactions ($500+)');

    // Cleanup tooltip on component unmount
    return () => {
      d3.select('body').selectAll('.tooltip').remove();
    };
  }, [data, width, height, isCumulative]);

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

// Generate sample data for demonstration
function generateSampleData(): DataPoint[] {
  const data: DataPoint[] = [];
  const startDate = new Date(2024, 0, 1); // January 1, 2024
  const baseAmount = 50000;

  for (let i = 0; i < 12; i++) {
    const date = new Date(startDate);
    date.setMonth(date.getMonth() + i);
    
    // Simulate spending pattern with some randomness
    const monthlySpending = baseAmount - (i * 3000) + (Math.random() - 0.5) * 5000;
    
    data.push({
      time: date,
      amount: Math.max(0, monthlySpending), // Ensure non-negative values
    });
  }

  return data;
}

export default SpendingSimulationGraph;
export type { DataPoint, SpendingSimulationGraphProps };
