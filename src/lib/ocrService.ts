import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { createWorker, type Worker } from 'tesseract.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const MAX_PDF_PAGES = 3;
const MIN_TEXT_LAYER_CHARS = 40;
const PDF_OCR_DPI = 240; // Within 200-300 DPI for crisp browser OCR
const PDF_POINTS_PER_INCH = 72;

export interface OcrProgressUpdate {
  stage: string;
  progress: number; // 0..100
  page?: number;
  totalPages?: number;
}

export interface OcrExtractionOutput {
  text: string;
  confidence: number; // 0..100
  sourceMode: 'pdf-text-layer' | 'pdf-ocr' | 'image-ocr';
  pagesProcessed: number;
}

/**
 * Swappable OCR interface so browser Tesseract.js can later be replaced with
 * Google Document AI or Cloud Vision without modifying callers.
 */
export interface OcrProvider {
  readonly name: string;
  extractText: (
    file: File,
    onProgress?: (update: OcrProgressUpdate) => void
  ) => Promise<OcrExtractionOutput>;
}

async function createEnglishTesseractWorker(
  onWorkerProgress: (progressFraction: number, status: string) => void
): Promise<Worker> {
  return createWorker('eng', 1, {
    logger: (msg) => {
      if (typeof msg.progress === 'number') {
        onWorkerProgress(msg.progress, msg.status || 'Running OCR');
      }
    },
  });
}

function normalizeExtractedPageText(raw: string): string {
  return raw.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim();
}

async function extractPdfTextWithOcrFallback(
  file: File,
  onProgress?: (update: OcrProgressUpdate) => void
): Promise<OcrExtractionOutput> {
  onProgress?.({ stage: 'Loading PDF document...', progress: 5 });

  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;

  const pagesToProcess = Math.min(pdf.numPages, MAX_PDF_PAGES);
  if (pagesToProcess === 0) {
    throw new Error('Uploaded PDF contains no readable pages.');
  }

  const pageTexts: string[] = [];
  const pageConfidences: number[] = [];
  let usedOcr = false;
  let worker: Worker | null = null;
  let currentPageForLog = 1;

  try {
    for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
      currentPageForLog = pageNum;
      const basePct = Math.round(((pageNum - 1) / pagesToProcess) * 90) + 5;

      onProgress?.({
        stage: `Inspecting PDF page ${pageNum} of ${pagesToProcess} text layer...`,
        progress: basePct,
        page: pageNum,
        totalPages: pagesToProcess,
      });

      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const rawEmbedded = textContent.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ');
      const cleanedEmbedded = normalizeExtractedPageText(rawEmbedded);
      const nonWhitespaceCount = cleanedEmbedded.replace(/\s+/g, '').length;

      if (nonWhitespaceCount >= MIN_TEXT_LAYER_CHARS) {
        pageTexts.push(cleanedEmbedded);
        pageConfidences.push(100);
        page.cleanup();
        continue;
      }

      // Scanned or image-only PDF page: render to offscreen canvas at ~240 DPI and run Tesseract OCR
      usedOcr = true;
      onProgress?.({
        stage: `Rendering scanned PDF page ${pageNum} of ${pagesToProcess} (${PDF_OCR_DPI} DPI)...`,
        progress: Math.min(95, basePct + 5),
        page: pageNum,
        totalPages: pagesToProcess,
      });

      const viewport = page.getViewport({ scale: PDF_OCR_DPI / PDF_POINTS_PER_INCH });
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));

      const context = canvas.getContext('2d');
      if (!context) {
        page.cleanup();
        throw new Error('Browser canvas 2D context unavailable for PDF OCR rendering.');
      }

      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);

      try {
        await page.render({ canvas, viewport }).promise;

        if (!worker) {
          onProgress?.({
            stage: 'Initializing English OCR engine...',
            progress: Math.min(95, basePct + 8),
            page: pageNum,
            totalPages: pagesToProcess,
          });
          worker = await createEnglishTesseractWorker((fraction, status) => {
            const pageSpan = Math.round(85 / pagesToProcess);
            const pct = Math.min(
              96,
              Math.round(((currentPageForLog - 1) / pagesToProcess) * 85 + 10 + fraction * pageSpan)
            );
            onProgress?.({
              stage: `OCR page ${currentPageForLog} of ${pagesToProcess}: ${status}`,
              progress: pct,
              page: currentPageForLog,
              totalPages: pagesToProcess,
            });
          });
        }

        const result = await worker.recognize(canvas);
        const ocrText = normalizeExtractedPageText(result.data.text || '');
        const conf =
          typeof result.data.confidence === 'number' && Number.isFinite(result.data.confidence)
            ? Math.max(0, Math.min(100, result.data.confidence))
            : 0;

        if (ocrText) {
          pageTexts.push(ocrText);
        }
        pageConfidences.push(ocrText ? conf : 0);
      } finally {
        // Immediately release rendered pixel buffers
        canvas.width = 0;
        canvas.height = 0;
        page.cleanup();
      }
    }
  } finally {
    if (worker) {
      await worker.terminate().catch(() => undefined);
    }
    await pdf.cleanup().catch(() => undefined);
    await loadingTask.destroy().catch(() => undefined);
  }

  onProgress?.({ stage: 'Finalizing OCR extraction...', progress: 98 });

  const avgConfidence =
    pageConfidences.length > 0
      ? Math.round(
          (pageConfidences.reduce((sum, c) => sum + c, 0) / pageConfidences.length) * 10
        ) / 10
      : 0;

  return {
    text: pageTexts.join('\n').trim(),
    confidence: avgConfidence,
    sourceMode: usedOcr ? 'pdf-ocr' : 'pdf-text-layer',
    pagesProcessed: pagesToProcess,
  };
}

async function extractImageTextWithOcr(
  file: File,
  onProgress?: (update: OcrProgressUpdate) => void
): Promise<OcrExtractionOutput> {
  onProgress?.({ stage: 'Initializing English OCR engine...', progress: 8 });
  const objectUrl = URL.createObjectURL(file);
  let worker: Worker | null = null;

  try {
    worker = await createEnglishTesseractWorker((fraction, status) => {
      const pct = Math.min(96, Math.max(10, Math.round(10 + fraction * 85)));
      onProgress?.({
        stage: `Running OCR on image: ${status}`,
        progress: pct,
        page: 1,
        totalPages: 1,
      });
    });

    const result = await worker.recognize(objectUrl);
    const cleanedText = normalizeExtractedPageText(result.data.text || '');
    const confidence =
      typeof result.data.confidence === 'number' && Number.isFinite(result.data.confidence)
        ? Math.round(Math.max(0, Math.min(100, result.data.confidence)) * 10) / 10
        : 0;

    onProgress?.({ stage: 'Finalizing OCR extraction...', progress: 98 });

    return {
      text: cleanedText,
      confidence: cleanedText ? confidence : 0,
      sourceMode: 'image-ocr',
      pagesProcessed: 1,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
    if (worker) {
      await worker.terminate().catch(() => undefined);
    }
  }
}

export const browserTesseractOcrProvider: OcrProvider = {
  name: 'Browser Tesseract.js + PDF.js (English)',
  async extractText(file, onProgress) {
    const mime = file.type.toLowerCase();
    if (mime === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      return extractPdfTextWithOcrFallback(file, onProgress);
    }
    return extractImageTextWithOcr(file, onProgress);
  },
};

/**
 * Active OCR service entrypoint. Swap `activeOcrProvider` for Google Document AI
 * or Cloud Vision later without changing consumers.
 */
export let activeOcrProvider: OcrProvider = browserTesseractOcrProvider;

export function extractText(
  file: File,
  onProgress?: (update: OcrProgressUpdate) => void
): Promise<OcrExtractionOutput> {
  return activeOcrProvider.extractText(file, onProgress);
}
