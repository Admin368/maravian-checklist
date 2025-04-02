"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  Focus,
  ArrowUpDown,
  Clock,
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
import { format, isToday, isPast } from "date-fns";
import { toast } from "sonner";
import { TaskAssignmentDialog } from "./task-assignment-dialog";
// import { TaskCompletion } from "@prisma/client";
import { serverGetTeamMembersReturnType } from "@/server/api/routers/users";
import {
  serverGetCompletionsReturnType,
  serverGetTasksReturnType,
} from "@/server/api/routers/tasks";
// import { Task } from "@prisma/client";
import { TaskItemInfo } from "./task-item-info";

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
  setShowReorderButtons?: (showReorderButtons: boolean) => void;
  showCompleted?: boolean;
  focusOnTaskId?: string;
}

export function TaskItem(props: TaskItemProps) {
  const {
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
    setShowReorderButtons,
    showCompleted = false,
    focusOnTaskId,
  } = props;
  const { userId } = useUser();
  const router = useRouter();
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

  // Filter out completed child tasks if showCompleted is false
  const visibleChildTasks = showCompleted
    ? childTasks
    : childTasks.filter((childTask) => {
        const isChildCompleted = completions?.some(
          (c) => c.taskId === childTask.id
        );
        return !isChildCompleted;
      });

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

  // Filter out tasks not assigned to current user if hideNotAssignedToMe is true
  const isThisTaskAssignedToMe =
    userId && task.assignments?.some((a) => a.userId === userId);
  const assignedUsers = task.assignments
    ?.map((a) => teamMembers?.find((m) => m.id === a.userId))
    .filter(Boolean) as serverGetTeamMembersReturnType[];

  if (
    !isThisTaskAssignedToMe &&
    hideNotAssignedToMe &&
    !visibleChildTasks.length
  ) {
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
  const handleOnFocus = () => {
    router.push(`/task/${task.id}`);
  };

  return (
    <div
      className={cn(
        "group relative rounded-lg border pb-2 w-full",
        isCompleted ? "border-muted bg-muted/20" : "border-border",
        className
      )}
      style={{
        marginLeft: level === 0 ? "0px" : "0px",
        marginRight: "0px",
        borderColor: focusOnTaskId === task.id ? "red" : undefined,
      }}
      id={`task-${task.id}`}
    >
      <div className="flex flex-col p-2">
        <div className="flex items-start w-full gap-1">
          {/* Expand/collapse button for parent tasks */}
          <div
            className="flex items-center flex-shrink-0"
            style={{
              paddingLeft: level > 0 ? `${Math.min(level * 16, 48)}px` : "0px",
            }}
          >
            {!!childTasks.length && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 mr-1 p-0 text-muted-foreground"
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
              <div className="w-6" /> // This ensures alignment with parent tasks
            )}

            {/* Checkbox */}
            <div>
              <Checkbox
                id={`task-checkbox-${task.id}`}
                checked={isCompleted}
                disabled={!isCheckedIn}
                onCheckedChange={handleCheckboxChange}
              />
            </div>
          </div>

          {/* Task title and badges */}
          <div className="flex-1 min-w-0 ml-1">
            <div className="flex flex-col items-start flex-wrap">
              <span
                className={cn(
                  "text-sm break-words pr-1 w-full",
                  isCompleted && "line-through text-muted-foreground"
                )}
                onClick={handleOnFocus}
              >
                {task.title}
              </span>
              {task.deadline && (
                <TaskItemInfo
                  label="Deadline:"
                  value={
                    task.deadline
                      ? format(new Date(task.deadline), "MMM d, yyyy")
                      : ""
                  }
                  textColor={
                    task.deadline
                      ? isPast(new Date(task.deadline))
                        ? "text-red-500"
                        : isToday(new Date(task.deadline))
                        ? "text-yellow-500"
                        : "text-primary"
                      : "text-muted-foreground"
                  }
                  icon={<CalendarClock className="h-3 w-3" />}
                />
              )}
              {task.time && (
                <TaskItemInfo
                  label="Time"
                  value={task.time}
                  textColor="text-primary"
                  icon={<Clock className="h-3 w-3" />}
                />
              )}

              {/* Add badge for checklist items when they appear in regular task lists */}
              {(task as any).type === "checklist" && selectedDate !== "*" && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded flex-shrink-0 mt-1">
                  Checklist
                </span>
              )}
            </div>

            {isCompleted && completerName && (
              <TaskItemInfo
                label="Completed by"
                value={`${completerName} ${
                  completedAt && format(completedAt, "h:mm a")
                }`}
                icon={<UserCircle className="h-3 w-3" />}
              />
            )}

            {/* Display assigned users */}
            {assignedUsers.length > 0 && (
              <TaskItemInfo
                label="Assigned to:"
                value={assignedUsers.map((user) => user?.name).join(", ")}
                icon={<UserCircle className="h-3 w-3" />}
              />
            )}
          </div>
        </div>

        {/* Task action buttons - moved to bottom */}
        <div
          className="flex flex-wrap items-center justify-between gap-1 mt-2 pl-[calc(1.5rem+1.5rem)]"
          style={{
            paddingLeft:
              level > 0 ? `${Math.min(level * 16 + 24, 72)}px` : "24px",
          }}
        >
          {/* Reorder buttons with conditional visibility */}
          <div
            className={cn(
              "flex items-center gap-1",
              !hideTools || showReorderButtons ? "opacity-100" : "hidden"
            )}
          >
            {/* Move buttons - only show when reordering is enabled */}
            {showReorderButtons && currentIndex !== -1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onMoveTask?.(task.id, "up")}
                  className="h-7 w-7"
                >
                  <ArrowUp className="h-3 w-3" />
                  <span className="sr-only">Move Up</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onMoveTask?.(task.id, "down")}
                  className="h-7 w-7"
                >
                  <ArrowDown className="h-3 w-3" />
                  <span className="sr-only">Move Down</span>
                </Button>
              </>
            )}
          </div>

          {/* Plus and More buttons - always visible */}
          {!hideTools && (
            <div className="flex items-center gap-1 ml-auto">
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onAddSubtask?.(task.id)}
                  className="h-7"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {/* <span className="text-xs">Add</span> */}
                </Button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7">
                    <MoreVertical className="h-3 w-3 mr-1" />
                    {/* <span className="text-xs">More</span> */}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {isAdmin && (
                    <DropdownMenuItem onClick={() => onEditTask?.(task)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={handleOnFocus}>
                    <Focus className="mr-2 h-4 w-4" />
                    Focus
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={copyTaskToClipboard}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy text
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    hidden={setShowReorderButtons ? true : false}
                    onClick={() => setShowReorderButtons?.(!showReorderButtons)}
                  >
                    <ArrowUpDown className="mr-2 h-4 w-4" />
                    {showReorderButtons
                      ? "Hide Reorder Buttons"
                      : "Show Reorder Buttons"}
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
                    <DropdownMenuItem onClick={() => onDeleteTask?.(task.id)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </div>

      {/* Render children if expanded */}
      {expanded && visibleChildTasks.length > 0 && (
        <div className="flex flex-col space-y-2 w-full">
          {visibleChildTasks.map((childTask) => (
            <TaskItem {...props} key={childTask.id} task={childTask} />
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
