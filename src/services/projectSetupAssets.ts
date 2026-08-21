import {
  ref,
  uploadBytes,
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