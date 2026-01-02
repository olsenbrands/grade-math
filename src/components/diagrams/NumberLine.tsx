/**
 * NumberLine - SVG component for number line diagrams
 *
 * Renders a number line with points, labels, and jump arrows.
 * Used for addition, subtraction, counting, and number placement.
 */

'use client';

import {
  type NumberLineData,
  DIAGRAM_COLOR_PALETTE,
  DIAGRAM_COLORS,
} from '@/lib/ai/diagram-types';
import { cn } from '@/lib/utils';

interface NumberLineProps {
  data: NumberLineData;
  textFallback: string;
  className?: string;
}

// SVG dimensions
const SVG_WIDTH = 400;
const SVG_HEIGHT = 100;
const LINE_Y = 50;
const PADDING = 30;
const LINE_START = PADDING;
const LINE_END = SVG_WIDTH - PADDING;
const LINE_LENGTH = LINE_END - LINE_START;

export function NumberLine({ data, textFallback, className }: NumberLineProps) {
  const { min, max, points, jumps = [], tickInterval } = data;

  const range = max - min;

  // Calculate tick interval if not provided
  const calcTickInterval = tickInterval || calculateNiceInterval(range);

  // Convert value to X position
  const valueToX = (value: number): number => {
    const normalized = (value - min) / range;
    return LINE_START + normalized * LINE_LENGTH;
  };

  // Generate tick marks
  const ticks: number[] = [];
  let tickValue = Math.ceil(min / calcTickInterval) * calcTickInterval;
  while (tickValue <= max) {
    ticks.push(tickValue);
    tickValue += calcTickInterval;
  }
  // Always include min and max
  if (!ticks.includes(min)) ticks.unshift(min);
  if (!ticks.includes(max)) ticks.push(max);

  // Render jump arrows
  const renderJumps = () => {
    return jumps.map((jump, idx) => {
      const fromX = valueToX(jump.from);
      const toX = valueToX(jump.to);
      const midX = (fromX + toX) / 2;
      const arcHeight = 25;
      const color = jump.color || DIAGRAM_COLOR_PALETTE[idx % DIAGRAM_COLOR_PALETTE.length];

      // Arc path
      const arcPath = `M ${fromX} ${LINE_Y - 5} Q ${midX} ${LINE_Y - arcHeight} ${toX} ${LINE_Y - 5}`;

      return (
        <g key={idx}>
          {/* Arc */}
          <path
            d={arcPath}
            fill="none"
            stroke={color}
            strokeWidth={2}
            markerEnd={`url(#arrow-${idx})`}
          />
          {/* Arrow marker definition */}
          <defs>
            <marker
              id={`arrow-${idx}`}
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L0,6 L8,3 z" fill={color} />
            </marker>
          </defs>
          {/* Jump label */}
          {jump.label && (
            <text
              x={midX}
              y={LINE_Y - arcHeight - 5}
              textAnchor="middle"
              className="text-xs font-medium"
              style={{ fontSize: '11px', fill: color }}
            >
              {jump.label}
            </text>
          )}
        </g>
      );
    });
  };

  // Render points
  const renderPoints = () => {
    return points.map((point, idx) => {
      const x = valueToX(point.value);
      const isHighlighted = point.highlight;
      const labelPosition = point.position || 'above';
      const labelY = labelPosition === 'above' ? LINE_Y - 18 : LINE_Y + 28;

      return (
        <g key={idx}>
          {/* Point marker */}
          <circle
            cx={x}
            cy={LINE_Y}
            r={isHighlighted ? 6 : 4}
            fill={isHighlighted ? DIAGRAM_COLORS.highlight : DIAGRAM_COLORS.primary}
            stroke={DIAGRAM_COLORS.stroke}
            strokeWidth={1.5}
          />
          {/* Point label */}
          {point.label && (
            <text
              x={x}
              y={labelY}
              textAnchor="middle"
              className="text-xs font-medium fill-gray-700 dark:fill-gray-300"
              style={{ fontSize: '11px' }}
            >
              {point.label}
            </text>
          )}
        </g>
      );
    });
  };

  return (
    <div className={cn('my-4', className)}>
      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        className="w-full max-w-md"
        role="img"
        aria-label={textFallback}
      >
        {/* Main line */}
        <line
          x1={LINE_START}
          y1={LINE_Y}
          x2={LINE_END}
          y2={LINE_Y}
          stroke={DIAGRAM_COLORS.stroke}
          strokeWidth={2}
        />

        {/* Arrows at ends */}
        <polygon
          points={`${LINE_START - 8},${LINE_Y} ${LINE_START},${LINE_Y - 4} ${LINE_START},${LINE_Y + 4}`}
          fill={DIAGRAM_COLORS.stroke}
        />
        <polygon
          points={`${LINE_END + 8},${LINE_Y} ${LINE_END},${LINE_Y - 4} ${LINE_END},${LINE_Y + 4}`}
          fill={DIAGRAM_COLORS.stroke}
        />

        {/* Tick marks */}
        {ticks.map((tick, idx) => {
          const x = valueToX(tick);
          const isEndpoint = tick === min || tick === max;
          return (
            <g key={idx}>
              <line
                x1={x}
                y1={LINE_Y - (isEndpoint ? 8 : 5)}
                x2={x}
                y2={LINE_Y + (isEndpoint ? 8 : 5)}
                stroke={DIAGRAM_COLORS.stroke}
                strokeWidth={isEndpoint ? 2 : 1}
              />
              <text
                x={x}
                y={LINE_Y + 22}
                textAnchor="middle"
                className="text-xs fill-gray-600 dark:fill-gray-400"
                style={{ fontSize: '11px' }}
              >
                {tick}
              </text>
            </g>
          );
        })}

        {/* Jump arrows */}
        {renderJumps()}

        {/* Points */}
        {renderPoints()}
      </svg>
    </div>
  );
}

/**
 * Calculate a "nice" interval for tick marks
 */
function calculateNiceInterval(range: number): number {
  const roughInterval = range / 5;
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughInterval)));
  const normalized = roughInterval / magnitude;

  let niceInterval: number;
  if (normalized <= 1) {
    niceInterval = magnitude;
  } else if (normalized <= 2) {
    niceInterval = 2 * magnitude;
  } else if (normalized <= 5) {
    niceInterval = 5 * magnitude;
  } else {
    niceInterval = 10 * magnitude;
  }

  return niceInterval;
}
