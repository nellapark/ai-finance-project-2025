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
  data = [],
  width = 1200,
  height = 500,
  className = '',
  isCumulative = false,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    console.log('🎨 [Graph] Rendering with data:', {
      dataLength: data?.length || 0,
      hasData: !!data,
      isCumulative,
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

    // Add transaction points
    g.selectAll('.transaction-point')
      .data(validData)
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
      .data(validData.filter(d => Math.abs(d.originalAmount || d.amount) > 500))
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
        tooltip.style('visibility', 'visible')
          .html(`
            <strong>${dataPoint.description || 'Transaction'}</strong><br/>
            ${isCumulative ? `Cumulative Total: $${(dataPoint.cumulativeBalance || dataPoint.amount).toLocaleString()}<br/>` : ''}
            Amount: $${dataPoint.amount.toLocaleString()}<br/>
            Original: $${(dataPoint.originalAmount || 0).toFixed(2)}<br/>
            Category: ${dataPoint.category || 'N/A'}<br/>
            Date: ${dataPoint.time.toLocaleDateString()}<br/>
            ${dataPoint.isRecurring ? `Recurring: Yes` : ''}<br/>
            ${dataPoint.confidence ? `Confidence: ${(dataPoint.confidence * 100).toFixed(0)}%` : ''}
          `);
        
        d3.select(this)
          .attr('r', 6)
          .attr('stroke-width', 3);
      })
      .on('mousemove', function(event) {
        tooltip.style('top', (event.pageY - 10) + 'px')
          .style('left', (event.pageX + 10) + 'px');
      })
      .on('mouseout', function() {
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



export default SpendingSimulationGraph;
export type { DataPoint, SpendingSimulationGraphProps };
