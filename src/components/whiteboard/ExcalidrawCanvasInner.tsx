"use client";

// Loaded only through ExcalidrawCanvas's dynamic(..., { ssr: false }) — never import directly.
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import type { ExcalidrawCanvasProps } from "./ExcalidrawCanvas";

export default function ExcalidrawCanvasInner({ initialData, onChange, readOnly = false, onApi }: ExcalidrawCanvasProps) {
  return (
    <div className="h-full w-full">
      <Excalidraw
        initialData={initialData}
        onChange={readOnly ? undefined : onChange}
        excalidrawAPI={onApi}
        viewModeEnabled={readOnly}
        UIOptions={{
          canvasActions: {
            // Saving/loading files is handled by the app (autosave + Export menu)
            loadScene:    false,
            saveToActiveFile: false,
            export:       false,
          },
        }}
      />
    </div>
  );
}
