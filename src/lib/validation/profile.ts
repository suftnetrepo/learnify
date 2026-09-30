import { z } from "zod";

/** Optional URL: "" clears the field (stored as null), anything else must be http(s). */
const optionalUrl = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === "" || /^https?:\/\/[^\s.]+\.[^\s]+$/i.test(v), "Must be a full URL starting with https://")
  .transform((v) => (v === "" ? null : v));

const optionalText = (max: number) =>
  z.string().trim().max(max).transform((v) => (v === "" ? null : v));

const tagList = (max: number, label: string) =>
  z
    .array(z.string().trim().min(1).max(40))
    .max(max, `Up to ${max} ${label}`)
    // de-duplicate case-insensitively, keeping the first spelling
    .transform((tags) => tags.filter((t, i) => tags.findIndex((x) => x.toLowerCase() === t.toLowerCase()) === i));

const thisYear = new Date().getFullYear();

export const workExperienceSchema = z
  .object({
    company:   z.string().trim().min(1, "Company is required").max(100),
    role:      z.string().trim().min(1, "Role is required").max(100),
    startYear: z.number().int().min(1950).max(thisYear),
    endYear:   z.number().int().min(1950).max(thisYear).nullable().optional(),
  })
  .refine((e) => e.endYear == null || e.endYear >= e.startYear, {
    message: "End year can't be before start year",
    path:    ["endYear"],
  });

/** Public profile fields a user can edit on themselves (admins on anyone). */
export const profileSchema = z.object({
  avatarUrl:       optionalUrl,
  headline:        optionalText(120),
  location:        optionalText(100),
  website:         optionalUrl,
  linkedinUrl:     optionalUrl,
  githubUrl:       optionalUrl,
  twitterUrl:      optionalUrl,
  yearsExperience: z.number().int().min(0).max(50).nullable(),
  languages:       tagList(10, "languages"),
  expertise:       tagList(20, "skills"),
  experience:      z.array(workExperienceSchema).max(10, "Up to 10 roles"),
}).partial();

export type ProfileInput = z.input<typeof profileSchema>;
type ProfileOutput = z.output<typeof profileSchema>;
/** What the form sends ("" clears) or the API stores (null) — either is valid in an update payload. */
export type ProfilePayload = { [K in keyof ProfileOutput]?: ProfileInput[K] | ProfileOutput[K] };
