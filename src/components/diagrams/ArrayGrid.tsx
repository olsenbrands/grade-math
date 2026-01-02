/**
 * ArrayGrid - SVG component for multiplication arrays
 *
 * Renders a grid of dots or squares showing multiplication concepts.
 * Supports row/column highlighting for visual emphasis.
 */

'use client';

import {
  type ArrayGridData,
  DIAGRAM_COLOR_PALETTE,
  DIAGRAM_COLORS,
} from '@/lib/ai/diagram-types';
import { cn } from '@/lib/utils';

interface ArrayGridProps {
  data: ArrayGridData;
  textFallback: string;
  className?: string;
}

// SVG dimensions
const SVG_WIDTH = 400;
const SVG_HEIGHT = 160;
const PADDING = 30;

// Grid sizing
const MAX_OBJECT_SIZE = 20;
const MIN_OBJECT_SIZE = 8;
const GAP = 6;

export function ArrayGrid({ data, textFallback, className }: ArrayGridProps) {
  const {
    rows,
    columns,
    objectStyle = 'dot',
    highlightRow,
    highlightColumn,
    showTotal,
    label,
  } = data;

  // Calculate object size to fit in viewport
  const availableWidth = SVG_WIDTH - PADDING * 2;
  const availableHeight = SVG_HEIGHT - PADDING * 2 - (showTotal || label ? 25 : 0);

  const objectWidth = Math.min(
    MAX_OBJECT_SIZE,
    Math.max(MIN_OBJECT_SIZE, (availableWidth - (columns - 1) * GAP) / columns)
  );
  const objectHeight = Math.min(
    MAX_OBJECT_SIZE,
    Math.max(MIN_OBJECT_SIZE, (availableHeight - (rows - 1) * GAP) / rows)
  );
  const objectSize = Math.min(objectWidth, objectHeight);

  // Calculate grid dimensions
  const gridWidth = columns * objectSize + (columns - 1) * GAP;
  const gridHeight = rows * objectSize + (rows - 1) * GAP;

  // Center the grid
  const startX = (SVG_WIDTH - gridWidth) / 2;
  const startY = PADDING;

  // Calculate total
  const total = rows * columns;

  // Render objects
  const renderObjects = () => {
    const objects: React.ReactNode[] = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < columns; c++) {
        const x = startX + c * (objectSize + GAP);
        const y = startY + r * (objectSize + GAP);

        // Check if this object should be highlighted
        const isRowHighlighted = highlightRow !== undefined && r + 1 === highlightRow;
        const isColHighlighted = highlightColumn !== undefined && c + 1 === highlightColumn;
        const isHighlighted = isRowHighlighted || isColHighlighted;

        const color = isHighlighted
          ? DIAGRAM_COLORS.highlight
          : DIAGRAM_COLOR_PALETTE[0];

        const key = `${r}-${c}`;

        if (objectStyle === 'square') {
          objects.push(
            <rect
              key={key}
              x={x}
              y={y}
              width={objectSize}
              height={objectSize}
              fill={color}
              stroke={DIAGRAM_COLORS.stroke}
              strokeWidth={1}
              rx={2}
            />
          );
        } else {
          // dot
          const radius = objectSize / 2 - 1;
          objects.push(
            <circle
              key={key}
              cx={x + objectSize / 2}
              cy={y + objectSize / 2}
              r={radius}
              fill={color}
              stroke={DIAGRAM_COLORS.stroke}
              strokeWidth={1}
            />
          );
        }
      }
    }

    return objects;
  };

  // Render row labels
  const renderRowLabels = () => {
    const labels: React.ReactNode[] = [];
    for (let r = 0; r < rows; r++) {
      const y = startY + r * (objectSize + GAP) + objectSize / 2;
      labels.push(
        <text
          key={`row-${r}`}
          x={startX - 12}
          y={y}
          textAnchor="middle"
          dominantBaseline="middle"
          className="text-xs fill-gray-500 dark:fill-gray-500"
          style={{ fontSize: '10px' }}
        >
          {r + 1}
        </text>
      );
    }
    return labels;
  };

  // Render column labels
  const renderColumnLabels = () => {
    const labels: React.ReactNode[] = [];
    for (let c = 0; c < columns; c++) {
      const x = startX + c * (objectSize + GAP) + objectSize / 2;
      labels.push(
        <text
          key={`col-${c}`}
          x={x}
          y={startY - 12}
          textAnchor="middle"
          dominantBaseline="middle"
          className="text-xs fill-gray-500 dark:fill-gray-500"
          style={{ fontSize: '10px' }}
        >
          {c + 1}
        </text>
      );
    }
    return labels;
  };

  // Adjust SVG height based on content
  const labelY = startY + gridHeight + 25;
  const svgHeight = Math.max(SVG_HEIGHT, labelY + 20);

  return (
    <div className={cn('my-4', className)}>
      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${svgHeight}`}
        className="w-full max-w-md"
        role="img"
        aria-label={textFallback}
      >
        {/* Row and column labels (for larger grids) */}
        {rows <= 10 && columns <= 10 && (
          <>
            {renderRowLabels()}
            {renderColumnLabels()}
          </>
        )}

        {/* Grid objects */}
        {renderObjects()}

        {/* Dimension labels on sides */}
        <text
          x={startX + gridWidth + 15}
          y={startY + gridHeight / 2}
          textAnchor="start"
          dominantBaseline="middle"
          className="text-sm font-medium fill-gray-600 dark:fill-gray-400"
          style={{ fontSize: '12px' }}
        >
          {rows} rows
        </text>

        <text
          x={startX + gridWidth / 2}
          y={startY + gridHeight + 15}
          textAnchor="middle"
          className="text-sm font-medium fill-gray-600 dark:fill-gray-400"
          style={{ fontSize: '12px' }}
        >
          {columns} columns
        </text>

        {/* Total or label at bottom */}
        {(showTotal || label) && (
          <text
            x={SVG_WIDTH / 2}
            y={labelY}
            textAnchor="middle"
            className="text-base font-semibold fill-gray-800 dark:fill-gray-200"
            style={{ fontSize: '14px' }}
          >
            {label || `${rows} x ${columns} = ${total}`}
          </text>
        )}
      </svg>
    </div>
  );
}
