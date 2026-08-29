import type { ChecklistResult } from "../types/commissioning";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const DEFAULT_SPREADSHEET_ID = import.meta.env
  .VITE_GOOGLE_SPREADSHEET_ID as string | undefined;

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const EMAIL_SCOPE = "https://www.googleapis.com/auth/userinfo.email";
const GOOGLE_SCOPE = [SHEETS_SCOPE, EMAIL_SCOPE].join(" ");

const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

const CXTOOLS_REQUIRED_SHEETS:
  RequiredSheetDefinition[] = [
  {
    title:
      "RegionAssignments",

    headers: [
      "Floor",
      "RegionId",
      "RegionLabel",
      "SpaceId",
      "RoomNo",
      "SpaceType",
      "UpdatedBy",
      "UpdatedAt",
      "Revision",
    ],
  },

  {
    title:
      "Comments",

    headers: [
      "CommentId",
      "Floor",
      "RegionId",
      "SpaceId",
      "RoomNo",
      "Comment",
      "CreatedBy",
      "CreatedAt",
      "Category",
    ],
  },

  {
    title:
      "ChecklistResults",

    headers: [
      "Floor",
      "SpaceId",
      "ChecklistItemId",
      "DeviceType",
      "ExpectedQty",
      "ObservedQty",
      "Result",
      "Notes",
      "UpdatedBy",
      "UpdatedAt",
      "Revision",
    ],
  },

  {
    title:
      "TestResults",

    headers: [
      "Floor",
      "SpaceId",
      "ChecklistItemId",
      "TestId",
      "DeviceType",
      "TestLabel",
      "Result",
      "Notes",
      "UpdatedBy",
      "UpdatedAt",
      "Revision",
    ],
  },

  {
    title:
      "Issues",

    headers: [
      "IssueId",
      "Floor",
      "RegionId",
      "SpaceId",
      "RoomNo",
      "ChecklistItemId",
      "IssueDescription",
      "Status",
      "CreatedBy",
      "CreatedAt",
      "ResolvedBy",
      "ResolvedAt",
    ],
  },

  {
    title:
      "PanelTestResults",

    headers: [
      "Floor",
      "SpaceId",
      "RoomNo",
      "RegionId",
      "Panelboard",
      "CircuitId",
      "CircuitNo",
      "LoadDescription",
      "Result",
      "Notes",
      "UpdatedBy",
      "UpdatedAt",
      "Revision",
    ],
  },

  {
    title:
      "PanelIssues",

    headers: [
      "IssueId",
      "Floor",
      "SpaceId",
      "RoomNo",
      "RegionId",
      "Panelboard",
      "CircuitId",
      "CircuitNo",
      "IssueDescription",
      "Status",
      "CreatedBy",
      "CreatedAt",
      "ResolvedBy",
      "ResolvedAt",
    ],
  },

  {
    title:
      "ActivityLog",

    headers: [
      "EventId",
      "EventType",
      "Floor",
      "RegionId",
      "SpaceId",
      "User",
      "CreatedAt",
      "Payload",
    ],
  },
];

let tokenClient: GoogleTokenClient | null = null;
let accessToken: string | null = null;
let tokenExpiresAt = 0;

export interface GoogleUser {
  email: string;
  name?: string;
  picture?: string;
}

export class GoogleAuthorizationCancelledError extends Error {
  constructor() {
    super("Google Sheets connection was cancelled.");
    this.name = "GoogleAuthorizationCancelledError";
  }
}

export interface SheetAssignment {
  floor: string;
  regionId: string;
  regionLabel: string;
  spaceId: string | null;
  roomNo: string;
  spaceType: string;
  updatedBy: string;
  updatedAt: string;
  revision: number;
}

export interface SheetComment {
  commentId: string;
  floor: string;
  regionId: string;
  spaceId: string;
  roomNo: string;
  comment: string;
  createdBy: string;
  createdAt: string;
  category: string;
}

export interface SheetChecklistResult {
  floor: string;
  spaceId: string;
  checklistItemId: string;
  deviceType: string;
  expectedQty: number | null;
  observedQty: number | null;
  result: ChecklistResult;
  notes: string;
  updatedBy: string;
  updatedAt: string;
  revision: number;
}

export interface SheetTestResult {
  floor: string;
  spaceId: string;
  checklistItemId: string;
  testId: string;
  deviceType: string;
  testLabel: string;
  result: ChecklistResult;
  notes: string;
  updatedBy: string;
  updatedAt: string;
  revision: number;
}

export interface SheetPanelTestResult {
  floor: string;
  spaceId: string;
  roomNo: string;
  regionId: string;
  panelboard: string;
  circuitId: string;
  circuitNo: string;
  loadDescription: string;
  result: ChecklistResult;
  notes: string;
  updatedBy: string;
  updatedAt: string;
  revision: number;
}

export interface SheetPanelIssue {
  issueId: string;
  floor: string;
  spaceId: string;
  roomNo: string;
  regionId: string;
  panelboard: string;
  circuitId: string;
  circuitNo: string;
  issueDescription: string;
  status: IssueStatus;
  createdBy: string;
  createdAt: string;
  resolvedBy: string;
  resolvedAt: string;
}

export type IssueStatus = "open" | "resolved";

export interface SheetIssue {
  issueId: string;
  floor: string;
  regionId: string;
  spaceId: string;
  roomNo: string;
  checklistItemId: string;
  issueDescription: string;
  status: IssueStatus;
  createdBy: string;
  createdAt: string;
  resolvedBy: string;
  resolvedAt: string;
}

export interface CommissioningRepository {
  loadAssignments(
    floor: string,
  ): Promise<Record<string, string | null>>;

  upsertAssignment(
    assignment: Omit<SheetAssignment, "updatedAt" | "revision">,
  ): Promise<SheetAssignment>;

  loadComments(
    floor: string,
    regionId: string,
  ): Promise<SheetComment[]>;

  addComment(
    comment: Omit<SheetComment, "commentId" | "createdAt">,
  ): Promise<SheetComment>;

  loadFloorChecklistResults(
    floor: string,
  ): Promise<SheetChecklistResult[]>;

  loadFloorTestResults(
    floor: string,
  ): Promise<SheetTestResult[]>;

  saveChecklistResults(
    inputResults: Array<
      Omit<SheetChecklistResult, "updatedAt" | "revision">
    >,
  ): Promise<SheetChecklistResult[]>;

  saveTestResults(
    inputResults: Array<
      Omit<SheetTestResult, "updatedAt" | "revision">
    >,
  ): Promise<SheetTestResult[]>;

  loadFloorIssues(
    floor: string,
  ): Promise<SheetIssue[]>;

  createIssue(
    issue: Omit<
      SheetIssue,
      "issueId" | "status" | "createdAt" | "resolvedBy" | "resolvedAt"
    >,
  ): Promise<SheetIssue>;

  resolveIssue(
    issueId: string,
    resolvedBy: string,
  ): Promise<SheetIssue>;

  loadFloorPanelTestResults(
    floor: string,
  ): Promise<SheetPanelTestResult[]>;

  savePanelTestResults(
    inputResults: Array<
      Omit<
        SheetPanelTestResult,
        "updatedAt" | "revision"
      >
    >,
  ): Promise<SheetPanelTestResult[]>;

  loadFloorPanelIssues(
    floor: string,
  ): Promise<SheetPanelIssue[]>;

  createPanelIssue(
    issue: Omit<
      SheetPanelIssue,
      | "issueId"
      | "status"
      | "createdAt"
      | "resolvedBy"
      | "resolvedAt"
    >,
  ): Promise<SheetPanelIssue>;

  resolvePanelIssue(
    issueId: string,
    resolvedBy: string,
  ): Promise<SheetPanelIssue>;
}

export interface GoogleSheetSetupIssue {
  sheet: string;
  message: string;
}

export interface GoogleSheetSetupResult {
  spreadsheetId: string;
  spreadsheetTitle: string;
  requiredSheetCount: number;
  createdSheets: string[];
  readySheets: string[];
  issues: GoogleSheetSetupIssue[];
}

interface ValueRangeResponse {
  range?: string;
  majorDimension?: string;
  values?: Array<Array<string | number | boolean>>;
}

interface BatchUpdateData {
  range: string;
  values: Array<Array<string | number | boolean>>;
}

interface RequiredSheetDefinition {
  title: string;
  headers: string[];
}

interface SpreadsheetMetadata {
  properties?: {
    title?: string;
  };

  sheets?: Array<{
    properties?: {
      sheetId?: number;
      title?: string;
    };
  }>;
}

function requireClientId(): string {
  if (!CLIENT_ID) {
    throw new Error(
      "Google Sheets authorization is not configured. Add VITE_GOOGLE_CLIENT_ID to your .env.local file.",
    );
  }

  return CLIENT_ID;
}

function resolveSpreadsheetId(spreadsheetId?: string): string {
  const resolvedId =
    spreadsheetId?.trim() || DEFAULT_SPREADSHEET_ID?.trim();

  if (!resolvedId) {
    throw new Error(
      "No Google spreadsheet is configured for this project.",
    );
  }

  return resolvedId;
}

async function waitForGoogleIdentity(timeoutMs = 10_000): Promise<void> {
  const startedAt = Date.now();

  while (!window.google?.accounts?.oauth2) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(
        "Google Identity Services did not load. Check the script tag in index.html and your internet connection.",
      );
    }

    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }
}

export async function initializeGoogleSheets(): Promise<void> {
  requireClientId();
  await waitForGoogleIdentity();
}

export function isGoogleSheetsConnected(): boolean {
  return Boolean(accessToken && Date.now() < tokenExpiresAt - 30_000);
}

export async function connectGoogleSheets(): Promise<GoogleUser> {
  const clientId = requireClientId();
  await waitForGoogleIdentity();

  return new Promise<GoogleUser>((resolve, reject) => {
    let settled = false;

    function resolveOnce(user: GoogleUser): void {
      if (settled) {
        return;
      }

      settled = true;
      resolve(user);
    }

    function rejectOnce(error: unknown): void {
      if (settled) {
        return;
      }

      settled = true;
      reject(error);
    }

    tokenClient = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_SCOPE,

      callback: async (response) => {
        if (response.error || !response.access_token) {
          rejectOnce(
            new Error(
              response.error_description ??
                response.error ??
                "Google authorization was not completed.",
            ),
          );
          return;
        }

        const hasRequiredScopes =
          window.google?.accounts.oauth2.hasGrantedAllScopes(
            response,
            SHEETS_SCOPE,
            EMAIL_SCOPE,
          ) ?? false;

        if (!hasRequiredScopes) {
          window.google?.accounts.oauth2.revoke(
            response.access_token,
            () => undefined,
          );

          rejectOnce(
            new Error(
              "Google Sheets permission was not granted. Reconnect and approve spreadsheet access.",
            ),
          );
          return;
        }

        accessToken = response.access_token;
        tokenExpiresAt =
          Date.now() +
          Math.max(
            0,
            Number(response.expires_in ?? 3600),
          ) *
            1000;

        try {
          const user = await fetchGoogleUser();
          resolveOnce(user);
        } catch (error) {
          disconnectGoogleSheets();
          rejectOnce(error);
        }
      },

      error_callback: (error) => {
        if (error.type === "popup_closed") {
          rejectOnce(
            new GoogleAuthorizationCancelledError(),
          );
          return;
        }

        if (error.type === "popup_failed_to_open") {
          rejectOnce(
            new Error(
              "The Google authorization window could not be opened. Check whether your browser blocked the popup.",
            ),
          );
          return;
        }

        rejectOnce(
          new Error(
            error.message ??
              "Google authorization could not be completed.",
          ),
        );
      },
    });

    try {
      tokenClient.requestAccessToken({
        prompt: "consent",
      });
    } catch (error) {
      rejectOnce(error);
    }
  });
}

export function disconnectGoogleSheets(): void {
  const tokenToRevoke = accessToken;
  accessToken = null;
  tokenExpiresAt = 0;

  if (tokenToRevoke && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(tokenToRevoke, () => undefined);
  }
}

function requireAccessToken(): string {
  if (!isGoogleSheetsConnected() || !accessToken) {
    accessToken = null;
    tokenExpiresAt = 0;
    throw new Error(
      "Your Google Sheets session is not connected or has expired. Reconnect Google Sheets and try again.",
    );
  }

  return accessToken;
}

async function authenticatedFetch<T>(
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const token = requireAccessToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");

  const response = await fetch(url, {
    ...init,
    headers,
  });

  if (response.status === 401) {
    accessToken = null;
    tokenExpiresAt = 0;
  }

  if (!response.ok) {
    let message = `Google Sheets request failed (${response.status}).`;

    try {
      const payload = (await response.json()) as {
        error?: { message?: string };
      };
      message = payload.error?.message ?? message;
    } catch {
      // Keep the default message when the response is not JSON.
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function fetchGoogleUser(): Promise<GoogleUser> {
  const token = requireAccessToken();
  const response = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error("The signed-in Google account could not be identified.");
  }

  const user = (await response.json()) as Partial<GoogleUser>;

  if (!user.email) {
    throw new Error("Google did not return an email address for this account.");
  }

  return {
    email: user.email,
    name: user.name,
    picture: user.picture,
  };
}

function rangeUrl(
  range: string,
  spreadsheetId?: string,
): string {
  const resolvedSpreadsheetId =
    resolveSpreadsheetId(spreadsheetId);

  return `${SHEETS_API_BASE}/${resolvedSpreadsheetId}/values/${encodeURIComponent(range)}`;
}

async function getValues(
  range: string,
  spreadsheetId?: string,
): Promise<ValueRangeResponse> {
  return authenticatedFetch<ValueRangeResponse>(
    rangeUrl(range, spreadsheetId),
  );
}

async function updateValues(
  range: string,
  values: Array<Array<string | number | boolean>>,
  spreadsheetId?: string,
): Promise<void> {
  await authenticatedFetch(
    `${rangeUrl(range, spreadsheetId)}?valueInputOption=RAW`,
    {
      method: "PUT",
      body: JSON.stringify({ values }),
    },
  );
}

async function batchUpdateValues(
  data: BatchUpdateData[],
  spreadsheetId?: string,
): Promise<void> {
  if (data.length === 0) {
    return;
  }

  const resolvedSpreadsheetId =
    resolveSpreadsheetId(spreadsheetId);

  await authenticatedFetch(
    `${SHEETS_API_BASE}/${resolvedSpreadsheetId}/values:batchUpdate`,
    {
      method: "POST",
      body: JSON.stringify({
        valueInputOption: "RAW",
        data,
      }),
    },
  );
}

async function appendValues(
  range: string,
  values: Array<Array<string | number | boolean>>,
  spreadsheetId?: string,
): Promise<void> {
  if (values.length === 0) {
    return;
  }

  await authenticatedFetch(
    `${rangeUrl(range, spreadsheetId)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      body: JSON.stringify({ values }),
    },
  );
}

function stringValue(value: unknown): string {
  return value === undefined || value === null ? "" : String(value);
}

function nullableNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function checklistResultValue(value: unknown): ChecklistResult {
  const result = stringValue(value);

  if (
    result === "pass" ||
    result === "issue" ||
    result === "not_applicable"
  ) {
    return result;
  }

  return "not_checked";
}

function columnLetter(
  columnCount: number,
): string {
  let value =
    columnCount;

  let result = "";

  while (value > 0) {
    const remainder =
      (value - 1) % 26;

    result =
      String.fromCharCode(
        65 + remainder,
      ) + result;

    value =
      Math.floor(
        (value - 1) / 26,
      );
  }

  return result;
}

export async function loadAssignments(
  floor: string,
  spreadsheetId?: string,
): Promise<
  Record<string, string | null>
> {
  const response =
    await getValues(
      "RegionAssignments!A2:I",
      spreadsheetId,
    );

  const assignments:
    Record<string, string | null> = {};

  for (
    const row of
    response.values ?? []
  ) {
    if (
      stringValue(row[0]) !== floor
    ) {
      continue;
    }

    const regionId =
      stringValue(row[1]);

    if (!regionId) {
      continue;
    }

    const storedSpaceId =
      stringValue(row[3]);

    /*
     * Old blank rows should NOT wipe out
     * assignments prepared in the JSON.
     */
    if (!storedSpaceId) {
      continue;
    }

    /*
     * Explicit user-requested clear.
     */
    assignments[regionId] =
      storedSpaceId ===
      "__CLEARED__"
        ? null
        : storedSpaceId;
  }

  return assignments;
}

export async function upsertAssignment(
  assignment: Omit<SheetAssignment, "updatedAt" | "revision">,
  spreadsheetId?: string,
): Promise<SheetAssignment> {
  const response = await getValues(
    "RegionAssignments!A2:I",
    spreadsheetId,
  );
  const rows = response.values ?? [];
  const existingIndex = rows.findIndex(
    (row) =>
      stringValue(row[0]) === assignment.floor &&
      stringValue(row[1]) === assignment.regionId,
  );

  const existingRevision =
    existingIndex >= 0 ? numberValue(rows[existingIndex][8]) : 0;

  const savedAssignment: SheetAssignment = {
    ...assignment,
    updatedAt: new Date().toISOString(),
    revision: existingRevision + 1,
  };

  const rowValues: Array<string | number> = [
    savedAssignment.floor,
    savedAssignment.regionId,
    savedAssignment.regionLabel,
    savedAssignment.spaceId ?? "__CLEARED__",
    savedAssignment.roomNo,
    savedAssignment.spaceType,
    savedAssignment.updatedBy,
    savedAssignment.updatedAt,
    savedAssignment.revision,
  ];

  if (existingIndex >= 0) {
    const sheetRow = existingIndex + 2;
    await updateValues(
      `RegionAssignments!A${sheetRow}:I${sheetRow}`,
      [rowValues],
      spreadsheetId,
    );
  } else {
    await appendValues(
      "RegionAssignments!A:I",
      [rowValues],
      spreadsheetId,
    );
  }

  await appendActivity(
    {
      eventType: savedAssignment.spaceId
        ? "assignment_saved"
        : "assignment_cleared",
      floor: savedAssignment.floor,
      regionId: savedAssignment.regionId,
      spaceId: savedAssignment.spaceId ?? "",
      user: savedAssignment.updatedBy,
      payload: savedAssignment,
    },
    spreadsheetId,
  );

  return savedAssignment;
}

export async function loadComments(
  floor: string,
  regionId: string,
  spreadsheetId?: string,
): Promise<SheetComment[]> {
  const response = await getValues(
    "Comments!A2:I",
    spreadsheetId,
  );

  return (response.values ?? [])
    .filter(
      (row) =>
        stringValue(row[1]) === floor &&
        stringValue(row[2]) === regionId,
    )
    .map((row) => ({
      commentId: stringValue(row[0]),
      floor: stringValue(row[1]),
      regionId: stringValue(row[2]),
      spaceId: stringValue(row[3]),
      roomNo: stringValue(row[4]),
      comment: stringValue(row[5]),
      createdBy: stringValue(row[6]),
      createdAt: stringValue(row[7]),
      category: stringValue(row[8]) || "General",
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function addComment(
  comment: Omit<SheetComment, "commentId" | "createdAt">,
  spreadsheetId?: string,
): Promise<SheetComment> {
  const savedComment: SheetComment = {
    ...comment,
    commentId:
      globalThis.crypto?.randomUUID?.() ??
      `comment-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    createdAt: new Date().toISOString(),
  };

  await appendValues(
    "Comments!A:I",
    [
      [
        savedComment.commentId,
        savedComment.floor,
        savedComment.regionId,
        savedComment.spaceId,
        savedComment.roomNo,
        savedComment.comment,
        savedComment.createdBy,
        savedComment.createdAt,
        savedComment.category,
      ],
    ],
    spreadsheetId,
  );

  await appendActivity(
    {
      eventType: "comment_added",
      floor: savedComment.floor,
      regionId: savedComment.regionId,
      spaceId: savedComment.spaceId,
      user: savedComment.createdBy,
      payload: savedComment,
    },
    spreadsheetId,
  );

  return savedComment;
}

export async function loadFloorChecklistResults(
  floor: string,
  spreadsheetId?: string,
): Promise<SheetChecklistResult[]> {
  const response = await getValues(
    "ChecklistResults!A2:K",
    spreadsheetId,
  );

  return (response.values ?? [])
    .filter((row) => stringValue(row[0]) === floor)
    .map((row) => ({
      floor: stringValue(row[0]),
      spaceId: stringValue(row[1]),
      checklistItemId: stringValue(row[2]),
      deviceType: stringValue(row[3]),
      expectedQty: nullableNumber(row[4]),
      observedQty: nullableNumber(row[5]),
      result: checklistResultValue(row[6]),
      notes: stringValue(row[7]),
      updatedBy: stringValue(row[8]),
      updatedAt: stringValue(row[9]),
      revision: numberValue(row[10]),
    }));
}

export async function loadFloorTestResults(
  floor: string,
  spreadsheetId?: string,
): Promise<SheetTestResult[]> {
  const response = await getValues(
    "TestResults!A2:K",
    spreadsheetId,
  );

  return (response.values ?? [])
    .filter((row) => stringValue(row[0]) === floor)
    .map((row) => ({
      floor: stringValue(row[0]),
      spaceId: stringValue(row[1]),
      checklistItemId: stringValue(row[2]),
      testId: stringValue(row[3]),
      deviceType: stringValue(row[4]),
      testLabel: stringValue(row[5]),
      result: checklistResultValue(row[6]),
      notes: stringValue(row[7]),
      updatedBy: stringValue(row[8]),
      updatedAt: stringValue(row[9]),
      revision: numberValue(row[10]),
    }));
}

export async function loadFloorPanelTestResults(
  floor: string,
  spreadsheetId?: string,
): Promise<SheetPanelTestResult[]> {
  const response = await getValues(
    "PanelTestResults!A2:M",
    spreadsheetId,
  );

  return (response.values ?? [])
    .filter(
      (row) =>
        stringValue(row[0]) === floor,
    )
    .map((row) => ({
      floor: stringValue(row[0]),

      spaceId: stringValue(row[1]),
      roomNo: stringValue(row[2]),
      regionId: stringValue(row[3]),

      panelboard: stringValue(row[4]),

      circuitId: stringValue(row[5]),
      circuitNo: stringValue(row[6]),
      loadDescription:
        stringValue(row[7]),

      result:
        checklistResultValue(row[8]),

      notes: stringValue(row[9]),

      updatedBy:
        stringValue(row[10]),

      updatedAt:
        stringValue(row[11]),

      revision:
        numberValue(row[12]),
    }));
}

export async function savePanelTestResults(
  inputResults: Array<
    Omit<
      SheetPanelTestResult,
      "updatedAt" | "revision"
    >
  >,
  spreadsheetId?: string,
): Promise<SheetPanelTestResult[]> {
  if (inputResults.length === 0) {
    return [];
  }

  const response = await getValues(
    "PanelTestResults!A2:M",
    spreadsheetId,
  );

  const rows =
    response.values ?? [];

  const now =
    new Date().toISOString();

  const updates:
    BatchUpdateData[] = [];

  const appends:
    Array<
      Array<
        string | number | boolean
      >
    > = [];

  const savedResults:
    SheetPanelTestResult[] = [];

  for (const input of inputResults) {
    /*
     * One result per:
     *
     * floor + sampled space + circuit
     */
    const existingIndex =
      rows.findIndex(
        (row) =>
          stringValue(row[0]) ===
            input.floor &&
          stringValue(row[1]) ===
            input.spaceId &&
          stringValue(row[5]) ===
            input.circuitId,
      );

    const saved:
      SheetPanelTestResult = {
      ...input,

      updatedAt: now,

      revision:
        existingIndex >= 0
          ? numberValue(
              rows[existingIndex][12],
            ) + 1
          : 1,
    };

    const values:
      Array<
        string | number | boolean
      > = [
      saved.floor,

      saved.spaceId,
      saved.roomNo,
      saved.regionId,

      saved.panelboard,

      saved.circuitId,
      saved.circuitNo,
      saved.loadDescription,

      saved.result,
      saved.notes,

      saved.updatedBy,
      saved.updatedAt,

      saved.revision,
    ];

    if (existingIndex >= 0) {
      const sheetRow =
        existingIndex + 2;

      updates.push({
        range:
          `PanelTestResults!A${sheetRow}:M${sheetRow}`,

        values: [values],
      });
    } else {
      appends.push(values);
    }

    savedResults.push(saved);
  }

  await batchUpdateValues(
    updates,
    spreadsheetId,
  );

  await appendValues(
    "PanelTestResults!A:M",
    appends,
    spreadsheetId,
  );

  const firstResult =
    savedResults[0];

  await appendActivity(
    {
      eventType:
        "panel_testing_saved",

      floor:
        firstResult.floor,

      regionId:
        firstResult.regionId,

      spaceId:
        firstResult.spaceId,

      user:
        firstResult.updatedBy,

      payload:
        savedResults,
    },
    spreadsheetId,
  );

  return savedResults;
}

export async function saveChecklistResults(
  inputResults: Array<
    Omit<SheetChecklistResult, "updatedAt" | "revision">
  >,
  spreadsheetId?: string,
): Promise<SheetChecklistResult[]> {
  if (inputResults.length === 0) {
    return [];
  }

  const response = await getValues(
    "ChecklistResults!A2:K",
    spreadsheetId,
  );
  const rows = response.values ?? [];
  const now = new Date().toISOString();
  const updates: BatchUpdateData[] = [];
  const appends: Array<Array<string | number | boolean>> = [];
  const savedResults: SheetChecklistResult[] = [];

  for (const input of inputResults) {
    const existingIndex = rows.findIndex(
      (row) =>
        stringValue(row[0]) === input.floor &&
        stringValue(row[1]) === input.spaceId &&
        stringValue(row[2]) === input.checklistItemId,
    );

    const saved: SheetChecklistResult = {
      ...input,
      updatedAt: now,
      revision:
        existingIndex >= 0 ? numberValue(rows[existingIndex][10]) + 1 : 1,
    };

    const values: Array<string | number | boolean> = [
      saved.floor,
      saved.spaceId,
      saved.checklistItemId,
      saved.deviceType,
      saved.expectedQty ?? "",
      saved.observedQty ?? "",
      saved.result,
      saved.notes,
      saved.updatedBy,
      saved.updatedAt,
      saved.revision,
    ];

    if (existingIndex >= 0) {
      const sheetRow = existingIndex + 2;
      updates.push({
        range: `ChecklistResults!A${sheetRow}:K${sheetRow}`,
        values: [values],
      });
    } else {
      appends.push(values);
    }

    savedResults.push(saved);
  }

  await batchUpdateValues(updates, spreadsheetId);
  await appendValues(
    "ChecklistResults!A:K",
    appends,
    spreadsheetId,
  );

  const firstResult = savedResults[0];
  await appendActivity(
    {
      eventType: "inspection_saved",
      floor: firstResult.floor,
      regionId: "",
      spaceId: firstResult.spaceId,
      user: firstResult.updatedBy,
      payload: savedResults,
    },
    spreadsheetId,
  );

  return savedResults;
}

export async function saveTestResults(
  inputResults: Array<
    Omit<SheetTestResult, "updatedAt" | "revision">
  >,
  spreadsheetId?: string,
): Promise<SheetTestResult[]> {
  if (inputResults.length === 0) {
    return [];
  }

  const response = await getValues(
    "TestResults!A2:K",
    spreadsheetId,
  );
  const rows = response.values ?? [];
  const now = new Date().toISOString();

  const updates: BatchUpdateData[] = [];
  const appends: Array<Array<string | number | boolean>> = [];
  const savedResults: SheetTestResult[] = [];

  for (const input of inputResults) {
    const existingIndex = rows.findIndex(
      (row) =>
        stringValue(row[0]) === input.floor &&
        stringValue(row[1]) === input.spaceId &&
        stringValue(row[2]) === input.checklistItemId &&
        stringValue(row[3]) === input.testId,
    );

    const saved: SheetTestResult = {
      ...input,
      updatedAt: now,
      revision:
        existingIndex >= 0
          ? numberValue(rows[existingIndex][10]) + 1
          : 1,
    };

    const values: Array<string | number | boolean> = [
      saved.floor,
      saved.spaceId,
      saved.checklistItemId,
      saved.testId,
      saved.deviceType,
      saved.testLabel,
      saved.result,
      saved.notes,
      saved.updatedBy,
      saved.updatedAt,
      saved.revision,
    ];

    if (existingIndex >= 0) {
      const sheetRow = existingIndex + 2;

      updates.push({
        range: `TestResults!A${sheetRow}:K${sheetRow}`,
        values: [values],
      });
    } else {
      appends.push(values);
    }

    savedResults.push(saved);
  }

  await batchUpdateValues(updates, spreadsheetId);
  await appendValues(
    "TestResults!A:K",
    appends,
    spreadsheetId,
  );

  const firstResult = savedResults[0];

  await appendActivity(
    {
      eventType: "testing_saved",
      floor: firstResult.floor,
      regionId: "",
      spaceId: firstResult.spaceId,
      user: firstResult.updatedBy,
      payload: savedResults,
    },
    spreadsheetId,
  );

  return savedResults;
}

export async function loadFloorIssues(
  floor: string,
  spreadsheetId?: string,
): Promise<SheetIssue[]> {
  const response = await getValues(
    "Issues!A2:L",
    spreadsheetId,
  );

  return (response.values ?? [])
    .filter((row) => stringValue(row[1]) === floor)
    .map((row) => ({
      issueId: stringValue(row[0]),
      floor: stringValue(row[1]),
      regionId: stringValue(row[2]),
      spaceId: stringValue(row[3]),
      roomNo: stringValue(row[4]),
      checklistItemId: stringValue(row[5]),
      issueDescription: stringValue(row[6]),
      status: stringValue(row[7]) === "resolved" ? "resolved" : "open",
      createdBy: stringValue(row[8]),
      createdAt: stringValue(row[9]),
      resolvedBy: stringValue(row[10]),
      resolvedAt: stringValue(row[11]),
    }));
}

export async function loadFloorPanelIssues(
  floor: string,
  spreadsheetId?: string,
): Promise<SheetPanelIssue[]> {
  const response = await getValues(
    "PanelIssues!A2:N",
    spreadsheetId,
  );

  return (response.values ?? [])
    .filter(
      (row) =>
        stringValue(row[1]) === floor,
    )
    .map((row) => ({
      issueId:
        stringValue(row[0]),

      floor:
        stringValue(row[1]),

      spaceId:
        stringValue(row[2]),

      roomNo:
        stringValue(row[3]),

      regionId:
        stringValue(row[4]),

      panelboard:
        stringValue(row[5]),

      circuitId:
        stringValue(row[6]),

      circuitNo:
        stringValue(row[7]),

      issueDescription:
        stringValue(row[8]),

      status:
        stringValue(row[9]) ===
        "resolved"
          ? "resolved"
          : "open",

      createdBy:
        stringValue(row[10]),

      createdAt:
        stringValue(row[11]),

      resolvedBy:
        stringValue(row[12]),

      resolvedAt:
        stringValue(row[13]),
    }));
}

export async function createIssue(
  issue: Omit<
    SheetIssue,
    "issueId" | "status" | "createdAt" | "resolvedBy" | "resolvedAt"
  >,
  spreadsheetId?: string,
): Promise<SheetIssue> {
  const savedIssue: SheetIssue = {
    ...issue,
    issueId:
      globalThis.crypto?.randomUUID?.() ??
      `issue-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    status: "open",
    createdAt: new Date().toISOString(),
    resolvedBy: "",
    resolvedAt: "",
  };

  await appendValues(
    "Issues!A:L",
    [
      [
        savedIssue.issueId,
        savedIssue.floor,
        savedIssue.regionId,
        savedIssue.spaceId,
        savedIssue.roomNo,
        savedIssue.checklistItemId,
        savedIssue.issueDescription,
        savedIssue.status,
        savedIssue.createdBy,
        savedIssue.createdAt,
        savedIssue.resolvedBy,
        savedIssue.resolvedAt,
      ],
    ],
    spreadsheetId,
  );

  await appendActivity(
    {
      eventType: "issue_created",
      floor: savedIssue.floor,
      regionId: savedIssue.regionId,
      spaceId: savedIssue.spaceId,
      user: savedIssue.createdBy,
      payload: savedIssue,
    },
    spreadsheetId,
  );

  return savedIssue;
}

export async function createPanelIssue(
  issue: Omit<
    SheetPanelIssue,
    | "issueId"
    | "status"
    | "createdAt"
    | "resolvedBy"
    | "resolvedAt"
  >,
  spreadsheetId?: string,
): Promise<SheetPanelIssue> {
  const savedIssue:
    SheetPanelIssue = {
    ...issue,

    issueId:
      globalThis.crypto
        ?.randomUUID?.() ??
      `panel-issue-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 10)}`,

    status: "open",

    createdAt:
      new Date().toISOString(),

    resolvedBy: "",
    resolvedAt: "",
  };

  await appendValues(
    "PanelIssues!A:N",
    [
      [
        savedIssue.issueId,

        savedIssue.floor,

        savedIssue.spaceId,
        savedIssue.roomNo,
        savedIssue.regionId,

        savedIssue.panelboard,

        savedIssue.circuitId,
        savedIssue.circuitNo,

        savedIssue.issueDescription,

        savedIssue.status,

        savedIssue.createdBy,
        savedIssue.createdAt,

        savedIssue.resolvedBy,
        savedIssue.resolvedAt,
      ],
    ],
    spreadsheetId,
  );

  await appendActivity(
    {
      eventType:
        "panel_issue_created",

      floor:
        savedIssue.floor,

      regionId:
        savedIssue.regionId,

      spaceId:
        savedIssue.spaceId,

      user:
        savedIssue.createdBy,

      payload:
        savedIssue,
    },
    spreadsheetId,
  );

  return savedIssue;
}

export async function resolveIssue(
  issueId: string,
  resolvedBy: string,
  spreadsheetId?: string,
): Promise<SheetIssue> {
  const response = await getValues(
    "Issues!A2:L",
    spreadsheetId,
  );
  const rows = response.values ?? [];
  const existingIndex = rows.findIndex(
    (row) => stringValue(row[0]) === issueId,
  );

  if (existingIndex < 0) {
    throw new Error("The selected issue could not be found in Google Sheets.");
  }

  const row = rows[existingIndex];
  const resolvedIssue: SheetIssue = {
    issueId: stringValue(row[0]),
    floor: stringValue(row[1]),
    regionId: stringValue(row[2]),
    spaceId: stringValue(row[3]),
    roomNo: stringValue(row[4]),
    checklistItemId: stringValue(row[5]),
    issueDescription: stringValue(row[6]),
    status: "resolved",
    createdBy: stringValue(row[8]),
    createdAt: stringValue(row[9]),
    resolvedBy,
    resolvedAt: new Date().toISOString(),
  };

  const sheetRow = existingIndex + 2;
  await updateValues(
    `Issues!A${sheetRow}:L${sheetRow}`,
    [
      [
        resolvedIssue.issueId,
        resolvedIssue.floor,
        resolvedIssue.regionId,
        resolvedIssue.spaceId,
        resolvedIssue.roomNo,
        resolvedIssue.checklistItemId,
        resolvedIssue.issueDescription,
        resolvedIssue.status,
        resolvedIssue.createdBy,
        resolvedIssue.createdAt,
        resolvedIssue.resolvedBy,
        resolvedIssue.resolvedAt,
      ],
    ],
    spreadsheetId,
  );

  await appendActivity(
    {
      eventType: "issue_resolved",
      floor: resolvedIssue.floor,
      regionId: resolvedIssue.regionId,
      spaceId: resolvedIssue.spaceId,
      user: resolvedBy,
      payload: resolvedIssue,
    },
    spreadsheetId,
  );

  return resolvedIssue;
}

export async function resolvePanelIssue(
  issueId: string,
  resolvedBy: string,
  spreadsheetId?: string,
): Promise<SheetPanelIssue> {
  const response = await getValues(
    "PanelIssues!A2:N",
    spreadsheetId,
  );

  const rows =
    response.values ?? [];

  const existingIndex =
    rows.findIndex(
      (row) =>
        stringValue(row[0]) ===
        issueId,
    );

  if (existingIndex < 0) {
    throw new Error(
      "The selected panel issue could not be found in Google Sheets.",
    );
  }

  const row =
    rows[existingIndex];

  const resolvedIssue:
    SheetPanelIssue = {
    issueId:
      stringValue(row[0]),

    floor:
      stringValue(row[1]),

    spaceId:
      stringValue(row[2]),

    roomNo:
      stringValue(row[3]),

    regionId:
      stringValue(row[4]),

    panelboard:
      stringValue(row[5]),

    circuitId:
      stringValue(row[6]),

    circuitNo:
      stringValue(row[7]),

    issueDescription:
      stringValue(row[8]),

    status: "resolved",

    createdBy:
      stringValue(row[10]),

    createdAt:
      stringValue(row[11]),

    resolvedBy,

    resolvedAt:
      new Date().toISOString(),
  };

  const sheetRow =
    existingIndex + 2;

  await updateValues(
    `PanelIssues!A${sheetRow}:N${sheetRow}`,
    [
      [
        resolvedIssue.issueId,

        resolvedIssue.floor,

        resolvedIssue.spaceId,
        resolvedIssue.roomNo,
        resolvedIssue.regionId,

        resolvedIssue.panelboard,

        resolvedIssue.circuitId,
        resolvedIssue.circuitNo,

        resolvedIssue.issueDescription,

        resolvedIssue.status,

        resolvedIssue.createdBy,
        resolvedIssue.createdAt,

        resolvedIssue.resolvedBy,
        resolvedIssue.resolvedAt,
      ],
    ],
    spreadsheetId,
  );

  await appendActivity(
    {
      eventType:
        "panel_issue_resolved",

      floor:
        resolvedIssue.floor,

      regionId:
        resolvedIssue.regionId,

      spaceId:
        resolvedIssue.spaceId,

      user:
        resolvedBy,

      payload:
        resolvedIssue,
    },
    spreadsheetId,
  );

  return resolvedIssue;
}

async function appendActivity(
  input: {
    eventType: string;
    floor: string;
    regionId: string;
    spaceId: string;
    user: string;
    payload: unknown;
  },
  spreadsheetId?: string,
): Promise<void> {
  await appendValues(
    "ActivityLog!A:H",
    [
      [
        globalThis.crypto?.randomUUID?.() ??
          `event-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        input.eventType,
        input.floor,
        input.regionId,
        input.spaceId,
        input.user,
        new Date().toISOString(),
        JSON.stringify(input.payload),
      ],
    ],
    spreadsheetId,
  );
}

export function createGoogleSheetsRepository(
  spreadsheetId: string,
): CommissioningRepository {
  const resolvedSpreadsheetId =
    resolveSpreadsheetId(spreadsheetId);

  return {
    loadAssignments: (floor) =>
      loadAssignments(floor, resolvedSpreadsheetId),

    upsertAssignment: (assignment) =>
      upsertAssignment(
        assignment,
        resolvedSpreadsheetId,
      ),

    loadComments: (floor, regionId) =>
      loadComments(
        floor,
        regionId,
        resolvedSpreadsheetId,
      ),

    addComment: (comment) =>
      addComment(comment, resolvedSpreadsheetId),

    loadFloorChecklistResults: (floor) =>
      loadFloorChecklistResults(
        floor,
        resolvedSpreadsheetId,
      ),

    loadFloorTestResults: (floor) =>
      loadFloorTestResults(
        floor,
        resolvedSpreadsheetId,
      ),

    saveChecklistResults: (inputResults) =>
      saveChecklistResults(
        inputResults,
        resolvedSpreadsheetId,
      ),

    saveTestResults: (inputResults) =>
      saveTestResults(
        inputResults,
        resolvedSpreadsheetId,
      ),

    loadFloorIssues: (floor) =>
      loadFloorIssues(
        floor,
        resolvedSpreadsheetId,
      ),

    createIssue: (issue) =>
      createIssue(issue, resolvedSpreadsheetId),

    resolveIssue: (issueId, resolvedBy) =>
      resolveIssue(
        issueId,
        resolvedBy,
        resolvedSpreadsheetId,
      ),
    
    loadFloorPanelTestResults:
      (floor) =>
        loadFloorPanelTestResults(
          floor,
          resolvedSpreadsheetId,
        ),

    savePanelTestResults:
      (inputResults) =>
        savePanelTestResults(
          inputResults,
          resolvedSpreadsheetId,
        ),

    loadFloorPanelIssues:
      (floor) =>
        loadFloorPanelIssues(
          floor,
          resolvedSpreadsheetId,
        ),

    createPanelIssue:
      (issue) =>
        createPanelIssue(
          issue,
          resolvedSpreadsheetId,
        ),

    resolvePanelIssue:
      (
        issueId,
        resolvedBy,
      ) =>
        resolvePanelIssue(
          issueId,
          resolvedBy,
          resolvedSpreadsheetId,
        ),
  };
}

export function extractSpreadsheetId(
  value: string,
): string {
  const trimmed =
    value.trim();

  if (!trimmed) {
    throw new Error(
      "Enter a Google Sheet URL.",
    );
  }

  /*
   * Normal Google Sheets URL:
   *
   * https://docs.google.com/
   * spreadsheets/d/SPREADSHEET_ID/edit
   */
  const urlMatch =
    trimmed.match(
      /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
    );

  if (urlMatch?.[1]) {
    return urlMatch[1];
  }

  /*
   * Also allow somebody to paste
   * only the spreadsheet ID.
   */
  if (
    /^[a-zA-Z0-9-_]{20,}$/.test(
      trimmed,
    )
  ) {
    return trimmed;
  }

  throw new Error(
    "This does not look like a valid Google Sheet URL or spreadsheet ID.",
  );
}

export async function prepareCxToolsSpreadsheet(
  spreadsheetReference: string,
): Promise<GoogleSheetSetupResult> {
  const spreadsheetId =
    extractSpreadsheetId(
      spreadsheetReference,
    );

  /*
   * This also proves the connected
   * Google account can access the
   * spreadsheet.
   */
  const metadata =
    await authenticatedFetch<
      SpreadsheetMetadata
    >(
      `${SHEETS_API_BASE}/${spreadsheetId}?fields=properties.title,sheets.properties(sheetId,title)`,
    );

  const existingTitles =
    new Set(
      (
        metadata.sheets ??
        []
      )
        .map(
          (sheet) =>
            sheet.properties
              ?.title,
        )
        .filter(
          (
            title,
          ): title is string =>
            Boolean(title),
        ),
    );

  const missingSheets =
    CXTOOLS_REQUIRED_SHEETS
      .filter(
        (definition) =>
          !existingTitles.has(
            definition.title,
          ),
      );

  /*
   * Create missing tabs.
   */
  if (
    missingSheets.length >
    0
  ) {
    await authenticatedFetch(
      `${SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`,
      {
        method:
          "POST",

        body:
          JSON.stringify({
            requests:
              missingSheets.map(
                (definition) => ({
                  addSheet: {
                    properties: {
                      title:
                        definition.title,
                    },
                  },
                }),
              ),
          }),
      },
    );
  }

  const createdSheets =
    missingSheets.map(
      (definition) =>
        definition.title,
    );

  const readySheets:
    string[] = [];

  const issues:
    GoogleSheetSetupIssue[] =
    [];

  /*
   * Validate / initialize every
   * required header row.
   */
  for (
    const definition of
    CXTOOLS_REQUIRED_SHEETS
  ) {
    const response =
      await getValues(
        `${definition.title}!1:1`,
        spreadsheetId,
      );

    const currentHeaders =
      (
        response.values?.[0] ??
        []
      ).map(
        (value) =>
          String(
            value ?? "",
          ).trim(),
      );

    const sheetIsBlank =
      currentHeaders.every(
        (value) =>
          !value,
      );

    if (sheetIsBlank) {
      await updateValues(
        `${definition.title}!A1:${columnLetter(
          definition.headers.length,
        )}1`,
        [
          definition.headers,
        ],
        spreadsheetId,
      );

      readySheets.push(
        definition.title,
      );

      continue;
    }

    const expected =
      definition.headers;

    const headersMatch =
      expected.every(
        (
          expectedHeader,
          index,
        ) =>
          currentHeaders[
            index
          ] ===
          expectedHeader,
      );

    if (!headersMatch) {
      issues.push({
        sheet:
          definition.title,

        message:
          "This tab already contains columns that do not match the cxTools schema. Nothing was overwritten.",
      });

      continue;
    }

    readySheets.push(
      definition.title,
    );
  }

  return {
    spreadsheetId,

    spreadsheetTitle:
      metadata.properties
        ?.title ??
      "Google Sheet",

    requiredSheetCount:
      CXTOOLS_REQUIRED_SHEETS.length,

    createdSheets,

    readySheets,

    issues,
  };
}