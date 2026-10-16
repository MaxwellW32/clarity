"use client";

import { useRouter } from "next/navigation";
import { CreateTaskForm } from "./create-task-form";

export function NewTaskPageForm() {
  const router = useRouter();
  return <CreateTaskForm onDone={(id) => router.push(`/tasks/${id}`)} onCancel={() => router.back()} />;
}
