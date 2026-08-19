"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { useMutation } from "./useApi";
import { coursesApi } from "@/lib/api-client";
import type { CreateCoursePayload, UpdateCoursePayload, CreateLecturePayload, UpdateLecturePayload, CreateSectionPayload } from "@/types";

export function useCourseForm(courseId?: string) {
  const router = useRouter();
  const { success, error } = useToast();

  const createMut = useMutation(coursesApi.create, {
    onError: (msg) => error("Failed to create course", msg),
  });

  const updateMut = useMutation(
    (payload: UpdateCoursePayload) => coursesApi.update(courseId!, payload),
    {
      onSuccess: () => { success("Changes saved"); router.refresh(); },
      onError:   (msg) => error("Failed to save", msg),
    }
  );

  const deleteMut = useMutation(
    () => coursesApi.remove(courseId!),
    {
      onSuccess: () => { success("Course removed"); router.push("/admin/courses"); },
      onError:   (msg) => error("Failed to delete", msg),
    }
  );

  const save = useCallback(async (payload: CreateCoursePayload | UpdateCoursePayload) => {
    if (courseId) return updateMut.mutate(payload as UpdateCoursePayload);
    const res = await createMut.mutate(payload as CreateCoursePayload);
    if (res) {
      success("Course created", "Add sections and lectures from the content manager.");
      router.push(`/admin/courses/${res.id}`);
    }
    return res;
  }, [courseId, createMut, updateMut, success, router]);

  return {
    save,
    deleteCourse: deleteMut.mutate,
    loading:      createMut.loading || updateMut.loading,
    error:        createMut.error   ?? updateMut.error,
  };
}

export function useSections(courseId: string) {
  const router = useRouter();
  const { success, error } = useToast();

  const createMut = useMutation(
    (data: CreateSectionPayload) => coursesApi.createSection(courseId, data),
    { onError: (msg) => error("Failed to create section", msg) }
  );

  const updateMut = useMutation(
    ({ id, data }: { id: string; data: Partial<CreateSectionPayload> }) =>
      coursesApi.updateSection(id, data),
    { onError: (msg) => error("Failed to update section", msg) }
  );

  const deleteMut = useMutation(coursesApi.deleteSection, {
    onError: (msg) => error("Failed to delete section", msg),
  });

  const createSection = useCallback(async (data: CreateSectionPayload) => {
    const res = await createMut.mutate(data);
    if (res) { success("Section created"); router.refresh(); }
    return res;
  }, [createMut, success, router]);

  const updateSection = useCallback(
    (id: string, data: Partial<CreateSectionPayload>) =>
      updateMut.mutate({ id, data }),
    [updateMut]
  );

  const deleteSection = useCallback(async (id: string) => {
    const res = await deleteMut.mutate(id);
    if (res !== null) { success("Section deleted"); router.refresh(); }
    return res;
  }, [deleteMut, success, router]);

  return {
    createSection,
    updateSection,
    deleteSection,
    creating: createMut.loading,
    deleting: deleteMut.loading,
  };
}

export function useLectures() {
  const router = useRouter();
  const { success, error } = useToast();

  const createMut = useMutation(
    ({ sectionId, data }: { sectionId: string; data: CreateLecturePayload }) =>
      coursesApi.createLecture(sectionId, data),
    { onError: (msg) => error("Failed to add lecture", msg) }
  );

  const updateMut = useMutation(
    ({ id, data }: { id: string; data: UpdateLecturePayload }) =>
      coursesApi.updateLecture(id, data),
    { onError: (msg) => error("Failed to update lecture", msg) }
  );

  const deleteMut = useMutation(coursesApi.deleteLecture, {
    onError: (msg) => error("Failed to delete lecture", msg),
  });

  const createLecture = useCallback(async (sectionId: string, data: CreateLecturePayload) => {
    const res = await createMut.mutate({ sectionId, data });
    if (res) success("Lecture added");
    return res;
  }, [createMut, success]);

  const updateLecture = useCallback(async (id: string, data: UpdateLecturePayload) => {
    const res = await updateMut.mutate({ id, data });
    if (res) { success("Lecture updated"); router.refresh(); }
    return res;
  }, [updateMut, success, router]);

  const deleteLecture = useCallback(async (id: string) => {
    const res = await deleteMut.mutate(id);
    if (res !== null) { success("Lecture deleted"); router.refresh(); }
    return res;
  }, [deleteMut, success, router]);

  const togglePublished = useCallback(
    (id: string, isPublished: boolean) =>
      updateMut.mutate({ id, data: { isPublished } }),
    [updateMut]
  );

  return {
    createLecture,
    updateLecture,
    deleteLecture,
    togglePublished,
    creating: createMut.loading,
    updating: updateMut.loading,
    deleting: deleteMut.loading,
  };
}
