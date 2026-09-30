import { cache } from "react";
import { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { BookOpen, Briefcase, Languages, MapPin, Star, Users } from "lucide-react";
import { auth } from "@/lib/auth";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { TutorAvatar } from "@/components/profile/TutorAvatar";
import { SocialLinks } from "@/components/profile/SocialLinks";
import { TutorService } from "@/services";
import { formatCurrency } from "@/lib/utils";

interface Props { params: Promise<{ id: string }> }

// generateMetadata and the page both need the profile — fetch it once per request
const getProfile = cache((id: string) => TutorService.getPublicProfile(id));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const profile = await getProfile(id);
  if (!profile) return { title: "Tutor not found" };
  const { tutor } = profile;
  const description = tutor.headline ?? tutor.bio?.slice(0, 160) ?? undefined;
  return {
    title:       tutor.name ?? "Tutor",
    description,
    openGraph: {
      title:       tutor.name ?? "Tutor",
      description,
      type:        "profile",
      images:      tutor.avatarUrl ? [{ url: tutor.avatarUrl }] : [],
    },
  };
}

export default async function TutorProfilePage({ params }: Props) {
  const { id } = await params;
  const [profile, session] = await Promise.all([getProfile(id), auth()]);
  if (!profile) notFound();

  const { tutor, courses, stats } = profile;
  const experience = [...(tutor.experience ?? [])].sort(
    (a, b) => (b.endYear ?? 9999) - (a.endYear ?? 9999) || b.startYear - a.startYear
  );

  return (
    <div className="min-h-screen bg-white">
      <Navbar session={session} />

      {/* Header */}
      <section className="border-b border-surface-100 bg-surface-50">
        <div className="container py-10 lg:py-12">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <TutorAvatar name={tutor.name} avatarUrl={tutor.avatarUrl} size={96} className="ring-4 ring-white shadow-card" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-widest text-brand-600">Instructor</p>
              <h1 className="mt-1 font-display text-3xl font-extrabold text-gray-900">{tutor.name}</h1>
              {tutor.headline && <p className="mt-1 text-base text-gray-600">{tutor.headline}</p>}

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-gray-500">
                {tutor.location && (
                  <span className="flex items-center gap-1.5"><MapPin size={14} />{tutor.location}</span>
                )}
                {tutor.yearsExperience != null && (
                  <span className="flex items-center gap-1.5">
                    <Briefcase size={14} />{tutor.yearsExperience} {tutor.yearsExperience === 1 ? "year" : "years"} experience
                  </span>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm font-medium text-gray-700">
                <span className="flex items-center gap-1.5"><BookOpen size={14} className="text-brand-500" />{stats.courses} {stats.courses === 1 ? "course" : "courses"}</span>
                <span className="flex items-center gap-1.5"><Users size={14} className="text-brand-500" />{stats.students.toLocaleString()} {stats.students === 1 ? "student" : "students"}</span>
                {stats.rating != null && (
                  <span className="flex items-center gap-1.5">
                    <Star size={14} className="fill-amber-400 text-amber-400" />
                    {stats.rating.toFixed(1)} <span className="font-normal text-gray-400">({stats.reviews} {stats.reviews === 1 ? "review" : "reviews"})</span>
                  </span>
                )}
              </div>
            </div>
            <SocialLinks
              linkedinUrl={tutor.linkedinUrl} githubUrl={tutor.githubUrl}
              twitterUrl={tutor.twitterUrl} website={tutor.website}
              className="sm:self-start"
            />
          </div>
        </div>
      </section>

      <div className="container py-10">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_340px]">
          {/* Main */}
          <div className="space-y-10">
            <section>
              <h2 className="font-display text-xl font-bold text-gray-900">About</h2>
              <p className="mt-3 whitespace-pre-line leading-relaxed text-gray-600">
                {tutor.bio || `${tutor.name ?? "This tutor"} hasn't added a bio yet.`}
              </p>
            </section>

            {!!tutor.expertise?.length && (
              <section>
                <h2 className="font-display text-xl font-bold text-gray-900">Expertise</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {tutor.expertise.map((t) => (
                    <span key={t} className="rounded-lg bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-700">{t}</span>
                  ))}
                </div>
              </section>
            )}

            {!!tutor.languages?.length && (
              <section>
                <h2 className="flex items-center gap-2 font-display text-xl font-bold text-gray-900"><Languages size={18} className="text-gray-400" />Languages</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {tutor.languages.map((l) => (
                    <span key={l} className="rounded-lg border border-surface-200 px-3 py-1.5 text-sm text-gray-700">{l}</span>
                  ))}
                </div>
              </section>
            )}

            {experience.length > 0 && (
              <section>
                <h2 className="font-display text-xl font-bold text-gray-900">Experience</h2>
                <ol className="mt-4 space-y-0">
                  {experience.map((e, i) => (
                    <li key={`${e.company}-${e.startYear}-${i}`} className="relative flex gap-4 pb-6 last:pb-0">
                      {/* Timeline rail */}
                      {i < experience.length - 1 && <span className="absolute left-[7px] top-5 h-full w-px bg-surface-200" aria-hidden />}
                      <span className={`relative mt-1.5 h-[15px] w-[15px] flex-shrink-0 rounded-full border-2 ${e.endYear == null ? "border-brand-500 bg-brand-100" : "border-surface-300 bg-white"}`} />
                      <div>
                        <p className="font-semibold text-gray-900">{e.role}</p>
                        <p className="text-sm text-gray-600">{e.company}</p>
                        <p className="mt-0.5 text-xs text-gray-400">{e.startYear} – {e.endYear ?? "Present"}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </div>

          {/* Courses */}
          <aside>
            <h2 className="font-display text-lg font-bold text-gray-900">Courses by {tutor.name?.split(" ")[0] ?? "this tutor"}</h2>
            {courses.length === 0 ? (
              <p className="mt-3 rounded-2xl border border-dashed border-surface-200 px-4 py-8 text-center text-sm text-gray-400">
                No published courses yet.
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                {courses.map((c) => {
                  const rating = Number(c.averageRating ?? 0);
                  return (
                    <div key={c.id} className="overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-card">
                      <div className="relative aspect-video bg-gradient-to-br from-brand-100 to-violet-100">
                        {c.thumbnailUrl ? (
                          <Image src={c.thumbnailUrl} alt={c.title} fill sizes="340px" className="object-cover" />
                        ) : (
                          <BookOpen size={28} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-brand-300" />
                        )}
                      </div>
                      <div className="p-4">
                        <p className="font-semibold leading-snug text-gray-900">{c.title}</p>
                        <div className="mt-2 flex items-center justify-between text-sm">
                          <span className="font-bold text-gray-900">{Number(c.price) === 0 ? "Free" : formatCurrency(Number(c.price))}</span>
                          {(c.reviewCount ?? 0) > 0 ? (
                            <span className="flex items-center gap-1 text-gray-600">
                              <Star size={13} className="fill-amber-400 text-amber-400" />{rating.toFixed(1)}
                              <span className="text-gray-400">({c.reviewCount})</span>
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">No reviews yet</span>
                          )}
                        </div>
                        <Link
                          href={`/courses/${c.slug}`}
                          className="mt-3 flex w-full items-center justify-center rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
                        >
                          View course
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </aside>
        </div>
      </div>

      <Footer />
    </div>
  );
}
