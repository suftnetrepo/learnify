import { v2 as cloudinary } from "cloudinary";

if (!process.env.CLOUDINARY_CLOUD_NAME) {
  throw new Error("CLOUDINARY_CLOUD_NAME is not set");
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
});

export { cloudinary };

// ─── Signed upload parameters ─────────────────────────────────────────────────
// Never expose api_secret to the browser — generate a signed upload signature
// server-side and send only the params the browser needs.
export function generateSignedUploadParams(options: {
  folder:        string;
  resourceType?: "video" | "image" | "raw";
  maxFileSize?:  number; // bytes
}) {
  const timestamp = Math.round(Date.now() / 1000);
  const folder    = options.folder;

  const paramsToSign: Record<string, string | number> = {
    timestamp,
    folder,
  };

  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    process.env.CLOUDINARY_API_SECRET!
  );

  return {
    signature,
    timestamp,
    folder,
    cloudName:  process.env.CLOUDINARY_CLOUD_NAME,
    apiKey:     process.env.CLOUDINARY_API_KEY,
    resourceType: options.resourceType ?? "image",
  };
}

// ─── Delete asset ─────────────────────────────────────────────────────────────
export async function deleteCloudinaryAsset(
  publicId:     string,
  resourceType: "video" | "image" | "raw" = "video"
) {
  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}

// ─── Build streaming URL ──────────────────────────────────────────────────────
export function buildVideoUrl(publicId: string, options?: { quality?: string }) {
  return cloudinary.url(publicId, {
    resource_type: "video",
    format:        "m3u8",      // HLS adaptive streaming
    quality:       options?.quality ?? "auto",
    secure:        true,
  });
}

export function buildThumbnailUrl(publicId: string) {
  return cloudinary.url(publicId, {
    resource_type:  "video",
    format:         "jpg",
    transformation: [{ width: 1280, height: 720, crop: "fill", start_offset: "auto" }],
    secure:         true,
  });
}
