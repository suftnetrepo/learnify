/**
 * Course handout (the course book / handbook an admin uploads in the course editor).
 *
 * Students never get the raw Cloudinary URL: Cloudinary refuses public delivery of PDFs on
 * this account ("deny or ACL failure"), and the file should only reach people on the course.
 * Links point at /api/courses/[id]/handout, which checks access and redirects to a
 * short-lived signed download.
 */

export const handoutDownloadPath = (courseId: string) => `/api/courses/${courseId}/handout`;
export const facilitatorHandbookDownloadPath = (courseId: string) =>
  `/api/courses/${courseId}/facilitator-handbook`;

/** File extension from a URL path, e.g. ".../abc.pdf" → "pdf". */
function extensionFromUrl(url: string | null | undefined): string {
  if (!url) return "";
  try {
    const last = new URL(url).pathname.split("/").pop() ?? "";
    const dot = last.lastIndexOf(".");
    return dot > 0 ? last.slice(dot + 1).toLowerCase() : "";
  } catch {
    return "";
  }
}

/**
 * Name to show for a handout. Uploads saved before the fix were named "<file>.undefined"
 * (raw Cloudinary uploads have no `format`), so repair that from the URL's extension.
 */
export function handoutDisplayName(name: string | null | undefined, url: string | null | undefined): string {
  const ext = extensionFromUrl(url);
  const base = (name ?? "").replace(/\.(undefined|null)$/i, "").trim();
  if (!base) return ext ? `Course handbook.${ext}` : "Course handbook";
  return ext && !base.toLowerCase().endsWith(`.${ext}`) && !/\.[a-z0-9]{2,5}$/i.test(base) ? `${base}.${ext}` : base;
}

/** Name to store for a fresh upload: original filename + a real extension. */
export function handoutNameForUpload(originalFilename: string | undefined, format: string | undefined, url: string): string {
  const ext = format || extensionFromUrl(url);
  const base = originalFilename?.trim() || "Course handbook";
  return ext && !base.toLowerCase().endsWith(`.${ext.toLowerCase()}`) ? `${base}.${ext}` : base;
}

export interface CloudinaryAsset {
  resourceType: "image" | "video" | "raw";
  type:         string;   // upload | private | authenticated
  publicId:     string;   // raw public_ids keep their extension
  format:       string;   // "" for raw
}

/** Parse https://res.cloudinary.com/<cloud>/<resource_type>/<type>/[v123/]<public_id>. */
export function parseCloudinaryUrl(url: string): CloudinaryAsset | null {
  let path: string[];
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith("res.cloudinary.com")) return null;
    path = decodeURIComponent(u.pathname).split("/").filter(Boolean);
  } catch {
    return null;
  }
  const [, resourceType, type, ...rest] = path;
  if (!["image", "video", "raw"].includes(resourceType) || !type || rest.length === 0) return null;
  if (/^v\d+$/.test(rest[0])) rest.shift();
  const full = rest.join("/");
  if (resourceType === "raw") return { resourceType: "raw", type, publicId: full, format: "" };
  const dot = full.lastIndexOf(".");
  return dot > 0
    ? { resourceType: resourceType as "image" | "video", type, publicId: full.slice(0, dot), format: full.slice(dot + 1) }
    : { resourceType: resourceType as "image" | "video", type, publicId: full, format: "" };
}
