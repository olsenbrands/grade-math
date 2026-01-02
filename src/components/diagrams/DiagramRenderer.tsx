/**
 * DiagramRenderer - Router component for visual math diagrams
 *
 * Routes diagram data to the appropriate SVG component based on type.
 * Includes error handling and text fallback for unsupported types.
 */

'use client';

import { type DiagramData, validateDiagramData } from '@/lib/ai/diagram-types';
import { BarModel } from './BarModel';
import { NumberLine } from './NumberLine';
import { FractionVisual } from './FractionVisual';
import { ArrayGrid } from './ArrayGrid';

interface DiagramRendererProps {
  diagram: DiagramData | null | undefined;
  className?: string;
}

/**
 * Fallback component for unsupported or invalid diagrams
 */
function DiagramFallback({ text }: { text: string }) {
  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 my-3">
      <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
        Visual Representation:
      </p>
      <p className="text-sm text-blue-700 dark:text-blue-300">{text}</p>
    </div>
  );
}

/**
 * Main diagram router - renders the appropriate SVG component
 *
 * Note: Data is validated before rendering. Any rendering errors
 * will be caught by React's error boundary in the parent component.
 */
export function DiagramRenderer({ diagram, className }: DiagramRendererProps) {
  // No diagram provided - return nothing
  if (!diagram) {
    return null;
  }

  // Validate diagram data
  if (!validateDiagramData(diagram)) {
    // If we have textFallback, show it
    if (diagram.textFallback) {
      return <DiagramFallback text={diagram.textFallback} />;
    }
    return null;
  }

  // Route to the appropriate diagram component
  switch (diagram.type) {
    case 'bar-model':
      return (
        <BarModel
          data={diagram.data as Parameters<typeof BarModel>[0]['data']}
          textFallback={diagram.textFallback}
          className={className}
        />
      );

    case 'number-line':
      return (
        <NumberLine
          data={diagram.data as Parameters<typeof NumberLine>[0]['data']}
          textFallback={diagram.textFallback}
          className={className}
        />
      );

    case 'fraction-visual':
      return (
        <FractionVisual
          data={diagram.data as Parameters<typeof FractionVisual>[0]['data']}
          textFallback={diagram.textFallback}
          className={className}
        />
      );

    case 'array-grid':
      return (
        <ArrayGrid
          data={diagram.data as Parameters<typeof ArrayGrid>[0]['data']}
          textFallback={diagram.textFallback}
          className={className}
        />
      );

    default:
      // Unknown type - show fallback
      return <DiagramFallback text={diagram.textFallback} />;
  }
}

export { DiagramFallback };
