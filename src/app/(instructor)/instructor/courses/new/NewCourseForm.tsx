"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  categories: { id: string; name: string }[];
}

export function NewCourseForm({ categories }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const body = {
      title:            form.get("title"),
      shortDescription: form.get("shortDescription"),
      description:      form.get("description"),
      categoryId:       form.get("categoryId"),
      format:           form.get("format"),
      level:            form.get("level"),
      language:         form.get("language") || "English",
      price:            Number(form.get("price")),
      status:           "draft",
    };

    try {
      const res  = await fetch("/api/courses", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to create course");
      router.push(`/instructor/courses/${json.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create course");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <label className="form-label">Course title <span className="text-red-500">*</span></label>
        <input name="title" required className="form-input" placeholder="e.g. Advanced TypeScript Workshop" />
      </div>

      <div>
        <label className="form-label">Short description <span className="text-red-500">*</span></label>
        <input name="shortDescription" required className="form-input" placeholder="One sentence overview" />
      </div>

      <div>
        <label className="form-label">Full description</label>
        <textarea name="description" rows={4} className="form-input resize-none" placeholder="Detailed course description..." />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">Category <span className="text-red-500">*</span></label>
          <select name="categoryId" required className="form-input">
            <option value="">Select category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label">Format <span className="text-red-500">*</span></label>
          <select name="format" required className="form-input">
            <option value="online">Online</option>
            <option value="in_person">In-person</option>
            <option value="hybrid">Hybrid</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">Level <span className="text-red-500">*</span></label>
          <select name="level" required className="form-input">
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
        <div>
          <label className="form-label">Language</label>
          <input name="language" className="form-input" defaultValue="English" />
        </div>
      </div>

      <div>
        <label className="form-label">Price (£) <span className="text-red-500">*</span></label>
        <input name="price" type="number" min="0" step="0.01" required className="form-input" placeholder="0.00" />
        <p className="mt-1 text-xs text-gray-400">Set to 0 for a free course.</p>
      </div>

      <div className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-700">
        <strong>Note:</strong> After creating your course and adding content, click &quot;Submit for approval&quot; — an admin will review and publish it. You will be notified by email.
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={loading}
          className="flex-1 rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50 transition-colors">
          {loading ? "Creating..." : "Create course"}
        </button>
      </div>
    </form>
  );
}
