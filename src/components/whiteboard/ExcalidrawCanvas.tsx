"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI, ExcalidrawInitialDataState } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement, OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";

export type { AppState, BinaryFiles, ExcalidrawImperativeAPI, ExcalidrawInitialDataState };
export type { ExcalidrawElement, OrderedExcalidrawElement };

export interface ExcalidrawCanvasProps {
  initialData?: ExcalidrawInitialDataState | null;
  onChange?:    (elements: readonly OrderedExcalidrawElement[], appState: AppState, files: BinaryFiles) => void;
  readOnly?:    boolean;
  /** Imperative API — used for export and for replacing the scene after a conflict reload */
  onApi?:       (api: ExcalidrawImperativeAPI) => void;
}

/** Stored scene shape — what serializeAsJSON(..., "database") produces. */
export interface StoredScene {
  type?:     string;
  version?:  number;
  elements:  readonly ExcalidrawElement[];
  appState?: Partial<AppState>;
  files?:    BinaryFiles;
}

/** Excalidraw touches window/canvas at import time, so it must never render on the server. */
export const ExcalidrawCanvas = dynamic<ExcalidrawCanvasProps>(
  () => import("./ExcalidrawCanvasInner"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-white">
        <Loader2 size={24} className="animate-spin text-brand-500" />
      </div>
    ),
  },
);

/** Serialises the live scene for storage (strips volatile app state like scroll/selection). */
export async function serializeScene(
  elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles,
): Promise<StoredScene> {
  const { serializeAsJSON } = await import("@excalidraw/excalidraw");
  return JSON.parse(serializeAsJSON(elements, appState, files, "database")) as StoredScene;
}

function exportInput(scene: StoredScene) {
  return {
    elements: scene.elements.filter((el) => !el.isDeleted),
    appState: { ...scene.appState, exportBackground: true },
    files:    scene.files ?? null,
  };
}

export async function exportScenePng(scene: StoredScene): Promise<Blob> {
  const { exportToBlob } = await import("@excalidraw/excalidraw");
  return exportToBlob({ ...exportInput(scene), mimeType: "image/png" });
}

export async function exportSceneSvg(scene: StoredScene): Promise<string> {
  const { exportToSvg } = await import("@excalidraw/excalidraw");
  const svg = await exportToSvg(exportInput(scene));
  return new XMLSerializer().serializeToString(svg);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
