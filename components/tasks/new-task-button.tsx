"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTaskActions } from "./task-actions";

export function NewTaskButton({ variant = "default" }: { variant?: "default" | "outline" }) {
  const { openCreate } = useTaskActions();
  return (
    <Button variant={variant} onClick={openCreate}>
      <Plus aria-hidden />
      New task
      <kbd className="ml-1 hidden rounded border border-current/20 px-1 font-sans text-[10px] opacity-60 sm:inline">N</kbd>
    </Button>
  );
}
