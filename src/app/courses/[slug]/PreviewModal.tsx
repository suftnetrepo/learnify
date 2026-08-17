"use client";

import { useState } from "react";
import { X, PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  lectureTitle: string;
  videoUrl:     string;
}

export function PreviewModal({ lectureTitle, videoUrl }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 hover:underline transition-colors"
      >
        <PlayCircle size={13} />
        Preview
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-full max-w-3xl rounded-2xl overflow-hidden bg-black shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-surface-900">
              <p className="text-sm font-medium text-white truncate pr-4">{lectureTitle}</p>
              <button
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Video */}
            <div className="aspect-video bg-black">
              <video
                src={videoUrl}
                controls
                autoPlay
                className="h-full w-full"
                controlsList="nodownload"
              />
            </div>

            {/* Footer */}
            <div className="px-4 py-3 bg-surface-900 text-center">
              <p className="text-xs text-gray-400">
                Free preview — enrol for full access to all lectures
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
