"use client";

// Loaded only through ExcalidrawCanvas's dynamic(..., { ssr: false }) — never import directly.
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import type { ExcalidrawCanvasProps } from "./ExcalidrawCanvas";

export default function ExcalidrawCanvasInner({
  initialData, onChange, readOnly = false, onApi, onPointerUpdate, isCollaborating,
}: ExcalidrawCanvasProps) {
  return (
    <div className="h-full w-full">
      <Excalidraw
        initialData={initialData}
        // Still fires in view mode — the classroom tracks scroll/zoom for its cursor overlay
        onChange={onChange}
        excalidrawAPI={onApi}
        viewModeEnabled={readOnly}
        isCollaborating={isCollaborating}
        onPointerUpdate={onPointerUpdate ? ({ pointer }) => onPointerUpdate({ x: pointer.x, y: pointer.y }) : undefined}
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
