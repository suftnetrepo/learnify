"use client";

import { useState, useCallback } from "react";
import { useToast } from "@/components/ui/Toast";
import { uploadApi } from "@/lib/api-client";

export interface UploadResult {
  publicId:     string;
  secureUrl:    string;
  duration?:    number;
  bytes:        number;
  format:       string;
  thumbnailUrl?: string;
}

type UploadType   = "video" | "image" | "document";
type UploadFolder = "lectures" | "thumbnails" | "resources" | "avatars";

export function useUpload(type: UploadType, folder: UploadFolder) {
  const { error } = useToast();
  const [progress, setProgress] = useState(0);
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState<UploadResult | null>(null);

  const upload = useCallback(async (file: File, maxSizeMb = 500): Promise<UploadResult | null> => {
    if (file.size > maxSizeMb * 1024 * 1024) {
      error("File too large", `Maximum size is ${maxSizeMb}MB`);
      return null;
    }

    setLoading(true);
    setProgress(0);
    setResult(null);

    try {
      const params = await uploadApi.getSignedParams(type, folder);
      const { signature, timestamp, apiKey, cloudName, folder: cloudFolder, resourceType } = params;

      const formData = new FormData();
      formData.append("file",      file);
      formData.append("api_key",   apiKey);
      formData.append("timestamp", String(timestamp));
      formData.append("signature", signature);
      formData.append("folder",    cloudFolder);

      const uploadResult = await new Promise<Record<string, unknown>>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        });
        xhr.open("POST", `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`);
        xhr.onload  = () => {
          try { resolve(JSON.parse(xhr.responseText)); }
          catch { reject(new Error("Invalid response from Cloudinary")); }
        };
        xhr.onerror = () => reject(new Error("Upload failed — check your connection"));
        xhr.send(formData);
      });

      if (uploadResult.error) {
        throw new Error((uploadResult.error as { message: string }).message);
      }

      const res: UploadResult = {
        publicId:    uploadResult.public_id as string,
        secureUrl:   uploadResult.secure_url as string,
        bytes:       uploadResult.bytes      as number,
        format:      uploadResult.format     as string,
        duration:    uploadResult.duration   as number | undefined,
        thumbnailUrl: type === "video"
          ? (uploadResult.secure_url as string).replace(/\.[^/.]+$/, ".jpg")
          : undefined,
      };

      setResult(res);
      return res;
    } catch (err) {
      error("Upload failed", err instanceof Error ? err.message : "Please try again");
      return null;
    } finally {
      setLoading(false);
    }
  }, [type, folder, error]);

  const reset = useCallback(() => { setProgress(0); setResult(null); }, []);

  return { upload, loading, progress, result, reset };
}
