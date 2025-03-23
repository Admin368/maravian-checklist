"use client";

import type React from "react";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface TaskDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { title: string; parentId: string | null }) => void;
  title: string;
  initialData?: {
    id: string;
    title: string;
    parentId: string | null;
  };
  tasks: any[];
  teamId: string;
  teamName?: string;
}

export function TaskDialog({
  open,
  onClose,
  onSubmit,
  title,
  initialData,
  tasks,
  teamId,
  teamName,
}: TaskDialogProps) {
  const [taskTitle, setTaskTitle] = useState(initialData?.title || "");
  const [parentId, setParentId] = useState<string | null>(
    initialData?.parentId || null
  );
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [didInitialize, setDidInitialize] = useState(false);

  useEffect(() => {
    // Only update the form when initialData changes and dialog is first opened
    // or when editing a different task
    if (
      initialData &&
      open &&
      (!didInitialize || initialData.id !== parentId)
    ) {
      // If it has a parentId, set it (used when adding subtasks)
      if (initialData.parentId) {
        setParentId(initialData.parentId);
      } else {
        setParentId(null);
      }

      // If it has a title and we're editing, set it
      if (initialData.id && initialData.title) {
        setTaskTitle(initialData.title);
      } else if (!didInitialize) {
        // For new tasks, reset the title only on first initialization
        setTaskTitle("");
      }

      // Reset error and submission state
      setError("");
      setIsSubmitting(false);
      setDidInitialize(true);
    }
  }, [initialData, open, didInitialize, parentId]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setDidInitialize(false);
    }
  }, [open]);

  // Add logging to see what's happening
  useEffect(() => {
    if (initialData?.parentId) {
      const parent = tasks.find((t) => t.id === initialData.parentId);
    }
  }, [initialData, tasks]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!taskTitle.trim()) {
      setError("Please enter a task title");
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit({
        title: taskTitle,
        parentId,
      });

      // Don't reset form here - it will be reset when dialog closes or reopens
    } catch (error) {
      console.error("Error submitting task:", error);
      setError("Failed to save task. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {initialData?.id
              ? `Edit ${teamName ? teamName + " " : ""}Task`
              : initialData?.parentId
              ? `Add ${teamName ? teamName + " " : ""}Subtask`
              : `Add ${teamName ? teamName + " " : ""}Task`}
          </DialogTitle>
          <DialogDescription>
            {initialData?.id
              ? "Edit the task details below."
              : initialData?.parentId
              ? `Adding subtask to "${
                  tasks.find((t) => t.id === initialData.parentId)?.title || ""
                }"`
              : `Add a new task ${teamName ? "for " + teamName : ""}.`}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="title" className="text-right">
                Title
              </Label>
              <Input
                id="title"
                value={taskTitle}
                onChange={(e) => {
                  setTaskTitle(e.target.value);
                  setError("");
                }}
                className="col-span-3"
                autoFocus
                disabled={isSubmitting}
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="parent" className="text-right">
                Parent
              </Label>
              <Select
                value={parentId || "none"}
                onValueChange={(value) =>
                  setParentId(value === "none" ? null : value)
                }
                disabled={
                  // isSubmitting || !!(initialData?.parentId && !initialData?.id)
                  isSubmitting
                }
              >
                <SelectTrigger id="parent" className="col-span-3">
                  <SelectValue>
                    {parentId
                      ? tasks.find((t) => t.id === parentId)?.title ||
                        "Loading..."
                      : "None (Top Level)"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Top Level)</SelectItem>
                  {tasks
                    .filter((t) => t.id !== initialData?.id) // Prevent selecting self as parent
                    .map((task) => (
                      <SelectItem key={task.id} value={task.id}>
                        {task.title}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {error && (
              <p className="text-sm text-red-500 text-right">{error}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {initialData?.id
                    ? "Saving..."
                    : initialData?.parentId
                    ? "Adding Subtask..."
                    : "Adding..."}
                </>
              ) : initialData?.id ? (
                "Save Changes"
              ) : initialData?.parentId ? (
                "Add Subtask"
              ) : (
                "Add Task"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
