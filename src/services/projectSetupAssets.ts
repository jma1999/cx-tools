import {
  ref,
  uploadBytes,
  listAll,
} from "firebase/storage";

import {
  firebaseStorage,
} from "../auth/firebase";

import type {
  GeneratedFloorData,
} from "./commissioningImport";

export interface UploadedFloorData {
  floorId: string;
  spacesUrl: string;
  panelTestsUrl: string;
}

interface UploadedRegion {
  id: string;
  label?: string;
  points: Array<[number, number]>;
  assignedSpaceId?: string | null;
}

interface UploadedRegionData {
  floor?: string;
  viewBox: string;
  sourcePlan?: string;
  regions: UploadedRegion[];
}

function validViewBox(
  value: unknown,
): value is string {
  if (
    typeof value !== "string"
  ) {
    return false;
  }

  const numbers =
    value
      .trim()
      .split(/\s+/)
      .map(Number);

  return (
    numbers.length === 4 &&
    numbers.every(
      Number.isFinite,
    ) &&
    numbers[2] > 0 &&
    numbers[3] > 0
  );
}

export async function uploadCommissioningImport(
  projectId: string,
  sourceWorkbook: File,
  floors:
    GeneratedFloorData[],
): Promise<{
  sourceWorkbookPath: string;

  floors:
    UploadedFloorData[];
}> {
  const sourceWorkbookPath =
    `projects/${projectId}/source/commissioning-data.xlsx`;

  await uploadBytes(
    ref(
      firebaseStorage,
      sourceWorkbookPath,
    ),
    sourceWorkbook,
    {
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  );

  const uploadedFloors:
    UploadedFloorData[] =
    [];

  for (
    const generatedFloor
    of floors
  ) {
    const base =
      `projects/${projectId}/floors/${generatedFloor.floor}/data`;

    const spacesUrl =
      `${base}/spaces.json`;

    const panelTestsUrl =
      `${base}/panel-tests.json`;

    const spacesBlob =
      new Blob(
        [
          JSON.stringify(
            generatedFloor.spacesJson,
            null,
            2,
          ),
        ],
        {
          type:
            "application/json",
        },
      );

    const panelTestsBlob =
      new Blob(
        [
          JSON.stringify(
            generatedFloor.panelTestsJson,
            null,
            2,
          ),
        ],
        {
          type:
            "application/json",
        },
      );

    await Promise.all([
      uploadBytes(
        ref(
          firebaseStorage,
          spacesUrl,
        ),
        spacesBlob,
        {
          contentType:
            "application/json",
        },
      ),

      uploadBytes(
        ref(
          firebaseStorage,
          panelTestsUrl,
        ),
        panelTestsBlob,
        {
          contentType:
            "application/json",
        },
      ),
    ]);

    uploadedFloors.push({
      floorId:
        generatedFloor.floor,

      spacesUrl,

      panelTestsUrl,
    });
  }

  return {
    sourceWorkbookPath,

    floors:
      uploadedFloors,
  };
}

export async function prepareRegionFile(
  file: File,
  projectId: string,
  floorId: string,
): Promise<{
  data:
    UploadedRegionData;

  regionCount:
    number;
}> {
  if (
    !file.name
      .toLowerCase()
      .endsWith(".json")
  ) {
    throw new Error(
      "Clickable regions must be uploaded as a JSON file.",
    );
  }

  let parsed: unknown;

  try {
    parsed =
      JSON.parse(
        await file.text(),
      );
  } catch {
    throw new Error(
      "The regions file is not valid JSON.",
    );
  }

  if (
    typeof parsed !== "object" ||
    parsed === null
  ) {
    throw new Error(
      "The regions file has an invalid structure.",
    );
  }

  const data =
    parsed as Partial<
      UploadedRegionData
    >;

  if (
    data.floor &&
    data.floor !== floorId
  ) {
    throw new Error(
      `This region file says Floor "${data.floor}", but you are configuring Floor "${floorId}".`,
    );
  }

  if (
    !validViewBox(
      data.viewBox,
    )
  ) {
    throw new Error(
      'regions.json must contain a valid viewBox such as "0 0 792 612".',
    );
  }

  if (
    !Array.isArray(
      data.regions,
    ) ||
    data.regions.length === 0
  ) {
    throw new Error(
      "The regions file must contain at least one clickable region.",
    );
  }

  const ids =
    new Set<string>();

  for (
    const [
      index,
      region,
    ] of data.regions.entries()
  ) {
    if (
      !region ||
      typeof region !==
        "object"
    ) {
      throw new Error(
        `Region ${index + 1} is invalid.`,
      );
    }

    if (
      typeof region.id !==
        "string" ||
      !region.id.trim()
    ) {
      throw new Error(
        `Region ${index + 1} is missing an ID.`,
      );
    }

    if (
      ids.has(region.id)
    ) {
      throw new Error(
        `Duplicate region ID "${region.id}".`,
      );
    }

    ids.add(
      region.id,
    );

    if (
      !Array.isArray(
        region.points,
      ) ||
      region.points.length < 3
    ) {
      throw new Error(
        `Region "${region.id}" must contain at least three polygon points.`,
      );
    }

    for (
      const point of
      region.points
    ) {
      if (
        !Array.isArray(point) ||
        point.length !== 2 ||
        !Number.isFinite(
          Number(point[0]),
        ) ||
        !Number.isFinite(
          Number(point[1]),
        )
      ) {
        throw new Error(
          `Region "${region.id}" contains an invalid polygon point.`,
        );
      }
    }
  }

  /*
   * Important:
   * Never trust an old sourcePlan
   * path supplied by the uploaded JSON.
   *
   * cxTools controls this path.
   */
  const prepared:
    UploadedRegionData = {
    ...data,

    floor:
      floorId,

    viewBox:
      data.viewBox!,

    sourcePlan:
      `projects/${projectId}/floors/${floorId}/plans/base.svg`,

    regions:
      data.regions,
  };

  return {
    data:
      prepared,

    regionCount:
      prepared.regions.length,
  };
}

export async function validateSvgPlan(
  file: File,
): Promise<void> {
  if (
    !file.name
      .toLowerCase()
      .endsWith(".svg")
  ) {
    throw new Error(
      "The base floor drawing must be an SVG file.",
    );
  }

  const text =
    await file.text();

  if (
    !/<svg[\s>]/i.test(
      text,
    )
  ) {
    throw new Error(
      "The selected file does not appear to contain valid SVG markup.",
    );
  }
}

export async function uploadFloorVisualAssets(
  projectId: string,
  floorId: string,
  planFile: File,
  regionData:
    UploadedRegionData,
): Promise<{
  planPath: string;
  regionsUrl: string;
}> {
  await validateSvgPlan(
    planFile,
  );

  const planPath =
    `projects/${projectId}/floors/${floorId}/plans/base.svg`;

  const regionsUrl =
    `projects/${projectId}/floors/${floorId}/data/regions.json`;

  const regionsBlob =
    new Blob(
      [
        JSON.stringify(
          regionData,
          null,
          2,
        ),
      ],
      {
        type:
          "application/json",
      },
    );

  await Promise.all([
    uploadBytes(
      ref(
        firebaseStorage,
        planPath,
      ),
      planFile,
      {
        contentType:
          "image/svg+xml",
      },
    ),

    uploadBytes(
      ref(
        firebaseStorage,
        regionsUrl,
      ),
      regionsBlob,
      {
        contentType:
          "application/json",
      },
    ),
  ]);

  return {
    planPath,
    regionsUrl,
  };
}

export async function uploadPanelReferenceImages(
  projectId: string,
  floorId: string,
  files: File[],
): Promise<number> {
  const allowedTypes =
    new Set([
      "image/png",
      "image/jpeg",
      "image/webp",
    ]);

  for (
    const file of files
  ) {
    if (
      !allowedTypes.has(
        file.type,
      )
    ) {
      throw new Error(
        `${file.name} is not a supported image. Use PNG, JPG or WebP.`,
      );
    }
  }

  await Promise.all(
    files.map(
      (file) =>
        uploadBytes(
          ref(
            firebaseStorage,
            `projects/${projectId}/floors/${floorId}/panel-reference/${file.name}`,
          ),
          file,
          {
            contentType:
              file.type,
          },
        ),
    ),
  );

  return files.length;
}

export async function listPanelReferenceImages(
  projectId: string,
  floorId: string,
): Promise<string[]> {
  const result =
    await listAll(
      ref(
        firebaseStorage,
        `projects/${projectId}/floors/${floorId}/panel-reference`,
      ),
    );

  return result.items
    .map(
      (item) =>
        item.name,
    )
    .sort();
}