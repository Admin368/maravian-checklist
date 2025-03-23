"use client";

import { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Pencil,
  Trash2,
  Plus,
  ChevronRight,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  MoreVertical,
  Copy,
  UserCircle,
  CalendarClock,
  Users,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/trpc/client";
import { useUser } from "./user-provider";
import { cn } from "@/lib/utils";
import { TaskCompletionModal } from "./task-completion-modal";
import { format } from "date-fns";
import { toast } from "sonner";
import { TaskAssignmentDialog } from "./task-assignment-dialog";
// import { TaskCompletion } from "@prisma/client";
import { serverGetTeamMembersReturnType } from "@/server/api/routers/users";
import {
  serverGetCompletionsReturnType,
  serverGetTasksReturnType,
} from "@/server/api/routers/tasks";
// import { Task } from "@prisma/client";
import { TaskCompletionTime } from "./task-completion-time";

interface TaskItemProps {
  task: serverGetTasksReturnType;
  tasks: serverGetTasksReturnType[];
  completions: serverGetCompletionsReturnType[];
  teamMembers: serverGetTeamMembersReturnType[];
  selectedDate: string | Date;
  level?: number;
  onAddSubtask?: (parentId: string) => void;
  onEditTask?: (task: serverGetTasksReturnType) => void;
  onDeleteTask?: (taskId: string) => void;
  onMoveTask?: (taskId: string, direction: "up" | "down") => void;
  className?: string;
  refetch?: () => void;
  dragHandleProps?: Record<string, any>;
  isAdmin?: boolean;
  hideTools?: boolean;
  hideNotAssignedToMe?: boolean;
  isCheckedIn: boolean;
  showReorderButtons?: boolean;
}

export function TaskItem({
  task,
  tasks,
  completions,
  teamMembers,
  selectedDate,
  level = 0,
  onAddSubtask,
  onEditTask,
  onDeleteTask,
  onMoveTask,
  className,
  refetch,
  dragHandleProps,
  isAdmin,
  hideTools,
  hideNotAssignedToMe,
  isCheckedIn,
  showReorderButtons = false,
}: TaskItemProps) {
  const { userId } = useUser();
  const [expanded, setExpanded] = useState(true);
  const [isCompleted, setIsCompleted] = useState(false);
  const [completedBy, setCompletedBy] = useState<string | null>(null);
  const [completedAt, setCompletedAt] = useState<Date | null>(null);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [pendingCompletion, setPendingCompletion] = useState<boolean | null>(
    null
  );
  const [showAssignmentDialog, setShowAssignmentDialog] = useState(false);
  const today = format(new Date(), "yyyy-MM-dd");
  const teamId = task.teamId || "";

  // Check if current user is admin
  // let isAdmin = teamMembers?.find(
  //   (member) =>
  //     member.id === userId &&
  //     member.role &&
  //     (member.role === "admin" || member.role === "owner")
  // );
  // let isAdmin = true;

  const toggleCompletion = api.completions.toggle.useMutation({
    onError: (error) => {
      console.error("Failed to toggle completion:", error);
      toast.error("Error", {
        description:
          error.message === "You must check in before completing tasks"
            ? "Please check in for today before completing tasks"
            : "Failed to update task status. Please try again.",
      });
      // Revert optimistic update
      setIsCompleted(!isCompleted);
    },
  });

  // Get child tasks
  const childTasks = tasks
    .filter((t) => t.parentId === task.id)
    .sort((a, b) => a.position - b.position);

  // Get sibling tasks (tasks at the same level)
  const siblingTasks = tasks
    .filter((t) => t.parentId === task.parentId)
    .sort((a, b) => a.position - b.position);

  const currentIndex = siblingTasks.findIndex((t) => t.id === task.id);
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === siblingTasks.length - 1;

  // Check if task is completed and who completed it
  useEffect(() => {
    if (!completions || !teamMembers) return;

    // For checklist items (selectedDate === "*"), find completion without a date
    const completion = completions.find((c) => {
      if (selectedDate === "*") {
        // For checklists, find the completion without a date or with a null date
        return (
          c.taskId === task.id &&
          (!c.completionDate || c.completionDate === null)
        );
      } else {
        // For regular tasks, match the date
        return c.taskId === task.id;
      }
    });

    if (completion) {
      setIsCompleted(true);
      setCompletedBy(completion.userId);
      // Try to use completedAt first, then fall back to completionDate or creation time
      setCompletedAt(
        completion.completedAt
          ? new Date(completion.completedAt)
          : completion.completionDate
          ? new Date(completion.completionDate)
          : new Date()
      );
    } else {
      setIsCompleted(false);
      setCompletedBy(null);
      setCompletedAt(null);
    }
  }, [completions, task.id, teamMembers, selectedDate]);

  // Get completer's name
  const completerName = completedBy
    ? teamMembers?.find((m) => m.id === completedBy)?.name || "Unknown User"
    : null;

  const handleCheckboxChange = async (checked: boolean | "indeterminate") => {
    if (checked === "indeterminate") return;

    // For normal tasks, require a check-in and show a confirmation modal
    if (selectedDate !== "*") {
      // Store the pending completion state and show confirmation modal
      setPendingCompletion(checked);
      setShowCompletionModal(true);
      return;
    }

    // For checklist items (no date required), directly complete without confirmation
    // Get current date or "*" for checklists
    const date =
      selectedDate === "*"
        ? undefined
        : typeof selectedDate === "string"
        ? selectedDate
        : format(selectedDate, "yyyy-MM-dd");

    // Optimistic update
    setIsCompleted(!!checked);
    setCompletedBy(checked ? userId : null);
    setCompletedAt(checked ? new Date() : null);

    try {
      await toggleCompletion.mutateAsync({
        userId: userId!,
        taskId: task.id,
        date: date,
        completed: !!checked,
        isChecklist: selectedDate === "*",
      });
      refetch?.();
    } catch (error) {
      console.error("Failed to toggle task completion:", error);
      // Revert optimistic update
      setIsCompleted(!checked);
      setCompletedBy(checked ? null : userId);
      setCompletedAt(null);

      toast.error("Error", {
        description: "Failed to update task status. Please try again.",
      });
    }
  };

  const handleConfirmCompletion = () => {
    if (pendingCompletion !== null) {
      // Get current date for regular tasks
      const date =
        typeof selectedDate === "string"
          ? selectedDate
          : format(selectedDate, "yyyy-MM-dd");

      // Optimistic update
      setIsCompleted(!!pendingCompletion);
      setCompletedBy(pendingCompletion ? userId : null);
      setCompletedAt(pendingCompletion ? new Date() : null);

      // Call the API to update the task status
      toggleCompletion
        .mutateAsync({
          userId: userId!,
          taskId: task.id,
          date: date,
          completed: !!pendingCompletion,
          isChecklist: false,
        })
        .then(() => {
          refetch?.();
        })
        .catch((error) => {
          console.error("Failed to toggle task completion:", error);
          // Revert optimistic update
          setIsCompleted(!pendingCompletion);
          setCompletedBy(pendingCompletion ? null : userId);
          setCompletedAt(null);

          toast.error("Error", {
            description:
              error.message ||
              "Failed to update task status. Please try again.",
          });
        });
    }
    setShowCompletionModal(false);
    setPendingCompletion(null);
  };

  const handleCancelCompletion = () => {
    setShowCompletionModal(false);
    setPendingCompletion(null);
    // Reset UI state if needed
    if (pendingCompletion) {
      setIsCompleted(false);
    }
  };

  // Get assigned users
  const assignedUsers =
    task.assignments
      ?.map((assignment) => {
        const user = teamMembers.find(
          (member) => member.id === assignment.userId
        );
        return user;
      })
      .filter(Boolean) || [];

  const isThisTaskAssignedToMe = assignedUsers.some(
    (user) => user?.id === userId
  );
  if (!isThisTaskAssignedToMe && hideNotAssignedToMe && !childTasks.length) {
    return null;
  }

  // Function to copy task title to clipboard
  const copyTaskToClipboard = () => {
    if (navigator?.clipboard && window !== undefined) {
      navigator.clipboard
        .writeText(task.title)
        .then(() => {
          toast.success("Copied to clipboard", {
            description: "Task text copied to clipboard",
          });
        })
        .catch((err) => {
          console.error("Failed to copy text: ", err);
          toast.error("Failed to copy", {
            description: "Could not copy text to clipboard",
          });
        });
    }
  };

  return (
    <div
      className={cn(
        "group relative rounded-lg border pb-2",
        isCompleted ? "border-muted bg-muted/20" : "border-border",
        className
      )}
      style={{ marginLeft: `${level * 20}px` }}
      id={`task-${task.id}`}
    >
      <div className="flex items-center p-3">
        <div className="flex-1 flex items-center min-w-0">
          {/* Expand/collapse button for parent tasks */}
          {!!childTasks.length && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 mr-1 text-muted-foreground"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          )}

          {/* Empty space to align tasks without children */}
          {!childTasks.length && (
            <div className="w-7" /> // This ensures alignment with parent tasks
          )}

          {/* Checkbox */}
          <div className="mr-2">
            <Checkbox
              id={`task-checkbox-${task.id}`}
              checked={isCompleted}
              disabled={!isCheckedIn}
              onCheckedChange={handleCheckboxChange}
            />
          </div>

          {/* Task title */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center">
              <span
                className={cn(
                  "truncate text-sm",
                  isCompleted && "line-through text-muted-foreground"
                )}
              >
                {task.title}
              </span>

              {/* Add badge for checklist items when they appear in regular task lists */}
              {(task as any).type === "checklist" && selectedDate !== "*" && (
                <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                  Checklist
                </span>
              )}
            </div>

            {isCompleted && completerName && (
              <div className="text-xs text-muted-foreground flex items-center mt-1">
                <UserCircle className="h-3 w-3 mr-1" />
                <span>
                  Completed by {completerName}{" "}
                  {completedAt && format(completedAt, "h:mm a")}
                </span>
              </div>
            )}

            {/* Display assigned users */}
            {assignedUsers.length > 0 && (
              <div className="text-xs text-muted-foreground flex items-center mt-1">
                <UserCircle className="h-3 w-3 mr-1" />
                <span>
                  Assigned to:{" "}
                  {assignedUsers.map((user) => user?.name).join(", ")}
                </span>
              </div>
            )}
          </div>

          {/* Task action buttons */}
          <div
            className={cn(
              "flex items-center gap-1 mt-2 md:mt-0 self-end md:self-auto",
              !hideTools || showReorderButtons
                ? "md:invisible md:group-hover:visible"
                : ""
            )}
          >
            {/* Move buttons - only show when reordering is enabled */}
            {showReorderButtons && currentIndex !== -1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onMoveTask?.(task.id, "up")}
                  className="h-7 w-7 md:h-8 md:w-8"
                >
                  <ArrowUp className="h-3 w-3 md:h-4 md:w-4" />
                  <span className="sr-only">Move Up</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onMoveTask?.(task.id, "down")}
                  className="h-7 w-7 md:h-8 md:w-8"
                >
                  <ArrowDown className="h-3 w-3 md:h-4 md:w-4" />
                  <span className="sr-only">Move Down</span>
                </Button>
              </>
            )}

            {!hideTools && (
              <>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onAddSubtask?.(task.id)}
                    className="h-7 w-7 md:h-8 md:w-8"
                  >
                    <Plus className="h-3 w-3 md:h-4 md:w-4" />
                    <span className="sr-only">Add Subtask</span>
                  </Button>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 md:h-8 md:w-8"
                    >
                      <MoreVertical className="h-3 w-3 md:h-4 md:w-4" />
                      <span className="sr-only">More</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={copyTaskToClipboard}>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy text
                    </DropdownMenuItem>
                    {isAdmin && (
                      <DropdownMenuItem
                        onClick={() => setShowAssignmentDialog(true)}
                      >
                        <Users className="mr-2 h-4 w-4" />
                        Manage Assignments
                      </DropdownMenuItem>
                    )}
                    {isAdmin && (
                      <DropdownMenuItem onClick={() => onEditTask?.(task)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                    )}
                    {isAdmin && (
                      <DropdownMenuItem onClick={() => onDeleteTask?.(task.id)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Render children if expanded */}
      {expanded && childTasks.length > 0 && (
        <div className="flex flex-col space-y-2">
          {childTasks.map((childTask) => (
            <TaskItem
              key={childTask.id}
              task={childTask}
              tasks={tasks}
              completions={completions}
              teamMembers={teamMembers}
              selectedDate={selectedDate}
              level={level + 1}
              onAddSubtask={onAddSubtask}
              onEditTask={onEditTask}
              onDeleteTask={onDeleteTask}
              onMoveTask={onMoveTask}
              refetch={refetch}
              isAdmin={isAdmin}
              hideTools={hideTools}
              hideNotAssignedToMe={hideNotAssignedToMe}
              isCheckedIn={isCheckedIn}
              showReorderButtons={showReorderButtons}
            />
          ))}
        </div>
      )}

      {/* Task Assignment Dialog */}
      {showAssignmentDialog && (
        <TaskAssignmentDialog
          taskId={task.id}
          teamId={teamId}
          teamMembers={teamMembers}
          taskAssignments={task.assignments || []}
          refetchMembers={refetch}
          hideButtonBorder={true}
          open={showAssignmentDialog}
          onClose={() => setShowAssignmentDialog(false)}
        />
      )}

      <TaskCompletionModal
        taskTitle={task.title}
        isOpen={showCompletionModal}
        isChecking={pendingCompletion}
        onConfirm={handleConfirmCompletion}
        onCancel={handleCancelCompletion}
        // isCompleted={isCompleted}
      />
    </div>
  );
}
