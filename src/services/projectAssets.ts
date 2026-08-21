import {
  getBlob,
  ref,
} from "firebase/storage";

import {
  firebaseStorage,
} from "../auth/firebase";

export async function loadProtectedBlob(
  storagePath: string,
): Promise<Blob> {
  if (!storagePath.trim()) {
    throw new Error(
      "A Storage path is required.",
    );
  }

  return getBlob(
    ref(
      firebaseStorage,
      storagePath,
    ),
  );
}

export async function loadProtectedJson<T>(
  storagePath: string,
): Promise<T> {
  const blob =
    await loadProtectedBlob(
      storagePath,
    );

  const text =
    await blob.text();

  return JSON.parse(text) as T;
}

export async function loadProtectedObjectUrl(
  storagePath: string,
): Promise<string> {
  const blob =
    await loadProtectedBlob(
      storagePath,
    );

  return URL.createObjectURL(blob);
}

export async function loadJsonAsset<T>(
  assetReference: string,
): Promise<T> {
  /*
   * Temporary backwards compatibility:
   *
   * /projects/... = old public URL
   * anything else = protected Storage path
   */

  if (
    assetReference.startsWith("/")
  ) {
    const response =
      await fetch(assetReference);

    if (!response.ok) {
      throw new Error(
        `Asset could not be loaded: ${assetReference}`,
      );
    }

    return response.json() as Promise<T>;
  }

  return loadProtectedJson<T>(
    assetReference,
  );
}

export async function loadImageAsset(
  assetReference: string,
): Promise<{
  url: string;
  revoke: boolean;
}> {
  if (
    assetReference.startsWith("/") ||
    assetReference.startsWith("http://") ||
    assetReference.startsWith("https://")
  ) {
    return {
      url: assetReference,
      revoke: false,
    };
  }

  const blob = 
    await getBlob(
      ref(
        firebaseStorage,
        assetReference,
      ),
    );

  return {
    url:
      URL.createObjectURL(blob),

    revoke: true,
  };
}