"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, X, CheckCircle2, Loader2, Film, Image as ImageIcon, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

type UploadType   = "video" | "image" | "document";
type UploadFolder = "lectures" | "thumbnails" | "resources" | "avatars";

interface UploadResult {
  publicId:    string;
  secureUrl:   string;
  duration?:   number;   // seconds (video only)
  bytes:       number;
  format:      string;
  thumbnailUrl?: string;
}

interface CloudinaryUploaderProps {
  type:        UploadType;
  folder:      UploadFolder;
  onSuccess:   (result: UploadResult) => void;
  onError?:    (error: string) => void;
  accept?:     string;
  maxSizeMb?:  number;
  label?:      string;
  currentUrl?: string;
  className?:  string;
}

const TYPE_ICONS: Record<UploadType, React.ReactNode> = {
  video:    <Film    size={20} />,
  image:    <ImageIcon size={20} />,
  document: <FileText size={20} />,
};

const TYPE_ACCEPT: Record<UploadType, string> = {
  video:    "video/mp4,video/webm,video/ogg,video/quicktime",
  image:    "image/jpeg,image/png,image/webp,image/gif",
  document: "application/pdf,.doc,.docx,.ppt,.pptx",
};

export function CloudinaryUploader({
  type, folder, onSuccess, onError, accept,
  maxSizeMb = 500, label, currentUrl, className,
}: CloudinaryUploaderProps) {
  const [status,   setStatus]   = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [preview,  setPreview]  = useState<string | null>(currentUrl ?? null);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(async (file: File) => {
    if (file.size > maxSizeMb * 1024 * 1024) {
      onError?.(`File must be under ${maxSizeMb}MB`);
      return;
    }

    setStatus("uploading");
    setProgress(0);

    try {
      // 1. Get signed params from our API
      const paramsRes  = await fetch(`/api/upload?type=${type}&folder=${folder}`);
      const paramsData = await paramsRes.json();
      if (!paramsData.success) throw new Error(paramsData.message);

      const { signature, timestamp, apiKey, cloudName, folder: cloudFolder, resourceType } = paramsData.data;

      // 2. Upload directly to Cloudinary
      const formData = new FormData();
      formData.append("file",            file);
      formData.append("api_key",         apiKey);
      formData.append("timestamp",       String(timestamp));
      formData.append("signature",       signature);
      formData.append("folder",          cloudFolder);

      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
      });

      const uploadResult = await new Promise<Record<string, unknown>>((resolve, reject) => {
        xhr.open("POST", `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`);
        xhr.onload  = () => resolve(JSON.parse(xhr.responseText));
        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.send(formData);
      });

      if (uploadResult.error) throw new Error((uploadResult.error as { message: string }).message);

      const result: UploadResult = {
        publicId:   uploadResult.public_id as string,
        secureUrl:  uploadResult.secure_url as string,
        bytes:      uploadResult.bytes as number,
        format:     uploadResult.format as string,
        duration:   uploadResult.duration as number | undefined,
        thumbnailUrl: type === "video"
          ? (uploadResult.secure_url as string).replace(/\.[^/.]+$/, ".jpg")
          : undefined,
      };

      if (type === "image" || type === "video") setPreview(result.secureUrl);
      setStatus("done");
      onSuccess(result);
    } catch (err) {
      setStatus("error");
      onError?.((err as Error).message ?? "Upload failed");
    }
  }, [type, folder, maxSizeMb, onSuccess, onError]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) upload(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) upload(file);
  };

  return (
    <div className={cn("w-full", className)}>
      {label && <p className="form-label">{label}</p>}

      <div
        className={cn(
          "relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 transition-colors",
          status === "uploading" ? "border-brand-300 bg-brand-50" :
          status === "done"      ? "border-emerald-300 bg-emerald-50" :
          status === "error"     ? "border-red-300 bg-red-50" :
          "border-surface-200 bg-surface-50 hover:border-brand-300 hover:bg-brand-50 cursor-pointer"
        )}
        onClick={() => status === "idle" && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept ?? TYPE_ACCEPT[type]}
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Preview */}
        {preview && status !== "uploading" && (
          <div className="mb-4 w-full max-w-xs">
            {type === "image" && (
              <img src={preview} alt="Preview" className="rounded-xl w-full object-cover max-h-40" />
            )}
            {type === "video" && (
              <div className="rounded-xl bg-gray-900 flex items-center justify-center h-24">
                <Film size={32} className="text-gray-500" />
              </div>
            )}
          </div>
        )}

        {/* State content */}
        {status === "idle" && (
          <>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
              {TYPE_ICONS[type]}
            </div>
            <p className="text-sm font-medium text-gray-700">
              {preview ? "Replace file" : `Upload ${type}`}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Drag & drop or click · Max {maxSizeMb}MB
            </p>
          </>
        )}

        {status === "uploading" && (
          <div className="w-full max-w-xs space-y-3">
            <div className="flex items-center justify-center gap-2 text-sm text-brand-600">
              <Loader2 size={16} className="animate-spin" />
              <span>Uploading… {progress}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-brand-100">
              <div
                className="h-2 rounded-full bg-brand-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {status === "done" && (
          <div className="flex flex-col items-center gap-2">
            <CheckCircle2 size={32} className="text-emerald-500" />
            <p className="text-sm font-medium text-emerald-700">Upload complete</p>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setStatus("idle"); }}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Replace
            </button>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center gap-2">
            <X size={32} className="text-red-500" />
            <p className="text-sm text-red-600">Upload failed</p>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setStatus("idle"); }}
              className="text-xs text-brand-600 hover:underline"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
