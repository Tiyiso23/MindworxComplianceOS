import { GoogleGenAI, Type } from '@google/genai';
import type {
  DocumentCheckExtraction,
  ManagementSummaryMetrics,
} from '../src/types/compliance.ts';

const GEMINI_MODEL = 'gemini-4-hydrogen';
const REQUEST_TIMEOUT_MS = 25_000;

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not configured.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error('Gemini request timed out.'));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const textFieldSchema = (description: string) => ({
  type: Type.OBJECT,
  description,
  properties: {
    value: {
      type: Type.STRING,
      description: 'Extracted value, or empty string if missing or illegible.',
    },
    confidence: {
      type: Type.STRING,
      enum: ['High', 'Medium', 'Low'],
      description: 'Confidence level for this field.',
    },
    lowConfidenceReason: {
      type: Type.STRING,
      description:
        'Short explanation when confidence is Low (or empty string if High or Medium).',
    },
  },
  required: ['value', 'confidence', 'lowConfidenceReason'],
});

const yesNoFieldSchema = (description: string) => ({
  type: Type.OBJECT,
  description,
  properties: {
    value: {
      type: Type.STRING,
      enum: ['Yes', 'No'],
      description: 'Yes or No only.',
    },
    confidence: {
      type: Type.STRING,
      enum: ['High', 'Medium', 'Low'],
      description: 'Confidence level for this observation.',
    },
    lowConfidenceReason: {
      type: Type.STRING,
      description:
        'Short explanation when confidence is Low (or empty string if High or Medium).',
    },
  },
  required: ['value', 'confidence', 'lowConfidenceReason'],
});

export async function analyzeComplianceDocument(params: {
  base64Data: string;
  mimeType: string;
}): Promise<DocumentCheckExtraction> {
  const ai = getGeminiClient();

  const prompt = [
    'Inspect the uploaded compliance document (PDF or image) and extract the structured fields.',
    'Rules:',
    '1. Extract document type, company name shown on the document, issue date (ISO YYYY-MM-DD), and expiry date (ISO YYYY-MM-DD).',
    '2. For signaturePresent, stampPresent, and referenceNumberPresent, return ONLY "Yes" or "No".',
    '3. Provide a confidence level ("High", "Medium", or "Low") for each field, and a concise lowConfidenceReason whenever confidence is "Low".',
    '4. PRIVACY & SECURITY: Never extract, repeat, or include South African ID numbers, passport numbers, bank account numbers, tax numbers, actual reference numbers, or passwords/PINs anywhere in the output. Ignore them completely if present.',
    '5. If the file is blank, corrupted, illegible, or does not contain a readable document, set unreadableOrIncomplete to true with a brief unreadableReason.',
    '6. Never determine or guess compliance status.',
  ].join('\n');

  const response = await withTimeout(
    ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: params.mimeType,
              data: params.base64Data,
            },
          },
          { text: prompt },
        ],
      },
      config: {
        systemInstruction:
          'You are a careful document metadata extractor for South African corporate compliance records. Return strictly valid JSON matching the schema. Never extract sensitive identifiers (ID numbers, bank account numbers, reference numbers, or passwords).',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            documentType: textFieldSchema('Document title or statutory certificate type.'),
            companyName: textFieldSchema('Company or entity name printed on the document.'),
            issueDate: textFieldSchema('Issue date in ISO YYYY-MM-DD format, or empty string.'),
            expiryDate: textFieldSchema('Expiry or valid-until date in ISO YYYY-MM-DD format, or empty string.'),
            signaturePresent: yesNoFieldSchema('Whether an authorised signature is present (Yes/No).'),
            stampPresent: yesNoFieldSchema('Whether an official stamp or seal is present (Yes/No).'),
            referenceNumberPresent: yesNoFieldSchema(
              'Whether a certificate/reference number is visible (Yes/No only; do not return the number).'
            ),
            unreadableOrIncomplete: {
              type: Type.BOOLEAN,
              description: 'True if document is unreadable, blurry, or missing core structure.',
            },
            unreadableReason: {
              type: Type.STRING,
              description: 'Brief reason if unreadableOrIncomplete is true, otherwise empty string.',
            },
          },
          required: [
            'documentType',
            'companyName',
            'issueDate',
            'expiryDate',
            'signaturePresent',
            'stampPresent',
            'referenceNumberPresent',
            'unreadableOrIncomplete',
            'unreadableReason',
          ],
        },
      },
    }),
    REQUEST_TIMEOUT_MS
  );

  const rawText = response.text?.trim();
  if (!rawText) {
    throw new Error('Gemini returned an empty document analysis response.');
  }

  const parsed = JSON.parse(rawText) as DocumentCheckExtraction;
  return parsed;
}

export async function generateManagementSummaryWithGemini(
  metrics: ManagementSummaryMetrics
): Promise<{ summaryText: string }> {
  const ai = getGeminiClient();

  const prompt = [
    'Write an executive management compliance briefing based strictly on the supplied JSON metrics below.',
    '',
    'Strict Requirements:',
    '1. Length: 120 to 180 words of plain, clear business English for non-technical managers.',
    '2. Numbers: Use ONLY the exact numbers present in the supplied JSON. Never invent, estimate, sum, or recalculate numbers (including percentages). Write numbers as digits so they match the supplied JSON exactly.',
    '3. Structure: State what needs immediate attention first (non-compliant items, pending reviews, overdue/expired items, items awaiting review > 3 days), then state what is coming up (due in 30, 60, and 90 days, and expiry clusters).',
    '4. Privacy: Do NOT name any individuals, people, or owner labels.',
    '5. Status fidelity: Never describe items as compliant except using the supplied compliantGreen count.',
    '6. Data completeness: State plainly when records are incomplete or flagged for data quality / missing backup owners.',
    '',
    'Supplied Dashboard Figures (JSON):',
    JSON.stringify(metrics, null, 2),
  ].join('\n');

  const response = await withTimeout(
    ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        systemInstruction:
          'You write concise, factual management summaries strictly grounded in supplied dashboard metrics. Never fabricate or extrapolate numbers, never name individuals, and return valid JSON matching the schema.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summaryText: {
              type: Type.STRING,
              description: '120 to 180 words of plain business English using only supplied figures.',
            },
          },
          required: ['summaryText'],
        },
      },
    }),
    REQUEST_TIMEOUT_MS
  );

  const rawText = response.text?.trim();
  if (!rawText) {
    throw new Error('Gemini returned an empty management summary response.');
  }

  const parsed = JSON.parse(rawText) as { summaryText?: string };
  if (!parsed.summaryText || typeof parsed.summaryText !== 'string') {
    throw new Error('Gemini summary payload missing summaryText.');
  }

  return { summaryText: parsed.summaryText.trim() };
}
