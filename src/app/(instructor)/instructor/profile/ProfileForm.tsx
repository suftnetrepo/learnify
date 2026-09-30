"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  AlertCircle, Briefcase, Camera, Check, CheckCircle2, ChevronLeft, ChevronRight, Circle, ClipboardCheck,
  Globe, Languages, Link2, Plus, Sparkles, Trash2, UserRound,
} from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { CloudinaryUploader } from "@/components/course/CloudinaryUploader";
import { TagInput } from "@/components/profile/TagInput";
import { usersApi, ApiError } from "@/lib/api-client";
import { profileSchema } from "@/lib/validation/profile";
import { cn } from "@/lib/utils";
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

const TABS = [
  { id: "basics",     label: "Basics",     icon: UserRound,      title: "Photo and basic info", sub: "Your name and headline appear on every course you teach." },
  { id: "about",      label: "About",      icon: Sparkles,       title: "About",                sub: "A short introduction for prospective students." },
  { id: "expertise",  label: "Expertise",  icon: CheckCircle2,   title: "Expertise",            sub: "Skills and topics you teach. Up to 20." },
  { id: "languages",  label: "Languages",  icon: Languages,      title: "Languages",            sub: "Languages you can teach in. Up to 10." },
  { id: "experience", label: "Experience", icon: Briefcase,      title: "Work experience",      sub: "Your most relevant roles, newest first. Up to 10." },
  { id: "links",      label: "Links",      icon: Link2,          title: "Links",                sub: "Full URLs, starting with https://" },
  { id: "review",     label: "Review",     icon: ClipboardCheck, title: "Review and save",      sub: "Check everything looks right, then save your profile." },
] as const;
type TabId = typeof TABS[number]["id"];

/** Which tab owns each validation error key (experience errors are "experience.0.company" etc.). */
function tabForError(key: string): TabId {
  const field = key.split(".")[0];
  if (["name", "headline", "location", "yearsExperience", "avatarUrl"].includes(field)) return "basics";
  if (field === "bio") return "about";
  if (field === "expertise" || field === "languages" || field === "experience") return field;
  return "links";
}

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

export function ProfileForm({ user }: ProfileFormProps) {
  const router = useRouter();
  const { success, error: showError } = useToast();
  const topRef = useRef<HTMLDivElement>(null);

  const [tab, setTab] = useState<TabId>("basics");
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
  const [errors,       setErrors]       = useState<Record<string, string>>({});

  const initials = (name || user.email).split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const tabIndex = TABS.findIndex((t) => t.id === tab);

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
        found[issue.path.join(".")] ??= issue.message;
      }
    }
    return found;
  }

  // Unsaved-changes tracking: compare against what was last saved
  const payload = buildPayload();
  const snapshot = JSON.stringify({ ...payload, avatarUrl: undefined });
  const [savedSnapshot, setSavedSnapshot] = useState(snapshot);
  const dirty = snapshot !== savedSnapshot;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const errorTabs = useMemo(() => new Set(Object.keys(errors).map(tabForError)), [errors]);

  // Completeness shown on the tab bar and the Review tab
  const complete: Record<Exclude<TabId, "review">, boolean> = {
    basics:     !!name.trim() && !!headline.trim(),
    about:      bio.trim().length >= 50,
    expertise:  expertise.length > 0,
    languages:  languages.length > 0,
    experience: experience.length > 0,
    links:      Object.values(links).some((v) => v.trim()),
  };

  function goTo(id: TabId) {
    // However Review is reached (Next, a tab click, the unsaved-changes link), it lists every problem
    if (id === "review") setErrors(validate(payload));
    setTab(id);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function next() {
    // Only block on this step's own problems; later steps are checked on Review/save
    const stepErrors = Object.entries(validate(payload)).filter(([k]) => tabForError(k) === tab);
    setErrors((prev) => {
      const kept = Object.fromEntries(Object.entries(prev).filter(([k]) => tabForError(k) !== tab));
      return { ...kept, ...Object.fromEntries(stepErrors) };
    });
    if (stepErrors.length) return;
    goTo(TABS[tabIndex + 1].id);
  }

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

  async function save() {
    const found = validate(payload);
    setErrors(found);
    if (Object.keys(found).length) {
      showError("Some fields need attention", "Fix the highlighted fields, then save again.");
      return;
    }
    setSaving(true);
    try {
      await usersApi.update(user.id, payload);
      setSavedSnapshot(snapshot);
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
  const current = TABS[tabIndex];
  const Icon = current.icon;

  return (
    <div ref={topRef} className="scroll-mt-20 space-y-5">
      {/* Step tabs */}
      <div className="overflow-x-auto">
        <div role="tablist" className="flex gap-0.5 rounded-2xl sm:gap-1 border border-surface-200 bg-white p-1.5 shadow-card">
          {TABS.map((t, i) => {
            const active  = t.id === tab;
            const hasErr  = errorTabs.has(t.id);
            const isDone  = t.id !== "review" && complete[t.id];
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => goTo(t.id)}
                aria-label={t.label}
                className={cn(
                  // Phones: inactive steps collapse to their number so all 7 fit; the active one keeps its label
                  "relative flex items-center justify-center gap-2 whitespace-nowrap rounded-xl px-2 py-2 text-sm font-medium transition-colors sm:flex-1",
                  active ? "flex-1 bg-brand-600 text-white shadow-sm" : "text-gray-500 hover:bg-surface-50 hover:text-gray-900"
                )}
              >
                <span className={cn(
                  "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                  active ? "bg-white/20 text-white"
                  : isDone ? "bg-emerald-100 text-emerald-700"
                  : "bg-surface-100 text-gray-500"
                )}>
                  {isDone && !active ? <Check size={12} strokeWidth={3} /> : i + 1}
                </span>
                <span className={cn(!active && "hidden sm:inline")}>{t.label}</span>
                {hasErr && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" aria-label="has errors" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Panel */}
      <div role="tabpanel" className="rounded-2xl border border-surface-200 bg-white shadow-card">
        <div className="flex items-start gap-3 border-b border-surface-100 px-6 py-5">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Icon size={17} /></div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-gray-900">{current.title}</p>
            <p className="mt-0.5 text-xs text-gray-400">{current.sub}</p>
          </div>
          <span className="flex-shrink-0 text-xs font-medium text-gray-400">Step {tabIndex + 1} of {TABS.length}</span>
        </div>

        <div className="p-6">
          {tab === "basics" && (
            <>
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
                  <p className="w-full text-xs text-gray-400">
                    A square photo of at least 400×400px works best. JPG, PNG or WebP, up to 5MB. Your photo saves as soon as it uploads.
                  </p>
                </div>
              </div>
              {showUploader && (
                <CloudinaryUploader
                  type="image" folder="avatars" maxSizeMb={5} className="mb-6"
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
            </>
          )}

          {tab === "about" && (
            <>
              <label htmlFor="bio" className="form-label">Bio</label>
              <textarea
                id="bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={8} maxLength={BIO_MAX}
                placeholder="What you teach, how you teach it, and what students can expect."
                className="form-input resize-none"
              />
              <div className="mt-1.5 flex justify-between text-xs">
                <span className="text-red-500">{errors.bio}</span>
                <span className={bio.length > BIO_MAX - 50 ? "text-amber-600" : "text-gray-400"}>{bio.length}/{BIO_MAX}</span>
              </div>
            </>
          )}

          {tab === "expertise" && (
            <TagInput id="expertise" value={expertise} onChange={setExpertise} max={20}
              suggestions={EXPERTISE_SUGGESTIONS} placeholder="e.g. Python" error={errors.expertise} />
          )}

          {tab === "languages" && (
            <TagInput id="languages" value={languages} onChange={setLanguages} max={10}
              suggestions={LANGUAGE_SUGGESTIONS} placeholder="e.g. English" error={errors.languages} />
          )}

          {tab === "experience" && (
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
                      onChange={(e) => updateExperience(r.key, { startYear: e.target.value })}
                      error={expErr(i, "startYear") && "Enter a valid year"} placeholder="2019" />
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
          )}

          {tab === "links" && (
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
          )}

          {tab === "review" && (
            <div className="space-y-5">
              {Object.keys(errors).length > 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-red-700"><AlertCircle size={15} />Some fields need attention</p>
                  <ul className="mt-2 space-y-1">
                    {TABS.filter((t) => errorTabs.has(t.id)).map((t) => (
                      <li key={t.id} className="text-sm text-red-600">
                        <button type="button" onClick={() => goTo(t.id)} className="font-semibold underline">{t.label}</button>
                        {": "}{Object.entries(errors).filter(([k]) => tabForError(k) === t.id).map(([, v]) => v)[0]}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex items-center gap-4 rounded-xl border border-surface-200 p-4">
                <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-full bg-brand-500">
                  {avatarUrl
                    ? <Image src={avatarUrl} alt="" fill sizes="56px" className="object-cover" />
                    : <span className="flex h-full w-full items-center justify-center font-display text-lg font-bold text-white">{initials}</span>}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">{name || "Your name"}</p>
                  <p className="truncate text-sm text-gray-500">{headline || "No headline yet"}</p>
                  {location && <p className="text-xs text-gray-400">{location}</p>}
                </div>
              </div>

              <ul className="divide-y divide-surface-100 rounded-xl border border-surface-200">
                {TABS.filter((t) => t.id !== "review").map((t) => {
                  const done = complete[t.id as Exclude<TabId, "review">];
                  const summary: Record<string, string> = {
                    basics:     headline ? "Name and headline set" : "Add a headline so students know what you do",
                    about:      bio ? `${bio.length} characters` : "No bio yet",
                    expertise:  expertise.length ? expertise.slice(0, 5).join(", ") + (expertise.length > 5 ? ` +${expertise.length - 5}` : "") : "No skills added",
                    languages:  languages.length ? languages.join(", ") : "No languages added",
                    experience: experience.length ? `${experience.length} ${experience.length === 1 ? "role" : "roles"}` : "No roles added",
                    links:      Object.values(links).filter((v) => v.trim()).length + " of 4 links",
                  };
                  return (
                    <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                      <span className={cn("flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full",
                        errorTabs.has(t.id) ? "bg-red-100 text-red-600" : done ? "bg-emerald-100 text-emerald-600" : "bg-surface-100 text-gray-400")}>
                        {errorTabs.has(t.id) ? <AlertCircle size={13} /> : done ? <Check size={13} strokeWidth={3} /> : <Circle size={11} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900">{t.label}</p>
                        <p className="truncate text-xs text-gray-400">{summary[t.id]}</p>
                      </div>
                      <button type="button" onClick={() => goTo(t.id)} className="text-xs font-semibold text-brand-600 hover:underline">Edit</button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        {/* Step navigation */}
        <div className="flex items-center justify-between gap-3 border-t border-surface-100 px-6 py-4">
          {tabIndex > 0 ? (
            <Button type="button" variant="ghost" leftIcon={<ChevronLeft size={15} />} onClick={() => goTo(TABS[tabIndex - 1].id)}>
              Previous
            </Button>
          ) : <span />}

          {tab === "review" ? (
            <div className="flex items-center gap-3">
              <span className="hidden text-xs text-gray-400 sm:inline">{dirty ? "You have unsaved changes" : "All changes saved"}</span>
              <Button type="button" onClick={save} loading={saving} disabled={!dirty && !saving}
                leftIcon={!saving ? <CheckCircle2 size={15} /> : undefined}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          ) : (
            <Button type="button" onClick={next} rightIcon={<ChevronRight size={15} />}>
              {tabIndex === TABS.length - 2 ? "Review" : "Next"}
            </Button>
          )}
        </div>
      </div>

      {dirty && tab !== "review" && (
        <p className="text-center text-xs text-amber-600">
          You have unsaved changes — they&apos;re saved together on the{" "}
          <button type="button" onClick={() => goTo("review")} className="font-semibold underline">Review</button> tab.
        </p>
      )}
    </div>
  );
}
