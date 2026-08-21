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

const REQUIRED_SHEETS = [
  "Commissioning Schedule",
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