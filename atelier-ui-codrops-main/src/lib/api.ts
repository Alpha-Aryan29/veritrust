// VeriTrust Client API

export const getApiBase = (): string => {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== "undefined") {
    // During local UI development Next runs separately from Express.
    // The production export is served by Express itself, including on :3000.
    if (
      process.env.NODE_ENV === "development" &&
      window.location.port === "3000"
    ) {
      return "http://localhost:3001";
    }
    return "";
  }
  return "http://localhost:3001";
};

export const getPublicBase = (): string => {
  const apiBase = getApiBase();
  if (apiBase) return apiBase;
  if (typeof window !== "undefined") return window.location.origin;
  return "http://localhost:3001";
};

export interface Actor {
  key: string;
  label: string;
  address: string;
}

export interface Institution {
  id: string;
  name: string;
  admin: string;
  active: boolean;
  registeredAt: number;
  issuers: Actor[];
}

export interface NetworkStatus {
  contract: string;
  owner: string;
  block: number;
  records: number;
  revocations: number;
  activeIssuers: number;
  suspendedInstitutions: number;
  institutions: Institution[];
  actors: Actor[];
  chain?: { id: number; blockNumber: number };
}

export interface BlockTx {
  hash: string;
  from: string;
  to: string;
  method?: string;
  actor?: string;
  actorLabel?: string;
  status: number;
}

export interface BlockData {
  number: number;
  hash: string;
  timestamp: number;
  gasUsed: string;
  txCount: number;
  txs: BlockTx[];
}

export interface CredentialSubject {
  name: string;
  program: string;
  graduationYear: number;
  cgpa: number;
  [key: string]: unknown;
}

export interface VeriTrustCredential {
  "@context": string[];
  id: string;
  type: string[];
  issuer: string;
  issuanceDate: string;
  expirationDate?: string | null;
  credentialSubject: CredentialSubject;
  credentialSalt?: string;
  salt?: string;
  proof: {
    type: string;
    created: string;
    proofPurpose: string;
    verificationMethod: string;
    proofValue?: string;
    signatureValue?: string;
  };
}

export interface VerificationCheck {
  step: number;
  name: string;
  passed: boolean;
  detail: string;
  data?: unknown;
}

export interface VerificationVerdict {
  verdict:
    | "VALID"
    | "TAMPERED"
    | "REVOKED"
    | "EXPIRED"
    | "UNAUTHORIZED_ISSUER"
    | "NOT_ANCHORED"
    | "INSTITUTION_SUSPENDED"
    | "ISSUER_MISMATCH"
    | "MALFORMED";
  label: string;
  valid: boolean;
  reason: string;
  code: string;
  checks: VerificationCheck[];
  credential?: VeriTrustCredential;
  recordHash?: string;
  onChain?: {
    exists: boolean;
    institutionId: string;
    institutionName?: string | null;
    issuer: string;
    issuedAt: number;
    revoked: boolean;
    revokedAt: number;
    revokedBy: string;
    reason?: string | null;
  };
}

export interface IssueResponse {
  credential: VeriTrustCredential;
  recordHash: string;
  tx: {
    transactionHash: string;
    blockNumber: number;
    gasUsed: string;
  };
  issuedBy: string;
  anchored: boolean;
  qrDataUrl?: string;
}

export interface BatchItem {
  recordHash: string;
  credential: VeriTrustCredential;
}

export interface BatchIssueResponse {
  batchSize: number;
  tx: {
    transactionHash: string;
    blockNumber: number;
    gasUsed: string;
    gasPerRecord: number;
  };
  singleEquivGas: number;
  gasSavingsPercent: number;
  items: BatchItem[];
}

export interface AvalancheResult {
  flippedBits: number;
  totalBits: number;
  avalanchePercent: number;
  charDiff: Array<{
    char1: string;
    char2: string;
    diff: boolean;
  }>;
}

export interface TamperResponse {
  originalHash: string;
  tamperedHash: string;
  avalanche: AvalancheResult;
  tamperedCredential: VeriTrustCredential;
  verification: VerificationVerdict;
}

export interface AnalyticsData {
  verifications: {
    total: number;
    VALID: number;
    TAMPERED: number;
    UNAUTHORIZED_ISSUER: number;
    NOT_ANCHORED: number;
    REVOKED: number;
    EXPIRED: number;
    INSTITUTION_SUSPENDED: number;
    MALFORMED: number;
    ISSUER_MISMATCH: number;
  };
  gasHistory: {
    singleTxs: Array<{ gasUsed: string | number }>;
    batchTxs: Array<{
      gasUsed: string | number;
      batchSize: number;
      gasPerRecord: number;
    }>;
  };
  gas?: {
    singleGasAvg: number;
    batchGasAvg: number;
    savingsPercent: number;
    totalBatchTxs: number;
    totalSingleTxs: number;
  };
}

export interface ScenarioStep {
  name: string;
  passed: boolean;
  logs: string[];
}

export interface ScenarioSummary {
  scenarios: ScenarioStep[];
  allPassed: boolean;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const base = getApiBase();
  const url = `${base}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed with HTTP ${res.status}`);
  }
  return data as T;
}

interface RawTransaction {
  ok: boolean;
  txHash?: string;
  block?: number;
  gasUsed?: number;
  error?: string;
}

interface RawIssueResponse extends Omit<IssueResponse, "tx"> {
  tx: RawTransaction;
}

interface RawBatchIssueResponse {
  anchored: boolean;
  count: number;
  totalGas: number;
  gasPerRecord: number;
  savingsPercent: number;
  tx: RawTransaction;
  issuedBy: string;
  items: BatchItem[];
}

interface RawTamperResponse extends AvalancheResult {
  originalHash: string;
  mutatedHash: string;
  mutatedCredential: VeriTrustCredential;
  verification: VerificationVerdict;
}

interface RawScenarioResult {
  title: string;
  pass: boolean;
  expected: string;
  actual: string;
  detail: string;
}

interface RawScenarioSummary {
  passed: number;
  total: number;
  results: RawScenarioResult[];
}

export const api = {
  getStatus: () => request<NetworkStatus>("/api/status"),
  getBlocks: () => request<BlockData[]>("/api/blocks"),
  getReasons: () => request<string[]>("/api/reasons"),
  getAnalytics: async () => {
    const raw = await request<
      AnalyticsData & { gasHistory?: AnalyticsData["gasHistory"] }
    >("/api/analytics");
    return {
      ...raw,
      gasHistory: raw.gasHistory || { singleTxs: [], batchTxs: [] },
    } as AnalyticsData;
  },
  getAudit: () => request<unknown[]>("/api/audit"),
  getRecords: () => request<RecordListItem[]>("/api/records"),

  issue: async (data: {
    actor: string;
    subject: CredentialSubject;
    validDays?: number | null;
  }) => {
    const raw = await request<RawIssueResponse>("/api/issue", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return {
      ...raw,
      tx: {
        transactionHash: raw.tx.txHash || "",
        blockNumber: raw.tx.block || 0,
        gasUsed: String(raw.tx.gasUsed || 0),
      },
    } satisfies IssueResponse;
  },

  issueBatch: async (data: {
    actor: string;
    records: CredentialSubject[];
    type?: string;
    validDays?: number | null;
  }) => {
    const raw = await request<RawBatchIssueResponse>("/api/issue-batch", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return {
      batchSize: raw.count,
      tx: {
        transactionHash: raw.tx.txHash || "",
        blockNumber: raw.tx.block || 0,
        gasUsed: String(raw.totalGas || raw.tx.gasUsed || 0),
        gasPerRecord: raw.gasPerRecord || 0,
      },
      singleEquivGas: 98200 * raw.count,
      gasSavingsPercent: raw.savingsPercent,
      items: raw.items,
    } satisfies BatchIssueResponse;
  },

  verify: (data: { credential?: VeriTrustCredential; recordHash?: string }) =>
    request<VerificationVerdict>("/api/verify", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  tamper: async (data: {
    credential: VeriTrustCredential;
    modifications: Partial<CredentialSubject>;
  }) => {
    const raw = await request<RawTamperResponse>("/api/tamper", {
      method: "POST",
      body: JSON.stringify({
        credential: data.credential,
        mutations: data.modifications,
      }),
    });
    return {
      originalHash: raw.originalHash,
      tamperedHash: raw.mutatedHash,
      avalanche: {
        flippedBits: raw.flippedBits,
        totalBits: raw.totalBits,
        avalanchePercent: raw.avalanchePercent,
        charDiff: raw.charDiff,
      },
      tamperedCredential: raw.mutatedCredential,
      verification: raw.verification,
    } satisfies TamperResponse;
  },

  revoke: (data: {
    recordHash: string;
    actor: string;
    reason: number | string;
  }) =>
    request<{
      recordHash: string;
      tx: unknown;
      revokedBy: string;
      reason: string;
    }>("/api/revoke", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  runScenarios: async () => {
    const raw = await request<RawScenarioSummary>("/api/scenarios/run", {
      method: "POST",
    });
    return {
      allPassed: raw.passed === raw.total,
      scenarios: raw.results.map((result) => ({
        name: result.title,
        passed: result.pass,
        logs: [
          result.detail,
          `Expected: ${result.expected}`,
          `Observed: ${result.actual}`,
          `Result: ${result.pass ? "PASSED" : "FAILED"}`,
        ],
      })),
    } satisfies ScenarioSummary;
  },

  getQr: (dataUrl: string) =>
    request<{ dataUrl: string }>(`/api/qr?text=${encodeURIComponent(dataUrl)}`),
};

export interface RecordListItem {
  recordHash: string;
  name: string;
  program: string;
  issuedBy: string;
  actor: string;
  anchored: boolean;
  revoked: boolean;
  reason?: string | null;
  credential: VeriTrustCredential;
}

// Server-Sent Events Helper
export function connectEvents(
  onEvent: (event: string, data: unknown) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const base = getApiBase();
  const url = `${base}/api/events`;

  let es: EventSource | null = null;
  let active = true;

  const connect = () => {
    if (!active) return;
    try {
      es = new EventSource(url);
      es.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data);
          onEvent("message", parsed);
        } catch (_) {}
      };
      es.addEventListener("status", (e: MessageEvent) => {
        try {
          onEvent("status", JSON.parse(e.data));
        } catch (_) {}
      });
      es.addEventListener("record_issued", (e: MessageEvent) => {
        try {
          onEvent("record_issued", JSON.parse(e.data));
        } catch (_) {}
      });
      es.addEventListener("record_revoked", (e: MessageEvent) => {
        try {
          onEvent("record_revoked", JSON.parse(e.data));
        } catch (_) {}
      });
      es.addEventListener("block_mined", (e: MessageEvent) => {
        try {
          onEvent("block_mined", JSON.parse(e.data));
        } catch (_) {}
      });
      es.onerror = () => {
        es?.close();
        if (active) setTimeout(connect, 3000);
      };
    } catch (_) {
      if (active) setTimeout(connect, 3000);
    }
  };

  connect();

  return () => {
    active = false;
    es?.close();
  };
}
