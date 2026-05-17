import { apiFetch } from './api';

export type AdjustmentType = 'conversions' | 'clicks';
export type AdjustmentPartnerMode = 'single_partner' | 'per_row';
export type AdjustmentBatchStatus = 'previewed' | 'applied' | 'failed';

export type AdjustmentLookup = {
  id: string;
  publicId: string | null;
  name: string | null;
};

export type AdjustmentGoalLookup = {
  id: string;
  name: string | null;
};

export type AdjustmentRowError = {
  field: string;
  code: string;
  message: string;
};

export type AdjustmentPreviewRow = {
  rowNumber: number;
  valid: boolean;
  resolved: {
    affiliate?: AdjustmentLookup | null;
    offer?: AdjustmentLookup | null;
    advertiser?: AdjustmentLookup | null;
    goal?: AdjustmentGoalLookup | null;
    status?: string | null;
    externalId?: string | null;
    country?: string | null;
    ip?: string | null;
    createdAt?: string | null;
  };
  errors: AdjustmentRowError[];
};

export type AdjustmentBatch = {
  id: string;
  type: AdjustmentType;
  partnerMode: AdjustmentPartnerMode;
  defaultAffiliateId: string | null;
  defaultOfferId: string | null;
  defaultGoalId: string | null;
  defaultStatus: string | null;
  originalFilename: string | null;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  createdRows: number;
  skippedRows: number;
  status: AdjustmentBatchStatus;
  createdById: string | null;
  createdBy: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  createdAt: string | null;
  appliedAt: string | null;
};

export type AdjustmentCreatedItem = {
  rowNumber: number;
  id: string;
  clickId?: string | null;
  externalTransactionId?: string | null;
};

export type AdjustmentResult = {
  created: number;
  skipped: number;
  errors: Array<
    AdjustmentRowError & {
      rowNumber: number;
      details?: unknown;
    }
  >;
  createdItems: AdjustmentCreatedItem[];
};

export type AdjustmentPreviewResponse = {
  batch: AdjustmentBatch;
  rows: AdjustmentPreviewRow[];
  hiddenValidRows: number;
  ignoredColumns: string[];
};

export type AdjustmentDetailResponse = {
  batch: AdjustmentBatch;
  preview: {
    headers: string[];
    ignoredColumns: string[];
    hiddenValidRows: number;
    rows: AdjustmentPreviewRow[];
  } | null;
  result: AdjustmentResult | null;
};

export type AdjustmentBatchesResponse = {
  items: AdjustmentBatch[];
  page: number;
  limit: number;
  total: number;
};

export type AdjustmentPreviewPayload = {
  type: AdjustmentType;
  partnerMode: AdjustmentPartnerMode;
  affiliateId?: string | null;
  offerId?: string | null;
  goalId?: string | null;
  defaultStatus?: string | null;
  originalFilename?: string | null;
  csvText: string;
};

export async function previewAdjustments(
  token: string,
  payload: AdjustmentPreviewPayload,
) {
  return apiFetch<AdjustmentPreviewResponse>('/admin/adjustments/preview', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  });
}

export async function applyAdjustmentBatch(token: string, batchId: string) {
  return apiFetch<{
    batch: AdjustmentBatch;
    result: AdjustmentResult;
  }>(`/admin/adjustments/${batchId}/apply`, {
    method: 'POST',
    token,
  });
}

export async function listAdjustmentBatches(token: string) {
  return apiFetch<AdjustmentBatchesResponse>('/admin/adjustments/batches', {
    token,
  });
}

export async function getAdjustmentBatchDetail(token: string, batchId: string) {
  return apiFetch<AdjustmentDetailResponse>(
    `/admin/adjustments/batches/${batchId}`,
    {
      token,
    },
  );
}
