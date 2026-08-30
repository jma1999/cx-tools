import {
  getBlob,
  ref,
} from "firebase/storage";

import {
  firebaseStorage,
} from "../auth/firebase";

export interface LoadedAssetUrl {
  url: string;
  revoke: boolean;
}

function isBrowserUrl(
  assetReference: string,
): boolean {
  return (
    assetReference.startsWith("/") ||
    assetReference.startsWith("http://") ||
    assetReference.startsWith("https://") ||
    assetReference.startsWith("blob:") ||
    assetReference.startsWith("data:")
  );
}

async function fetchPublicAsset(
  assetReference: string,
): Promise<Blob> {
  const response =
    await fetch(
      assetReference,
    );

  if (!response.ok) {
    throw new Error(
      `Asset could not be loaded (${response.status}).`,
    );
  }

  return response.blob();
}

async function loadAssetBlob(
  assetReference: string,
): Promise<Blob> {
  const trimmed =
    assetReference.trim();

  if (!trimmed) {
    throw new Error(
      "Asset path is empty.",
    );
  }

  if (
    isBrowserUrl(
      trimmed,
    )
  ) {
    return fetchPublicAsset(
      trimmed,
    );
  }

  return getBlob(
    ref(
      firebaseStorage,
      trimmed,
    ),
  );
}

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
  const blob =
    await loadAssetBlob(
      assetReference,
    );

  const text =
    await blob.text();

  try {
    return JSON.parse(
      text,
    ) as T;
  } catch {
    throw new Error(
      `JSON asset "${assetReference}" could not be parsed.`,
    );
  }
}

export async function loadImageAsset(
  assetReference: string,
): Promise<LoadedAssetUrl> {
  const trimmed =
    assetReference.trim();

  /*
   * Existing public Keystone
   * paths remain backwards-compatible.
   */
  if (
    isBrowserUrl(
      trimmed,
    )
  ) {
    return {
      url: trimmed,
      revoke: false,
    };
  }

  const blob =
    await loadAssetBlob(
      trimmed,
    );

  return {
    url:
      URL.createObjectURL(
        blob,
      ),

    revoke: true,
  };
}