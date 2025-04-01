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
import { Loader2, CalendarIcon, Clock, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import TimePicker from "./timePicker";

interface TaskDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    parentId: string | null;
    deadline?: Date | null;
    time?: string | null;
  }) => void;
  title: string;
  initialData?: {
    id: string;
    title: string;
    parentId: string | null;
    deadline?: Date | null;
    time?: string | null;
  };
  tasks: any[];
  teamId: string;
  teamName?: string;
  showDeadline?: boolean;
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
  showDeadline = false,
}: TaskDialogProps) {
  const [taskTitle, setTaskTitle] = useState(initialData?.title || "");
  const [parentId, setParentId] = useState<string | null>(
    initialData?.parentId || null
  );
  const [deadline, setDeadline] = useState<Date | null>(
    initialData?.deadline || null
  );
  const [time, setTime] = useState<string | null>(initialData?.time || null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [didInitialize, setDidInitialize] = useState(false);

  useEffect(() => {
    if (
      initialData &&
      open &&
      (!didInitialize || initialData.id !== parentId)
    ) {
      if (initialData.parentId) {
        setParentId(initialData.parentId);
      } else {
        setParentId(null);
      }

      // if (initialData.id && initialData.title) {
      // } else if (!didInitialize) {
      //   setTaskTitle("");
      //   setDeadline(null);
      //   setTime(null);
      // }
      setTaskTitle(initialData.title || "");
      setDeadline(initialData.deadline || null);
      setTime(initialData.time || null);

      setError("");
      setIsSubmitting(false);
      setDidInitialize(true);
    }
  }, [initialData, open, didInitialize, parentId]);

  useEffect(() => {
    if (!open) {
      setDidInitialize(false);
    }
  }, [open]);

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
        deadline,
        time,
      });
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
                disabled={isSubmitting}
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
                    .filter((t) => t.id !== initialData?.id)
                    .map((task) => (
                      <SelectItem key={task.id} value={task.id}>
                        {task.title}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Deadline Picker */}
            {showDeadline && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="deadline" className="text-right">
                  Deadline
                </Label>
                <div className="col-span-3 flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !deadline && "text-muted-foreground"
                        )}
                        disabled={isSubmitting}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {deadline ? format(deadline, "PPP") : "Set deadline"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={deadline || undefined}
                        onSelect={(value) => setDeadline(value || null)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10"
                    onClick={() => setDeadline(null)}
                    disabled={isSubmitting || !deadline}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Time Picker */}
            <TimePicker
              initialTime={initialData?.time || undefined}
              onChange={(time) => setTime(time || null)}
              disabled={isSubmitting}
            />

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
