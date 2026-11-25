import type {
  DocumentCheckExtraction,
  ManagementSummaryMetrics,
} from '../types/compliance';

const CLIENT_TIMEOUT_MS = 30_000;

async function postJsonWithTimeout<T>(url: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const data = (await response.json().catch(() => ({}))) as { error?: string } & T;
    if (!response.ok) {
      throw new Error(data.error || `Request failed with status ${response.status}.`);
    }
    return data;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Request timed out while waiting for Gemini.');
    }
    throw err instanceof Error ? err : new Error('Unexpected network error.');
  } finally {
    clearTimeout(timer);
  }
}

export async function requestDocumentCheck(params: {
  base64Data: string;
  mimeType: string;
}): Promise<DocumentCheckExtraction> {
  const res = await postJsonWithTimeout<{ extraction: DocumentCheckExtraction }>(
    '/api/gemini/document-check',
    params
  );
  return res.extraction;
}

export async function requestManagementSummary(
  metrics: ManagementSummaryMetrics
): Promise<{ summaryText: string }> {
  return postJsonWithTimeout<{ summaryText: string }>(
    '/api/gemini/management-summary',
    { metrics }
  );
}
