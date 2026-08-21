import ExcelJS from "exceljs";

export interface ImportValidationIssue {
  severity: "error" | "warning";
  sheet: string;
  row?: number;
  message: string;
}

export interface CommissioningImportSummary {
  spaces: number;
  commissioningItems: number;
  panelTests: number;
  panelCircuits: number;
  floors: string[];
  errors: ImportValidationIssue[];
  warnings: ImportValidationIssue[];
}

export interface GeneratedFloorData {
  floor: string;
  spacesJson: Record<string, unknown>;
  panelTestsJson: Record<string, unknown>;
}

export interface PreparedCommissioningImport {
  summary: CommissioningImportSummary;
  floors: GeneratedFloorData[];
}

interface WorkbookTestDefinition {
  id: string;
  label: string;
  instructions?: string;
}

const REQUIRED_SHEETS = [
  "Commissioning Schedule",
  "Test Profiles",
  "Panel Tests",
  "Panel Circuits",
] as const;

const SCHEDULE_REQUIRED_HEADERS = [
  "floor",
  "roomNo",
  "spaceType",
  "regionId",
  "category",
  "deviceType",
  "expectedQty",
];

const PANEL_TEST_REQUIRED_HEADERS = [
  "floor",
  "panelTestId",
  "roomNo",
  "displayName",
  "regionId",
  "panelboard",
];

const PANEL_CIRCUIT_REQUIRED_HEADERS = [
  "floor",
  "panelTestId",
  "circuitId",
  "circuitNo",
  "loadDescription",
  "testLabel",
  "expectedResult",
];

function cellText(
  value: ExcelJS.CellValue,
): string {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  if (
    typeof value === "object" &&
    "text" in value &&
    typeof value.text === "string"
  ) {
    return value.text.trim();
  }

  if (
    typeof value === "object" &&
    "result" in value
  ) {
    return String(
      value.result ?? "",
    ).trim();
  }

  return String(value).trim();
}

function getHeaders(
  worksheet: ExcelJS.Worksheet,
): string[] {
  const row =
    worksheet.getRow(1);

  const headers: string[] = [];

  row.eachCell(
    {
      includeEmpty: true,
    },
    (cell) => {
      headers.push(
        cellText(cell.value),
      );
    },
  );

  return headers;
}

function headerMap(
  worksheet: ExcelJS.Worksheet,
): Map<string, number> {
  const headers =
    getHeaders(worksheet);

  return new Map(
    headers.map(
      (header, index) => [
        header,
        index + 1,
      ],
    ),
  );
}

function validateHeaders(
  worksheet: ExcelJS.Worksheet,
  requiredHeaders: string[],
  issues: ImportValidationIssue[],
): void {
  const headers =
    new Set(
      getHeaders(worksheet),
    );

  for (
    const requiredHeader
    of requiredHeaders
  ) {
    if (
      !headers.has(
        requiredHeader,
      )
    ) {
      issues.push({
        severity: "error",

        sheet:
          worksheet.name,

        message:
          `Required column "${requiredHeader}" is missing.`,
      });
    }
  }
}

function nonEmptyRows(
  worksheet: ExcelJS.Worksheet,
): ExcelJS.Row[] {
  const rows: ExcelJS.Row[] =
    [];

  worksheet.eachRow(
    {
      includeEmpty: false,
    },
    (row, rowNumber) => {
      if (
        rowNumber === 1
      ) {
        return;
      }

      let containsData =
        false;

      row.eachCell(
        {
          includeEmpty: true,
        },
        (cell) => {
          if (
            cellText(
              cell.value,
            )
          ) {
            containsData =
              true;
          }
        },
      );

      if (containsData) {
        rows.push(row);
      }
    },
  );

  return rows;
}

function rowValue(
  row: ExcelJS.Row,
  headers:
    Map<string, number>,
  field: string,
): string {
  const column =
    headers.get(field);

  if (!column) {
    return "";
  }

  return cellText(
    row.getCell(column).value,
  );
}

function requireRowValue(
  row: ExcelJS.Row,
  headers:
    Map<string, number>,
  field: string,
  sheet: string,
  issues:
    ImportValidationIssue[],
): string {
  const value =
    rowValue(
      row,
      headers,
      field,
    );

  if (!value) {
    issues.push({
      severity: "error",

      sheet,

      row:
        row.number,

      message:
        `"${field}" is required.`,
    });
  }

  return value;
}

function slugify(
  value: string,
): string {
  return value
    .trim()
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      "-",
    )
    .replace(
      /^-+|-+$/g,
      "",
    );
}

function optionalBoolean(
  value: string,
): boolean | null {
  const normalized =
    value
      .trim()
      .toLowerCase();

  if (!normalized) {
    return null;
  }

  if (
    normalized === "true" ||
    normalized === "yes" ||
    normalized === "1"
  ) {
    return true;
  }

  if (
    normalized === "false" ||
    normalized === "no" ||
    normalized === "0"
  ) {
    return false;
  }

  return null;
}

function loadTestProfiles(
  workbook: ExcelJS.Workbook,
): Map<
  string,
  WorkbookTestDefinition[]
> {
  const worksheet =
    workbook.getWorksheet(
      "Test Profiles",
    );

  if (!worksheet) {
    return new Map();
  }

  const headers =
    headerMap(worksheet);

  const profiles =
    new Map<
      string,
      WorkbookTestDefinition[]
    >();

  for (
    const row of
    nonEmptyRows(worksheet)
  ) {
    const profileName =
      rowValue(
        row,
        headers,
        "profileName",
      );

    const testId =
      rowValue(
        row,
        headers,
        "testId",
      );

    const testLabel =
      rowValue(
        row,
        headers,
        "testLabel",
      );

    const instructions =
      rowValue(
        row,
        headers,
        "instructions",
      );

    if (
      !profileName ||
      !testId ||
      !testLabel
    ) {
      continue;
    }

    const existing =
      profiles.get(
        profileName,
      ) ?? [];

    existing.push({
      id:
        testId,

      label:
        testLabel,

      ...(instructions
        ? {
            instructions,
          }
        : {}),
    });

    profiles.set(
      profileName,
      existing,
    );
  }

  return profiles;
}

function buildItemTests(
  profileText: string,
  category: string,
  profiles:
    Map<
      string,
      WorkbookTestDefinition[]
    >,
): Array<
  Record<string, unknown>
> {
  const names =
    profileText
      .split("|")
      .map(
        (value) =>
          value.trim(),
      )
      .filter(Boolean);

  const selectedProfiles =
    names.length > 0
      ? names
      : [
          category === "lighting"
            ? "lighting-base"
            : "control-generic",
        ];

  const tests:
    Array<
      Record<string, unknown>
    > = [];

  const seen =
    new Set<string>();

  for (
    const profileName of
    selectedProfiles
  ) {
    const definitions =
      profiles.get(
        profileName,
      );

    if (!definitions) {
      throw new Error(
        `Unknown test profile "${profileName}".`,
      );
    }

    for (
      const definition of
      definitions
    ) {
      if (
        seen.has(
          definition.id,
        )
      ) {
        continue;
      }

      seen.add(
        definition.id,
      );

      tests.push({
        id:
          definition.id,

        label:
          definition.label,

        ...(definition.instructions
          ? {
              instructions:
                definition.instructions,
            }
          : {}),

        result:
          "not_checked",

        notes: "",

        issueIds: [],
      });
    }
  }

  return tests;
}

export async function validateCommissioningWorkbook(
  file: File,
): Promise<CommissioningImportSummary> {
  const workbook =
    new ExcelJS.Workbook();

  const buffer =
    await file.arrayBuffer();

  await workbook.xlsx.load(
    buffer,
  );

  const errors:
    ImportValidationIssue[] =
    [];

  const warnings:
    ImportValidationIssue[] =
    [];

  /*
   * First verify required sheets.
   */
  for (
    const sheetName
    of REQUIRED_SHEETS
  ) {
    if (
      !workbook.getWorksheet(
        sheetName,
      )
    ) {
      errors.push({
        severity: "error",

        sheet:
          sheetName,

        message:
          `Required worksheet "${sheetName}" is missing.`,
      });
    }
  }

  if (errors.length > 0) {
    return {
      spaces: 0,
      commissioningItems: 0,
      panelTests: 0,
      panelCircuits: 0,
      floors: [],
      errors,
      warnings,
    };
  }

  const schedule =
    workbook.getWorksheet(
      "Commissioning Schedule",
    )!;

  const panelTests =
    workbook.getWorksheet(
      "Panel Tests",
    )!;

  const panelCircuits =
    workbook.getWorksheet(
      "Panel Circuits",
    )!;

  validateHeaders(
    schedule,
    SCHEDULE_REQUIRED_HEADERS,
    errors,
  );

  validateHeaders(
    panelTests,
    PANEL_TEST_REQUIRED_HEADERS,
    errors,
  );

  validateHeaders(
    panelCircuits,
    PANEL_CIRCUIT_REQUIRED_HEADERS,
    errors,
  );

  if (errors.length > 0) {
    return {
      spaces: 0,
      commissioningItems: 0,
      panelTests: 0,
      panelCircuits: 0,
      floors: [],
      errors,
      warnings,
    };
  }

  /*
   * Lighting / controls schedule
   */
  const scheduleHeaders =
    headerMap(schedule);

  const scheduleRows =
    nonEmptyRows(schedule);

  const spaceKeys =
    new Set<string>();

  const floors =
    new Set<string>();

  for (
    const row
    of scheduleRows
  ) {
    const floor =
      requireRowValue(
        row,
        scheduleHeaders,
        "floor",
        schedule.name,
        errors,
      );

    const roomNo =
      requireRowValue(
        row,
        scheduleHeaders,
        "roomNo",
        schedule.name,
        errors,
      );

    const spaceType =
      requireRowValue(
        row,
        scheduleHeaders,
        "spaceType",
        schedule.name,
        errors,
      );

    const regionId =
      requireRowValue(
        row,
        scheduleHeaders,
        "regionId",
        schedule.name,
        errors,
      );

    const category =
      requireRowValue(
        row,
        scheduleHeaders,
        "category",
        schedule.name,
        errors,
      ).toLowerCase();

    requireRowValue(
      row,
      scheduleHeaders,
      "deviceType",
      schedule.name,
      errors,
    );

    const expectedQty =
      requireRowValue(
        row,
        scheduleHeaders,
        "expectedQty",
        schedule.name,
        errors,
      );

    if (
      category &&
      category !==
        "lighting" &&
      category !==
        "control"
    ) {
      errors.push({
        severity: "error",

        sheet:
          schedule.name,

        row: row.number,

        message:
          `category must be "lighting" or "control".`,
      });
    }

    if (
      expectedQty &&
      (
        !Number.isInteger(
          Number(
            expectedQty,
          ),
        ) ||
        Number(
          expectedQty,
        ) < 0
      )
    ) {
      errors.push({
        severity: "error",

        sheet:
          schedule.name,

        row: row.number,

        message:
          `"expectedQty" must be a non-negative whole number.`,
      });
    }

    if (
      floor &&
      roomNo &&
      spaceType &&
      regionId
    ) {
      spaceKeys.add(
        [
          floor,
          roomNo,
          spaceType,
          regionId,
        ].join("::"),
      );

      floors.add(
        floor,
      );
    }
  }

  /*
   * Panel tests
   */
  const panelTestHeaders =
    headerMap(
      panelTests,
    );

  const panelTestRows =
    nonEmptyRows(
      panelTests,
    );

  const knownPanelTestIds =
    new Set<string>();

  for (
    const row
    of panelTestRows
  ) {
    const floor =
      requireRowValue(
        row,
        panelTestHeaders,
        "floor",
        panelTests.name,
        errors,
      );

    const panelTestId =
      requireRowValue(
        row,
        panelTestHeaders,
        "panelTestId",
        panelTests.name,
        errors,
      );

    requireRowValue(
      row,
      panelTestHeaders,
      "roomNo",
      panelTests.name,
      errors,
    );

    requireRowValue(
      row,
      panelTestHeaders,
      "displayName",
      panelTests.name,
      errors,
    );

    requireRowValue(
      row,
      panelTestHeaders,
      "regionId",
      panelTests.name,
      errors,
    );

    requireRowValue(
      row,
      panelTestHeaders,
      "panelboard",
      panelTests.name,
      errors,
    );

    if (floor) {
      floors.add(
        floor,
      );
    }

    if (panelTestId) {
      if (
        knownPanelTestIds.has(
          panelTestId,
        )
      ) {
        errors.push({
          severity:
            "error",

          sheet:
            panelTests.name,

          row:
            row.number,

          message:
            `Duplicate panelTestId "${panelTestId}".`,
        });
      }

      knownPanelTestIds.add(
        panelTestId,
      );
    }
  }

  /*
   * Panel circuits
   */
  const circuitHeaders =
    headerMap(
      panelCircuits,
    );

  const circuitRows =
    nonEmptyRows(
      panelCircuits,
    );

  const circuitIds =
    new Set<string>();

  for (
    const row
    of circuitRows
  ) {
    const floor =
      requireRowValue(
        row,
        circuitHeaders,
        "floor",
        panelCircuits.name,
        errors,
      );

    const panelTestId =
      requireRowValue(
        row,
        circuitHeaders,
        "panelTestId",
        panelCircuits.name,
        errors,
      );

    const circuitId =
      requireRowValue(
        row,
        circuitHeaders,
        "circuitId",
        panelCircuits.name,
        errors,
      );

    requireRowValue(
      row,
      circuitHeaders,
      "circuitNo",
      panelCircuits.name,
      errors,
    );

    requireRowValue(
      row,
      circuitHeaders,
      "loadDescription",
      panelCircuits.name,
      errors,
    );

    requireRowValue(
      row,
      circuitHeaders,
      "testLabel",
      panelCircuits.name,
      errors,
    );

    requireRowValue(
      row,
      circuitHeaders,
      "expectedResult",
      panelCircuits.name,
      errors,
    );

    if (floor) {
      floors.add(
        floor,
      );
    }

    if (
      panelTestId &&
      !knownPanelTestIds.has(
        panelTestId,
      )
    ) {
      errors.push({
        severity:
          "error",

        sheet:
          panelCircuits.name,

        row:
          row.number,

        message:
          `panelTestId "${panelTestId}" does not exist in Panel Tests.`,
      });
    }

    if (circuitId) {
      if (
        circuitIds.has(
          circuitId,
        )
      ) {
        errors.push({
          severity:
            "error",

          sheet:
            panelCircuits.name,

          row:
            row.number,

          message:
            `Duplicate circuitId "${circuitId}".`,
        });
      }

      circuitIds.add(
        circuitId,
      );
    }
  }

  if (
    scheduleRows.length ===
    0
  ) {
    warnings.push({
      severity: "warning",

      sheet:
        schedule.name,

      message:
        "No lighting or control records were found.",
    });
  }

  return {
    spaces:
      spaceKeys.size,

    commissioningItems:
      scheduleRows.length,

    panelTests:
      panelTestRows.length,

    panelCircuits:
      circuitRows.length,

    floors:
      [...floors].sort(),

    errors,

    warnings,
  };
}

export async function prepareCommissioningImport(
  file: File,
  projectId: string,
  configuredFloorIds: string[],
): Promise<PreparedCommissioningImport> {
  const summary =
    await validateCommissioningWorkbook(
      file,
    );

  if (
    summary.errors.length >
    0
  ) {
    return {
      summary,
      floors: [],
    };
  }

  const workbook =
    new ExcelJS.Workbook();

  await workbook.xlsx.load(
    await file.arrayBuffer(),
  );

  const schedule =
    workbook.getWorksheet(
      "Commissioning Schedule",
    )!;

  const panelTestsSheet =
    workbook.getWorksheet(
      "Panel Tests",
    )!;

  const panelCircuitsSheet =
    workbook.getWorksheet(
      "Panel Circuits",
    )!;

  const profiles =
    loadTestProfiles(
      workbook,
    );

  const allowedFloors =
    new Set(
      configuredFloorIds,
    );

  /*
   * -------------------------
   * Lighting / controls data
   * -------------------------
   */

  const scheduleHeaders =
    headerMap(schedule);

  const spacesByFloor =
    new Map<
      string,
      Map<
        string,
        Record<
          string,
          unknown
        >
      >
    >();

  const itemCounters =
    new Map<
      string,
      Record<
        string,
        number
      >
    >();

  for (
    const row of
    nonEmptyRows(schedule)
  ) {
    const floor =
      rowValue(
        row,
        scheduleHeaders,
        "floor",
      );

    if (
      !allowedFloors.has(
        floor,
      )
    ) {
      throw new Error(
        `Commissioning Schedule row ${row.number} references Floor "${floor}", but that floor has not been added to the project.`,
      );
    }

    const roomNo =
      rowValue(
        row,
        scheduleHeaders,
        "roomNo",
      );

    const spaceType =
      rowValue(
        row,
        scheduleHeaders,
        "spaceType",
      );

    const displayName =
      rowValue(
        row,
        scheduleHeaders,
        "displayName",
      ) ||
      `${roomNo} - ${spaceType}`;

    const regionId =
      rowValue(
        row,
        scheduleHeaders,
        "regionId",
      );

    const category =
      rowValue(
        row,
        scheduleHeaders,
        "category",
      ).toLowerCase();

    const deviceType =
      rowValue(
        row,
        scheduleHeaders,
        "deviceType",
      );

    const catalogNo =
      rowValue(
        row,
        scheduleHeaders,
        "catalogNo",
      );

    const expectedQty =
      Number(
        rowValue(
          row,
          scheduleHeaders,
          "expectedQty",
        ),
      );

    const testProfiles =
      rowValue(
        row,
        scheduleHeaders,
        "testProfiles",
      );

    const spaceNotes =
      rowValue(
        row,
        scheduleHeaders,
        "spaceNotes",
      );

    const itemNotes =
      rowValue(
        row,
        scheduleHeaders,
        "itemNotes",
      );

    const daylightZone =
      optionalBoolean(
        rowValue(
          row,
          scheduleHeaders,
          "daylightZone",
        ),
      );

    const emergencyFixtures =
      optionalBoolean(
        rowValue(
          row,
          scheduleHeaders,
          "emergencyFixtures",
        ),
      );

    let floorSpaces =
      spacesByFloor.get(
        floor,
      );

    if (!floorSpaces) {
      floorSpaces =
        new Map();

      spacesByFloor.set(
        floor,
        floorSpaces,
      );
    }

    const spaceKey =
      [
        floor,
        roomNo,
        spaceType,
        regionId,
      ].join("::");

    let space =
      floorSpaces.get(
        spaceKey,
      );

    if (!space) {
      space = {
        id:
          `space-${slugify(
            floor,
          )}-${slugify(
            regionId,
          )}`,

        sourceRow:
          row.number,

        floor,

        roomNo,

        spaceType,

        displayName,

        regionId,

        status:
          "not_inspected",

        polygon: [],

        daylightZone,

        emergencyFixtures,

        testedBy: "",

        testedAt: null,

        notes:
          spaceNotes,

        items: [],

        issueIds: [],
      };

      floorSpaces.set(
        spaceKey,
        space,
      );
    }

    const counters =
      itemCounters.get(
        spaceKey,
      ) ?? {
        lighting: 0,
        control: 0,
      };

    counters[category] =
      (counters[
        category
      ] ?? 0) + 1;

    itemCounters.set(
      spaceKey,
      counters,
    );

    const suppliedItemId =
      rowValue(
        row,
        scheduleHeaders,
        "itemId",
      );

    const itemId =
      suppliedItemId ||
      `${category}-${counters[category]}`;

    const items =
      space.items as Array<
        Record<
          string,
          unknown
        >
      >;

    if (
      items.some(
        (item) =>
          item.id ===
          itemId,
      )
    ) {
      throw new Error(
        `Commissioning Schedule row ${row.number} duplicates itemId "${itemId}" in Room ${roomNo}.`,
      );
    }

    items.push({
      id:
        itemId,

      category,

      deviceType,

      catalogNo:
        catalogNo ||
        null,

      expectedQty,

      observedQty:
        null,

      result:
        "not_checked",

      notes:
        itemNotes,

      tests:
        buildItemTests(
          testProfiles,
          category,
          profiles,
        ),

      issueIds: [],
    });
  }

  /*
   * -------------------------
   * ELE-panel room records
   * -------------------------
   */

  const panelHeaders =
    headerMap(
      panelTestsSheet,
    );

  const panelSpacesByFloor =
    new Map<
      string,
      Map<
        string,
        Record<
          string,
          unknown
        >
      >
    >();

  for (
    const row of
    nonEmptyRows(
      panelTestsSheet,
    )
  ) {
    const floor =
      rowValue(
        row,
        panelHeaders,
        "floor",
      );

    if (
      !allowedFloors.has(
        floor,
      )
    ) {
      throw new Error(
        `Panel Tests row ${row.number} references Floor "${floor}", but that floor has not been added to the project.`,
      );
    }

    const panelTestId =
      rowValue(
        row,
        panelHeaders,
        "panelTestId",
      );

    const referenceFile =
      rowValue(
        row,
        panelHeaders,
        "referenceImageFile",
      );

    let floorPanelSpaces =
      panelSpacesByFloor.get(
        floor,
      );

    if (!floorPanelSpaces) {
      floorPanelSpaces =
        new Map();

      panelSpacesByFloor.set(
        floor,
        floorPanelSpaces,
      );
    }

    floorPanelSpaces.set(
      panelTestId,
      {
        id:
          panelTestId,

        floor,

        roomNo:
          rowValue(
            row,
            panelHeaders,
            "roomNo",
          ),

        displayName:
          rowValue(
            row,
            panelHeaders,
            "displayName",
          ),

        regionId:
          rowValue(
            row,
            panelHeaders,
            "regionId",
          ),

        panelboard:
          rowValue(
            row,
            panelHeaders,
            "panelboard",
          ),

        panelLocation:
          rowValue(
            row,
            panelHeaders,
            "panelLocation",
          ),

        ...(referenceFile
          ? {
              referenceImageUrl:
                `projects/${projectId}/floors/${floor}/panel-reference/${referenceFile}`,
            }
          : {}),

        notes:
          rowValue(
            row,
            panelHeaders,
            "notes",
          ),

        circuits: [],
      },
    );
  }

  /*
   * -------------------------
   * Panel circuits
   * -------------------------
   */

  const circuitHeaders =
    headerMap(
      panelCircuitsSheet,
    );

  for (
    const row of
    nonEmptyRows(
      panelCircuitsSheet,
    )
  ) {
    const floor =
      rowValue(
        row,
        circuitHeaders,
        "floor",
      );

    const panelTestId =
      rowValue(
        row,
        circuitHeaders,
        "panelTestId",
      );

    const panelSpace =
      panelSpacesByFloor
        .get(floor)
        ?.get(
          panelTestId,
        );

    if (!panelSpace) {
      throw new Error(
        `Panel Circuits row ${row.number} references unknown panelTestId "${panelTestId}".`,
      );
    }

    const circuits =
      panelSpace.circuits as Array<
        Record<
          string,
          unknown
        >
      >;

    circuits.push({
      id:
        rowValue(
          row,
          circuitHeaders,
          "circuitId",
        ),

      circuitNo:
        rowValue(
          row,
          circuitHeaders,
          "circuitNo",
        ),

      loadDescription:
        rowValue(
          row,
          circuitHeaders,
          "loadDescription",
        ),

      testLabel:
        rowValue(
          row,
          circuitHeaders,
          "testLabel",
        ),

      expectedResult:
        rowValue(
          row,
          circuitHeaders,
          "expectedResult",
        ),

      notes:
        rowValue(
          row,
          circuitHeaders,
          "notes",
        ),
    });
  }

  /*
   * Produce one pair of JSON
   * documents per configured floor.
   */

  const generatedFloors:
    GeneratedFloorData[] =
    configuredFloorIds.map(
      (floor) => ({
        floor,

        spacesJson: {
          schemaVersion: 1,

          floor,

          /*
           * The actual plan rendering
           * comes from regions.json.
           * This preserves the existing
           * spaces schema.
           */
          plan: {
            file:
              `projects/${projectId}/floors/${floor}/plans/base.svg`,

            viewBox:
              "0 0 1 1",
          },

          spaces:
            [
              ...(
                spacesByFloor.get(
                  floor,
                )?.values() ??
                []
              ),
            ],
        },

        panelTestsJson: {
          floor,

          spaces:
            [
              ...(
                panelSpacesByFloor.get(
                  floor,
                )?.values() ??
                []
              ),
            ],
        },
      }),
    );

  return {
    summary,
    floors:
      generatedFloors,
  };
}