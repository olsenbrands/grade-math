/**
 * FractionVisual - SVG component for fraction representations
 *
 * Renders fractions as circles (pie charts) or strips (bar segments).
 * Supports comparison mode for side-by-side fractions.
 */

'use client';

import {
  type FractionVisualData,
  DIAGRAM_COLOR_PALETTE,
  DIAGRAM_COLORS,
} from '@/lib/ai/diagram-types';
import { cn } from '@/lib/utils';

interface FractionVisualProps {
  data: FractionVisualData;
  textFallback: string;
  className?: string;
}

// SVG dimensions
const SVG_WIDTH = 400;
const SVG_HEIGHT = 120;

// Circle dimensions
const CIRCLE_RADIUS = 40;
const CIRCLE_CY = 60;

// Strip dimensions
const STRIP_HEIGHT = 40;
const STRIP_Y = 40;
const STRIP_PADDING = 20;
const STRIP_WIDTH = SVG_WIDTH - STRIP_PADDING * 2;

export function FractionVisual({
  data,
  textFallback,
  className,
}: FractionVisualProps) {
  const { type, fractions, showComparison } = data;

  const renderCircleFraction = (
    fraction: (typeof fractions)[0],
    centerX: number,
    centerY: number,
    radius: number,
    colorIndex: number
  ) => {
    const { numerator, denominator, shaded = numerator, label } = fraction;
    const color = fraction.color || DIAGRAM_COLOR_PALETTE[colorIndex % DIAGRAM_COLOR_PALETTE.length];

    const segments: React.ReactNode[] = [];
    const anglePerPart = (2 * Math.PI) / denominator;

    for (let i = 0; i < denominator; i++) {
      const startAngle = i * anglePerPart - Math.PI / 2;
      const endAngle = (i + 1) * anglePerPart - Math.PI / 2;

      const x1 = centerX + radius * Math.cos(startAngle);
      const y1 = centerY + radius * Math.sin(startAngle);
      const x2 = centerX + radius * Math.cos(endAngle);
      const y2 = centerY + radius * Math.sin(endAngle);

      const largeArc = anglePerPart > Math.PI ? 1 : 0;
      const isShaded = i < shaded;

      const pathData = `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;

      segments.push(
        <path
          key={i}
          d={pathData}
          fill={isShaded ? color : DIAGRAM_COLORS.fill}
          stroke={DIAGRAM_COLORS.stroke}
          strokeWidth={1.5}
          className={isShaded ? '' : 'dark:fill-gray-700'}
        />
      );
    }

    return (
      <g>
        {segments}
        {/* Circle outline */}
        <circle
          cx={centerX}
          cy={centerY}
          r={radius}
          fill="none"
          stroke={DIAGRAM_COLORS.stroke}
          strokeWidth={2}
        />
        {/* Fraction label below */}
        {label ? (
          <text
            x={centerX}
            y={centerY + radius + 20}
            textAnchor="middle"
            className="text-xs fill-gray-600 dark:fill-gray-400"
            style={{ fontSize: '11px' }}
          >
            {label}
          </text>
        ) : (
          <text
            x={centerX}
            y={centerY + radius + 20}
            textAnchor="middle"
            className="text-sm font-medium fill-gray-700 dark:fill-gray-300"
            style={{ fontSize: '13px' }}
          >
            {numerator}/{denominator}
          </text>
        )}
      </g>
    );
  };

  const renderStripFraction = (
    fraction: (typeof fractions)[0],
    startX: number,
    y: number,
    width: number,
    height: number,
    colorIndex: number
  ) => {
    const { numerator, denominator, shaded = numerator, label } = fraction;
    const color = fraction.color || DIAGRAM_COLOR_PALETTE[colorIndex % DIAGRAM_COLOR_PALETTE.length];

    const partWidth = width / denominator;
    const segments: React.ReactNode[] = [];

    for (let i = 0; i < denominator; i++) {
      const isShaded = i < shaded;
      const x = startX + i * partWidth;
      const isFirst = i === 0;
      const isLast = i === denominator - 1;

      segments.push(
        <rect
          key={i}
          x={x}
          y={y}
          width={partWidth}
          height={height}
          fill={isShaded ? color : DIAGRAM_COLORS.fill}
          stroke={DIAGRAM_COLORS.stroke}
          strokeWidth={1.5}
          rx={isFirst ? 4 : isLast ? 4 : 0}
          ry={isFirst ? 4 : isLast ? 4 : 0}
          className={isShaded ? '' : 'dark:fill-gray-700'}
        />
      );
    }

    return (
      <g>
        {/* Outer border */}
        <rect
          x={startX}
          y={y}
          width={width}
          height={height}
          fill="none"
          stroke={DIAGRAM_COLORS.stroke}
          strokeWidth={2}
          rx={4}
        />
        {segments}
        {/* Fraction label below */}
        <text
          x={startX + width / 2}
          y={y + height + 18}
          textAnchor="middle"
          className="text-sm font-medium fill-gray-700 dark:fill-gray-300"
          style={{ fontSize: '13px' }}
        >
          {label || `${numerator}/${denominator}`}
        </text>
      </g>
    );
  };

  const renderCircles = () => {
    const count = fractions.length;
    const spacing = SVG_WIDTH / (count + 1);
    const radius = count === 1 ? CIRCLE_RADIUS : Math.min(CIRCLE_RADIUS, (spacing - 20) / 2);

    return fractions.map((fraction, idx) => {
      const cx = spacing * (idx + 1);
      return (
        <g key={idx}>
          {renderCircleFraction(fraction, cx, CIRCLE_CY, radius, idx)}
        </g>
      );
    });
  };

  const renderStrips = () => {
    const count = fractions.length;
    if (showComparison && count > 1) {
      // Stack strips vertically
      const stripHeight = 30;
      const gap = 15;
      const totalHeight = count * stripHeight + (count - 1) * gap;
      const startY = (SVG_HEIGHT - totalHeight) / 2;

      return fractions.map((fraction, idx) => {
        const y = startY + idx * (stripHeight + gap);
        return (
          <g key={idx}>
            {renderStripFraction(
              fraction,
              STRIP_PADDING,
              y,
              STRIP_WIDTH,
              stripHeight,
              idx
            )}
          </g>
        );
      });
    } else {
      // Single strip or side by side
      const stripWidth = count === 1 ? STRIP_WIDTH : (STRIP_WIDTH - 20) / count;
      return fractions.map((fraction, idx) => {
        const x = STRIP_PADDING + idx * (stripWidth + 20);
        return (
          <g key={idx}>
            {renderStripFraction(fraction, x, STRIP_Y, stripWidth, STRIP_HEIGHT, idx)}
          </g>
        );
      });
    }
  };

  // Adjust height for multiple comparison strips
  const svgHeight =
    type === 'strip' && showComparison && fractions.length > 1
      ? Math.max(SVG_HEIGHT, fractions.length * 50 + 40)
      : SVG_HEIGHT;

  return (
    <div className={cn('my-4', className)}>
      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${svgHeight}`}
        className="w-full max-w-md"
        role="img"
        aria-label={textFallback}
      >
        {type === 'circle' ? renderCircles() : renderStrips()}
      </svg>
    </div>
  );
}
