"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Briefcase, Camera, CheckCircle2, Globe, Languages, Link2, Plus, Sparkles, Trash2, UserRound,
} from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { CloudinaryUploader } from "@/components/course/CloudinaryUploader";
import { TagInput } from "@/components/profile/TagInput";
import { usersApi, ApiError } from "@/lib/api-client";
import { profileSchema } from "@/lib/validation/profile";
import type { WorkExperience } from "@/db/schema";

const EXPERTISE_SUGGESTIONS = [
  "Python", "JavaScript", "React", "Node.js", "AI/ML", "Data Science", "Java", "C#", "Swift",
  "Kotlin", "PHP", "Ruby", "Go", "Rust", "SQL", "MongoDB", "AWS", "Docker",
];
const LANGUAGE_SUGGESTIONS = [
  "English", "Spanish", "French", "German", "Arabic", "Mandarin", "Hindi", "Portuguese", "Urdu",
];
const BIO_MAX = 500;
const THIS_YEAR = new Date().getFullYear();

interface ProfileFormProps {
  user: {
    id: string; name: string | null; email: string; bio: string | null; avatarUrl: string | null;
    headline: string | null; location: string | null; website: string | null;
    linkedinUrl: string | null; githubUrl: string | null; twitterUrl: string | null;
    yearsExperience: number | null; languages: string[]; expertise: string[]; experience: WorkExperience[];
  };
}

/** Experience rows keep years as strings while editing so a half-typed year isn't coerced to 0. */
type ExperienceDraft = { key: number; company: string; role: string; startYear: string; endYear: string; current: boolean };

function Section({ icon, title, sub, children }: {
  icon: React.ReactNode; title: string; sub: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-card">
      <div className="mb-5 flex items-start gap-3 border-b border-surface-100 pb-4">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">{icon}</div>
        <div><p className="text-sm font-bold text-gray-900">{title}</p><p className="mt-0.5 text-xs text-gray-400">{sub}</p></div>
      </div>
      {children}
    </div>
  );
}

export function ProfileForm({ user }: ProfileFormProps) {
  const router = useRouter();
  const { success, error: showError } = useToast();

  const [name,            setName]            = useState(user.name ?? "");
  const [headline,        setHeadline]        = useState(user.headline ?? "");
  const [location,        setLocation]        = useState(user.location ?? "");
  const [yearsExperience, setYearsExperience] = useState(user.yearsExperience?.toString() ?? "");
  const [bio,             setBio]             = useState(user.bio ?? "");
  const [avatarUrl,       setAvatarUrl]       = useState(user.avatarUrl ?? "");
  const [expertise,       setExpertise]       = useState(user.expertise);
  const [languages,       setLanguages]       = useState(user.languages);
  const [links, setLinks] = useState({
    linkedinUrl: user.linkedinUrl ?? "", githubUrl: user.githubUrl ?? "",
    twitterUrl:  user.twitterUrl  ?? "", website:   user.website   ?? "",
  });
  const [experience, setExperience] = useState<ExperienceDraft[]>(() =>
    user.experience.map((e, i) => ({
      key: i, company: e.company, role: e.role, startYear: String(e.startYear),
      endYear: e.endYear ? String(e.endYear) : "", current: e.endYear == null,
    }))
  );
  const [showUploader, setShowUploader] = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [savedAt,      setSavedAt]      = useState<Date | null>(null);
  const [errors,       setErrors]       = useState<Record<string, string>>({});

  const initials = (name || user.email).split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  function updateExperience(key: number, patch: Partial<ExperienceDraft>) {
    setExperience((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  async function saveAvatar(url: string) {
    setAvatarUrl(url);
    try {
      await usersApi.update(user.id, { avatarUrl: url });
      success(url ? "Photo updated" : "Photo removed");
      setShowUploader(false);
      router.refresh();
    } catch (e) {
      showError("Couldn't save photo", e instanceof Error ? e.message : undefined);
    }
  }

  function buildPayload() {
    return {
      name:            name.trim(),
      bio:             bio.trim(),
      avatarUrl,
      headline,
      location,
      yearsExperience: yearsExperience.trim() === "" ? null : Number(yearsExperience),
      expertise,
      languages,
      ...links,
      experience: experience.map((r) => ({
        company:   r.company,
        role:      r.role,
        startYear: Number(r.startYear),
        endYear:   r.current || r.endYear.trim() === "" ? null : Number(r.endYear),
      })),
    };
  }

  function validate(payload: ReturnType<typeof buildPayload>) {
    const found: Record<string, string> = {};
    if (!payload.name) found.name = "Name is required";
    if (payload.name.length > 100) found.name = "Name must be 100 characters or fewer";
    if (payload.bio.length > BIO_MAX) found.bio = `Bio must be ${BIO_MAX} characters or fewer`;
    const parsed = profileSchema.safeParse(payload);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".");
        found[key] ??= issue.message;
      }
    }
    return found;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = buildPayload();
    const found   = validate(payload);
    setErrors(found);
    if (Object.keys(found).length) {
      showError("Check the highlighted fields", Object.values(found)[0]);
      return;
    }

    setSaving(true);
    try {
      await usersApi.update(user.id, payload);
      setSavedAt(new Date());
      success("Profile saved", "Your public profile is up to date.");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        setErrors(Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v[0]])));
      }
      showError("Couldn't save profile", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  const expErr = (i: number, field: string) => errors[`experience.${i}.${field}`];

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {/* 1 — Photo & basics */}
      <Section icon={<UserRound size={17} />} title="Photo and basic info" sub="Your name and headline appear on every course you teach.">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-full bg-brand-500 ring-4 ring-brand-50">
            {avatarUrl ? (
              <Image src={avatarUrl} alt={name || "Profile photo"} fill sizes="96px" className="object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center font-display text-3xl font-bold text-white">{initials}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" leftIcon={<Camera size={14} />} onClick={() => setShowUploader((v) => !v)}>
              {avatarUrl ? "Change photo" : "Upload photo"}
            </Button>
            {avatarUrl && (
              <Button type="button" variant="ghost" size="sm" leftIcon={<Trash2 size={14} />} onClick={() => saveAvatar("")}>
                Remove
              </Button>
            )}
            <p className="w-full text-xs text-gray-400">A square photo of at least 400×400px works best. JPG, PNG or WebP, up to 5MB.</p>
          </div>
        </div>
        {showUploader && (
          <CloudinaryUploader
            type="image"
            folder="avatars"
            maxSizeMb={5}
            className="mb-6"
            onSuccess={(r) => saveAvatar(r.secureUrl)}
            onError={(m) => showError("Upload failed", m)}
          />
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Full name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} maxLength={100} required />
          <Input label="Headline" value={headline} onChange={(e) => setHeadline(e.target.value)} error={errors.headline}
            placeholder="Senior Python Engineer at Google" maxLength={120} />
          <Input label="Location" value={location} onChange={(e) => setLocation(e.target.value)} error={errors.location}
            placeholder="London, UK" maxLength={100} />
          <Input label="Years of experience" type="number" min={0} max={50} inputMode="numeric" value={yearsExperience}
            onChange={(e) => setYearsExperience(e.target.value)} error={errors.yearsExperience} placeholder="e.g. 8" />
        </div>
      </Section>

      {/* 2 — About */}
      <Section icon={<Sparkles size={17} />} title="About" sub="A short introduction for prospective students.">
        <label htmlFor="bio" className="form-label">Bio</label>
        <textarea
          id="bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={5} maxLength={BIO_MAX}
          placeholder="What you teach, how you teach it, and what students can expect."
          className="form-input resize-none"
        />
        <div className="mt-1.5 flex justify-between text-xs">
          <span className="text-red-500">{errors.bio}</span>
          <span className={bio.length > BIO_MAX - 50 ? "text-amber-600" : "text-gray-400"}>{bio.length}/{BIO_MAX}</span>
        </div>
      </Section>

      {/* 3 — Expertise */}
      <Section icon={<CheckCircle2 size={17} />} title="Expertise" sub="Skills and topics you teach. Up to 20.">
        <TagInput id="expertise" value={expertise} onChange={setExpertise} max={20}
          suggestions={EXPERTISE_SUGGESTIONS} placeholder="e.g. Python" error={errors.expertise} />
      </Section>

      {/* 4 — Languages */}
      <Section icon={<Languages size={17} />} title="Languages" sub="Languages you can teach in. Up to 10.">
        <TagInput id="languages" value={languages} onChange={setLanguages} max={10}
          suggestions={LANGUAGE_SUGGESTIONS} placeholder="e.g. English" error={errors.languages} />
      </Section>

      {/* 5 — Experience */}
      <Section icon={<Briefcase size={17} />} title="Work experience" sub="Your most relevant roles, newest first. Up to 10.">
        <div className="space-y-3">
          {experience.length === 0 && (
            <p className="rounded-xl border border-dashed border-surface-200 px-4 py-6 text-center text-sm text-gray-400">
              No roles added yet.
            </p>
          )}
          {experience.map((r, i) => (
            <div key={r.key} className="rounded-xl border border-surface-200 bg-surface-50/60 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Company" value={r.company} onChange={(e) => updateExperience(r.key, { company: e.target.value })}
                  error={expErr(i, "company")} maxLength={100} placeholder="Google" />
                <Input label="Role / title" value={r.role} onChange={(e) => updateExperience(r.key, { role: e.target.value })}
                  error={expErr(i, "role")} maxLength={100} placeholder="Senior Engineer" />
                <Input label="Start year" type="number" inputMode="numeric" min={1950} max={THIS_YEAR} value={r.startYear}
                  onChange={(e) => updateExperience(r.key, { startYear: e.target.value })} error={expErr(i, "startYear") && "Enter a valid year"} placeholder="2019" />
                <div>
                  <Input label="End year" type="number" inputMode="numeric" min={1950} max={THIS_YEAR} value={r.current ? "" : r.endYear}
                    disabled={r.current} onChange={(e) => updateExperience(r.key, { endYear: e.target.value })}
                    error={expErr(i, "endYear")} placeholder={r.current ? "Present" : "2023"} />
                  <label className="mt-2 flex w-fit cursor-pointer items-center gap-2 text-xs text-gray-600">
                    <input type="checkbox" checked={r.current} onChange={(e) => updateExperience(r.key, { current: e.target.checked })}
                      className="h-4 w-4 rounded border-surface-300 text-brand-600 focus:ring-brand-200" />
                    I currently work here
                  </label>
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <button type="button" onClick={() => setExperience((rows) => rows.filter((x) => x.key !== r.key))}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-500 hover:text-red-700">
                  <Trash2 size={13} /> Remove
                </button>
              </div>
            </div>
          ))}
          {experience.length < 10 && (
            <Button type="button" variant="secondary" size="sm" leftIcon={<Plus size={14} />}
              onClick={() => setExperience((rows) => [...rows, {
                key: Math.max(0, ...rows.map((x) => x.key)) + 1, company: "", role: "", startYear: "", endYear: "", current: false,
              }])}>
              Add experience
            </Button>
          )}
          {errors.experience && <p className="text-xs text-red-500">{errors.experience}</p>}
        </div>
      </Section>

      {/* 6 — Links */}
      <Section icon={<Link2 size={17} />} title="Links" sub="Full URLs, starting with https://">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="LinkedIn" value={links.linkedinUrl} onChange={(e) => setLinks({ ...links, linkedinUrl: e.target.value })}
            error={errors.linkedinUrl} placeholder="https://linkedin.com/in/you" inputMode="url" />
          <Input label="GitHub" value={links.githubUrl} onChange={(e) => setLinks({ ...links, githubUrl: e.target.value })}
            error={errors.githubUrl} placeholder="https://github.com/you" inputMode="url" />
          <Input label="Twitter / X" value={links.twitterUrl} onChange={(e) => setLinks({ ...links, twitterUrl: e.target.value })}
            error={errors.twitterUrl} placeholder="https://x.com/you" inputMode="url" />
          <Input label="Personal website" value={links.website} onChange={(e) => setLinks({ ...links, website: e.target.value })}
            error={errors.website} placeholder="https://yoursite.com" inputMode="url" leftElement={<Globe size={15} />} />
        </div>
      </Section>

      {/* Save */}
      <div className="flex flex-col-reverse items-center justify-between gap-3 rounded-2xl border border-surface-200 bg-white px-6 py-4 shadow-card sm:flex-row">
        <p className="text-xs text-gray-400">
          {savedAt ? `Saved at ${savedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : "Changes are saved together when you click Save."}
        </p>
        <Button type="submit" loading={saving} leftIcon={!saving ? <CheckCircle2 size={15} /> : undefined}>
          {saving ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </form>
  );
}
