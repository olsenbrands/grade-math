'use client';

/**
 * Image processing utilities for HEIC conversion and PDF handling
 */

// Type for heic2any since it doesn't have great types
type Heic2AnyResult = Blob | Blob[];

/**
 * Check if a file is HEIC/HEIF format
 */
export function isHeicFile(file: File): boolean {
  const heicTypes = ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'];
  if (heicTypes.includes(file.type.toLowerCase())) {
    return true;
  }
  // Also check by extension since some browsers don't set MIME type correctly
  const ext = file.name.toLowerCase().split('.').pop();
  return ext === 'heic' || ext === 'heif';
}

/**
 * Convert HEIC file to JPEG
 */
export async function convertHeicToJpeg(file: File): Promise<File> {
  if (!isHeicFile(file)) {
    return file;
  }

  try {
    // Dynamic import to avoid SSR issues
    const heic2any = (await import('heic2any')).default;

    const result: Heic2AnyResult = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.9,
    });

    // heic2any can return single blob or array
    const convertedBlob = Array.isArray(result) ? result[0] : result;

    if (!convertedBlob) {
      throw new Error('HEIC conversion returned no data');
    }

    // Create new file with .jpg extension
    const newName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
    return new File([convertedBlob], newName, { type: 'image/jpeg' });
  } catch (error) {
    console.error('HEIC conversion failed:', error);
    throw new Error('Failed to convert HEIC image. Please convert to JPEG manually.');
  }
}

/**
 * Convert multiple files, handling HEIC conversion
 */
export async function processFilesForUpload(files: File[]): Promise<File[]> {
  const processed: File[] = [];

  for (const file of files) {
    if (isHeicFile(file)) {
      try {
        const converted = await convertHeicToJpeg(file);
        processed.push(converted);
      } catch {
        // If conversion fails, skip the file but don't break the batch
        console.warn(`Skipping HEIC file that failed to convert: ${file.name}`);
      }
    } else {
      processed.push(file);
    }
  }

  return processed;
}

/**
 * Check if file is a PDF
 */
export function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

/**
 * Render a single PDF page to a canvas and return as Blob
 */
async function renderPdfPageToBlob(
  pdfDoc: import('pdfjs-dist').PDFDocumentProxy,
  pageNum: number,
  scale: number = 2.0
): Promise<Blob> {
  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale });

  // Create canvas
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Could not get canvas context');
  }

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  // Render page
  await page.render({
    canvasContext: context,
    viewport: viewport,
    canvas: canvas,
  }).promise;

  // Convert to blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to convert canvas to blob'));
        }
      },
      'image/jpeg',
      0.9
    );
  });
}

export interface PdfPage {
  pageNumber: number;
  file: File;
}

/**
 * Convert PDF to array of image files (one per page)
 */
export async function convertPdfToImages(
  file: File,
  onProgress?: (current: number, total: number) => void
): Promise<PdfPage[]> {
  if (!isPdfFile(file)) {
    throw new Error('File is not a PDF');
  }

  try {
    // Dynamic import to avoid SSR issues
    const pdfjsLib = await import('pdfjs-dist');

    // Set worker source - use CDN for simplicity
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

    // Load PDF
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const numPages = pdfDoc.numPages;

    const pages: PdfPage[] = [];
    const baseName = file.name.replace(/\.pdf$/i, '');

    for (let i = 1; i <= numPages; i++) {
      onProgress?.(i, numPages);

      const blob = await renderPdfPageToBlob(pdfDoc, i);
      const pageFile = new File(
        [blob],
        `${baseName}_page${i.toString().padStart(3, '0')}.jpg`,
        { type: 'image/jpeg' }
      );

      pages.push({
        pageNumber: i,
        file: pageFile,
      });
    }

    return pages;
  } catch (error) {
    console.error('PDF conversion failed:', error);
    throw new Error('Failed to process PDF. Please ensure it is not corrupted or password-protected.');
  }
}

/**
 * Process a batch of files, converting HEIC and splitting PDFs
 */
export interface ProcessedFile {
  file: File;
  originalName: string;
  pageNumber?: number;
  isPdfPage: boolean;
}

export async function processUploadBatch(
  files: File[],
  onProgress?: (message: string) => void
): Promise<ProcessedFile[]> {
  const results: ProcessedFile[] = [];

  for (const file of files) {
    if (isPdfFile(file)) {
      onProgress?.(`Processing PDF: ${file.name}`);
      try {
        const pages = await convertPdfToImages(file, (current, total) => {
          onProgress?.(`Converting ${file.name}: page ${current}/${total}`);
        });

        for (const page of pages) {
          results.push({
            file: page.file,
            originalName: file.name,
            pageNumber: page.pageNumber,
            isPdfPage: true,
          });
        }
      } catch (error) {
        console.error(`Failed to process PDF ${file.name}:`, error);
        // Don't break the batch, just skip this file
      }
    } else if (isHeicFile(file)) {
      onProgress?.(`Converting HEIC: ${file.name}`);
      try {
        const converted = await convertHeicToJpeg(file);
        results.push({
          file: converted,
          originalName: file.name,
          isPdfPage: false,
        });
      } catch (error) {
        console.error(`Failed to convert HEIC ${file.name}:`, error);
      }
    } else {
      results.push({
        file,
        originalName: file.name,
        isPdfPage: false,
      });
    }
  }

  return results;
}

/**
 * Calculate image stability by comparing two image data arrays
 * Returns a value between 0 (completely different) and 1 (identical)
 */
export function calculateFrameStability(
  prevData: Uint8ClampedArray,
  currData: Uint8ClampedArray,
  sampleRate: number = 10
): number {
  if (prevData.length !== currData.length) {
    return 0;
  }

  let totalDiff = 0;
  let samples = 0;

  // Sample pixels at regular intervals for performance
  for (let i = 0; i < prevData.length; i += 4 * sampleRate) {
    const prevR = prevData[i] ?? 0;
    const prevG = prevData[i + 1] ?? 0;
    const prevB = prevData[i + 2] ?? 0;
    const currR = currData[i] ?? 0;
    const currG = currData[i + 1] ?? 0;
    const currB = currData[i + 2] ?? 0;

    const rDiff = Math.abs(prevR - currR);
    const gDiff = Math.abs(prevG - currG);
    const bDiff = Math.abs(prevB - currB);

    totalDiff += (rDiff + gDiff + bDiff) / 3;
    samples++;
  }

  if (samples === 0) return 0;

  const avgDiff = totalDiff / samples;
  // Normalize to 0-1 range (255 is max diff per channel)
  const stability = 1 - avgDiff / 255;

  return stability;
}

/**
 * Detect edges in an image using a simple Sobel-like operator
 * Returns edge strength map
 */
export function detectEdges(
  imageData: ImageData,
  threshold: number = 30
): { hasStrongEdges: boolean; edgePercentage: number } {
  const { data, width, height } = imageData;
  let edgePixels = 0;
  const totalPixels = width * height;

  // Simple edge detection using horizontal and vertical gradients
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;

      // Get grayscale values of surrounding pixels
      const getGray = (px: number, py: number) => {
        const i = (py * width + px) * 4;
        const r = data[i] ?? 0;
        const g = data[i + 1] ?? 0;
        const b = data[i + 2] ?? 0;
        return (r + g + b) / 3;
      };

      const center = getGray(x, y);
      const left = getGray(x - 1, y);
      const right = getGray(x + 1, y);
      const top = getGray(x, y - 1);
      const bottom = getGray(x, y + 1);

      // Calculate gradient magnitude
      const gx = right - left;
      const gy = bottom - top;
      const magnitude = Math.sqrt(gx * gx + gy * gy);

      if (magnitude > threshold) {
        edgePixels++;
      }
    }
  }

  const edgePercentage = edgePixels / totalPixels;

  // Consider strong edges if more than 2% of image has edges
  // This indicates a document/paper is likely in frame
  return {
    hasStrongEdges: edgePercentage > 0.02,
    edgePercentage,
  };
}

/**
 * Analyze image for paper/document detection
 * Combines edge detection with brightness analysis
 */
export function analyzeForDocument(imageData: ImageData): {
  isLikelyDocument: boolean;
  confidence: number;
  feedback: string;
} {
  const { hasStrongEdges, edgePercentage } = detectEdges(imageData);
  const { data } = imageData;

  // Calculate average brightness
  let totalBrightness = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    totalBrightness += (r + g + b) / 3;
  }
  const avgBrightness = totalBrightness / (data.length / 4);

  // Documents tend to be bright (white paper) with clear edges
  const isBright = avgBrightness > 150;
  const hasGoodEdges = edgePercentage > 0.015 && edgePercentage < 0.15;

  let confidence = 0;
  let feedback = '';

  if (hasStrongEdges && isBright && hasGoodEdges) {
    confidence = 0.9;
    feedback = 'Document detected - hold steady';
  } else if (hasStrongEdges && hasGoodEdges) {
    confidence = 0.7;
    feedback = 'Document detected - improve lighting';
  } else if (isBright && !hasStrongEdges) {
    confidence = 0.3;
    feedback = 'Move closer to document';
  } else {
    confidence = 0.2;
    feedback = 'No document detected';
  }

  return {
    isLikelyDocument: confidence > 0.6,
    confidence,
    feedback,
  };
}
