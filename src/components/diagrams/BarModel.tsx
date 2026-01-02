/**
 * BarModel - SVG component for Singapore Math bar models and tape diagrams
 *
 * Renders part-whole relationships and comparison diagrams.
 * Used extensively in Singapore Math and Common Core methodologies.
 */

'use client';

import {
  type BarModelData,
  DIAGRAM_COLOR_PALETTE,
  DIAGRAM_COLORS,
} from '@/lib/ai/diagram-types';
import { cn } from '@/lib/utils';

interface BarModelProps {
  data: BarModelData;
  textFallback: string;
  className?: string;
}

// SVG dimensions
const SVG_WIDTH = 500;
const SVG_HEIGHT = 140;
const BAR_HEIGHT = 45;
const BAR_Y = 45;
const PADDING = 25;
const BAR_WIDTH = SVG_WIDTH - PADDING * 2;

export function BarModel({ data, textFallback, className }: BarModelProps) {
  const { layout, parts, total, unknownIndex, labels } = data;

  // Calculate known values for proportions
  const numericParts = parts.map((p) =>
    typeof p.value === 'number' ? p.value : 0
  );
  const knownTotal = numericParts.reduce((sum, v) => sum + v, 0);
  const displayTotal = total ?? knownTotal;

  // Calculate widths proportionally
  const getPartWidth = (value: number | '?', idx: number): number => {
    if (value === '?') {
      // Unknown part takes remaining space
      const knownSum = numericParts.reduce((sum, v, i) => {
        if (i === idx) return sum;
        return sum + v;
      }, 0);
      const unknownValue = displayTotal - knownSum;
      return Math.max(30, (unknownValue / displayTotal) * BAR_WIDTH);
    }
    return Math.max(30, (value / displayTotal) * BAR_WIDTH);
  };

  // Generate bar segments
  const renderPartWholeBar = () => {
    let currentX = PADDING;
    const segments: React.ReactNode[] = [];
    const GAP = 2; // Small gap between segments for clarity

    parts.forEach((part, idx) => {
      const rawWidth = getPartWidth(part.value, idx);
      const width = Math.max(40, rawWidth - GAP); // Ensure minimum width, account for gap
      const isUnknown = part.value === '?' || idx === unknownIndex;
      const color = part.color || DIAGRAM_COLOR_PALETTE[idx % DIAGRAM_COLOR_PALETTE.length];

      segments.push(
        <g key={idx}>
          {/* Bar segment */}
          <rect
            x={currentX}
            y={BAR_Y}
            width={width}
            height={BAR_HEIGHT}
            fill={isUnknown ? DIAGRAM_COLORS.fill : color}
            stroke={DIAGRAM_COLORS.stroke}
            strokeWidth={2}
            rx={idx === 0 ? 4 : 0}
            ry={idx === 0 ? 4 : 0}
            className={isUnknown ? 'opacity-60' : ''}
          />
          {/* Hatching for unknown */}
          {isUnknown && (
            <pattern
              id={`hatch-${idx}`}
              patternUnits="userSpaceOnUse"
              width="8"
              height="8"
              patternTransform="rotate(45)"
            >
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="8"
                stroke={DIAGRAM_COLORS.strokeLight}
                strokeWidth="2"
              />
            </pattern>
          )}
          {isUnknown && (
            <rect
              x={currentX}
              y={BAR_Y}
              width={width}
              height={BAR_HEIGHT}
              fill={`url(#hatch-${idx})`}
              rx={idx === 0 ? 4 : 0}
            />
          )}
          {/* Value label */}
          <text
            x={currentX + width / 2}
            y={BAR_Y + BAR_HEIGHT / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            className={`font-bold ${isUnknown ? 'fill-amber-600 dark:fill-amber-400' : 'fill-gray-800 dark:fill-gray-200'}`}
            style={{ fontSize: isUnknown ? '18px' : '14px' }}
          >
            {isUnknown ? '?' : part.value}
          </text>
          {/* Part label below - positioned to avoid overlap */}
          {part.label && (
            <text
              x={currentX + width / 2}
              y={BAR_Y + BAR_HEIGHT + 20}
              textAnchor="middle"
              className="text-xs fill-gray-700 dark:fill-gray-300 font-medium"
              style={{ fontSize: '12px' }}
            >
              {part.label}
            </text>
          )}
        </g>
      );

      currentX += width + GAP;
    });

    return segments;
  };

  // Render comparison bars (two parallel bars)
  const renderComparisonBars = () => {
    // For comparison, we show two bars stacked
    // First bar is parts[0], second is parts[1]
    const bar1Value = typeof parts[0]?.value === 'number' ? parts[0].value : displayTotal * 0.6;
    const bar2Value = typeof parts[1]?.value === 'number' ? parts[1].value : displayTotal * 0.4;
    const maxValue = Math.max(bar1Value, bar2Value);

    const bar1Width = (bar1Value / maxValue) * BAR_WIDTH;
    const bar2Width = (bar2Value / maxValue) * BAR_WIDTH;

    const bar1Y = 25;
    const bar2Y = 75;
    const compBarHeight = 30;

    return (
      <>
        {/* First bar */}
        <rect
          x={PADDING}
          y={bar1Y}
          width={bar1Width}
          height={compBarHeight}
          fill={parts[0]?.color || DIAGRAM_COLOR_PALETTE[0]}
          stroke={DIAGRAM_COLORS.stroke}
          strokeWidth={2}
          rx={4}
        />
        <text
          x={PADDING + bar1Width / 2}
          y={bar1Y + compBarHeight / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          className="text-sm font-semibold fill-gray-800 dark:fill-gray-200"
          style={{ fontSize: '13px' }}
        >
          {parts[0]?.value === '?' ? '?' : parts[0]?.value}
        </text>
        {parts[0]?.label && (
          <text
            x={PADDING + bar1Width + 8}
            y={bar1Y + compBarHeight / 2}
            dominantBaseline="middle"
            className="text-xs fill-gray-600 dark:fill-gray-400"
            style={{ fontSize: '11px' }}
          >
            {parts[0].label}
          </text>
        )}

        {/* Second bar */}
        <rect
          x={PADDING}
          y={bar2Y}
          width={bar2Width}
          height={compBarHeight}
          fill={parts[1]?.color || DIAGRAM_COLOR_PALETTE[1]}
          stroke={DIAGRAM_COLORS.stroke}
          strokeWidth={2}
          rx={4}
        />
        <text
          x={PADDING + bar2Width / 2}
          y={bar2Y + compBarHeight / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          className="text-sm font-semibold fill-gray-800 dark:fill-gray-200"
          style={{ fontSize: '13px' }}
        >
          {parts[1]?.value === '?' ? '?' : parts[1]?.value}
        </text>
        {parts[1]?.label && (
          <text
            x={PADDING + bar2Width + 8}
            y={bar2Y + compBarHeight / 2}
            dominantBaseline="middle"
            className="text-xs fill-gray-600 dark:fill-gray-400"
            style={{ fontSize: '11px' }}
          >
            {parts[1].label}
          </text>
        )}
      </>
    );
  };

  return (
    <div className={cn('my-4', className)}>
      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        className="w-full max-w-md"
        role="img"
        aria-label={textFallback}
      >
        {/* Total bracket for part-whole */}
        {layout === 'part-whole' && displayTotal > 0 && (
          <>
            <path
              d={`M ${PADDING} ${BAR_Y - 8} L ${PADDING} ${BAR_Y - 15} L ${SVG_WIDTH - PADDING} ${BAR_Y - 15} L ${SVG_WIDTH - PADDING} ${BAR_Y - 8}`}
              fill="none"
              stroke={DIAGRAM_COLORS.strokeLight}
              strokeWidth={1.5}
            />
            <text
              x={SVG_WIDTH / 2}
              y={BAR_Y - 22}
              textAnchor="middle"
              className="text-xs font-medium fill-gray-600 dark:fill-gray-400"
              style={{ fontSize: '12px' }}
            >
              {labels?.total || `Total: ${displayTotal}`}
            </text>
          </>
        )}

        {/* Render appropriate bar style */}
        {layout === 'comparison' ? renderComparisonBars() : renderPartWholeBar()}
      </svg>
    </div>
  );
}
