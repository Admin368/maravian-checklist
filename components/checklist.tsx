"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Users,
  AlertTriangle,
  RefreshCw,
  EyeIcon,
  EyeOffIcon,
  CalendarIcon,
} from "lucide-react";
import { api } from "@/lib/trpc/client";
import { TaskItem } from "./task-item";
import { TaskDialog } from "./task-dialog";
import { useUser } from "./user-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { UserList } from "./user-list";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { isToday, startOfDay } from "date-fns";

interface TeamMember {
  id: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  role: string | null;
}

// Fix checklist task type issues
type ChecklistTask = {
  id: string;
  title: string;
  parentId: string | null;
  position: number;
  createdAt: Date | null;
  teamId: string | null;
  isDeleted: boolean;
  type: string;
  visibility: string;
  deadline?: Date | null;
  assignments: { userId: string }[];
};

export function ChecklistComponent({
  teamId,
  teamName,
  isAdmin = false,
}: {
  teamId: string;
  teamName: string;
  isAdmin?: boolean;
}) {
  const { userId, userName } = useUser();
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [showUserList, setShowUserList] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [hideTools, setHideTools] = useState(false);
  const [showAssignedToMe, setShowAssignedToMe] = useState(false);
  const [showReorderButtons, setShowReorderButtons] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showTodayOnly, setShowTodayOnly] = useState(false);
  const [visibility, setVisibility] = useState<"team" | "private" | "public">(
    "team"
  );
  // const [initialData, setInitialData] = useState<any>(null);

  // Fetch checklists for the specific team
  const {
    data,
    isLoading,
    isRefetching,
    error: tasksError,
    refetch,
  } = api.tasks.getChecklists.useQuery(
    { teamId },
    {
      enabled: !!userId,
      refetchInterval: 10000,
      onError: (err) => {
        console.error("Error fetching checklists:", err);
        setError("Failed to load checklists. Please try refreshing the page.");
      },
    }
  );

  const teamMembers = data?.teamMembers || [];
  const completions = data?.completions || [];

  // Ensure tasks have the correct structure including deadline
  const tasks: ChecklistTask[] = (data?.tasks || []).map((task: any) => ({
    ...task,
    assignments: task.assignments || [],
    deadline: task.deadline ? new Date(task.deadline) : null,
  }));

  // Mutations
  const createTask = api.tasks.create.useMutation({
    onError: (err) => {
      console.error("Error creating LongTerm task:", err);
      setError("Failed to create LongTerm task. Please try again.");
    },
    onSuccess: () => {
      refetch?.();
    },
  });

  const updateTask = api.tasks.update.useMutation({
    onError: (err) => {
      console.error("Error updating LongTerm task:", err);
      setError("Failed to update LongTerm task. Please try again.");
    },
    onSuccess: () => {
      refetch?.();
    },
  });

  const deleteTask = api.tasks.delete.useMutation({
    onError: (err) => {
      console.error("Error deleting LongTerm task:", err);
      setError("Failed to delete LongTerm task. Please try again.");
    },
    onSuccess: () => {
      refetch?.();
    },
  });

  // Get top-level tasks
  const topLevelTasks = tasks
    .filter((task) => task.parentId === null)
    .sort((a, b) => a.position - b.position);

  // Filter tasks based on showCompleted and showTodayOnly settings
  const visibleTasks = topLevelTasks
    .filter((task) => {
      if (showCompleted) {
        return true;
      }
      const isTaskCompleted = completions?.some(
        (c: any) => c.taskId === task.id
      );
      return !isTaskCompleted;
    })
    .filter((task) => {
      if (!showTodayOnly) {
        return true;
      }
      if (!task.deadline) {
        return false;
      }
      // Convert UTC deadline to local time for comparison
      const taskDeadline = new Date(task.deadline);
      return isToday(taskDeadline);
    });

  const handleAddTask = async (data: {
    title: string;
    parentId: string | null;
    deadline?: Date | null;
    time?: string | null;
  }) => {
    if (!isAdmin) return;

    // Set deadline based on Today Mode or passed deadline
    let taskDeadline: string | undefined;

    if (data.deadline) {
      const date = data.deadline?.toLocaleDateString();
      taskDeadline = date;
    }

    try {
      setError(null);
      await createTask.mutateAsync({
        title: data.title,
        parentId: data.parentId,
        teamId,
        type: "checklist",
        visibility,
        deadline: taskDeadline,
        time: data.time || undefined,
      });

      setShowTaskDialog(false);
      toast.success("LongTerm task created successfully");
      return true;
    } catch (error) {
      console.error("Failed to create LongTerm task:", error);
      throw error;
    }
  };

  const onEditTask = (task: ChecklistTask) => {
    setEditingTask(task);
    // setInitialData({
    //   id: task.id,
    //   title: task.title,
    //   parentId: task.parentId,
    //   deadline: task.deadline, // Include deadline in initial data
    // });
    setShowTaskDialog(true);
  };

  const handleEditTask = async (data: {
    title: string;
    parentId: string | null;
    deadline?: Date | null;
    time?: string | null;
  }) => {
    if (!isAdmin || !editingTask) return;

    let taskDeadline: string | undefined;

    if (data.deadline) {
      const date = data.deadline?.toLocaleDateString();
      taskDeadline = date;
    }

    try {
      setError(null);
      await updateTask.mutateAsync({
        id: editingTask.id,
        title: data.title,
        parentId: data.parentId,
        teamId,
        deadline: taskDeadline, // Include deadline in update
        time: data.time,
      });

      setShowTaskDialog(false);
      setEditingTask(null);
      // setInitialData(null);
      toast.success("LongTerm task updated successfully");
      return true;
    } catch (error) {
      console.error("Failed to update LongTerm task:", error);
      throw error;
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!isAdmin) return;

    try {
      setError(null);
      await deleteTask.mutateAsync({
        id: taskId,
      });

      toast.success("LongTerm task deleted successfully");
    } catch (error) {
      console.error("Failed to delete LongTerm task:", error);
      throw error;
    }
  };

  const handleAddSubtask = (parentId: string) => {
    setEditingTask({
      id: null,
      parentId,
      title: "",
    });
    setShowTaskDialog(true);
  };

  const handleDismissError = () => {
    setError(null);
  };

  const handleMoveTask = async (taskId: string, direction: "up" | "down") => {
    if (!isAdmin) return;

    try {
      setError(null);
      const taskToMove = tasks.find((t) => t.id === taskId);
      if (!taskToMove) return;

      const siblings = tasks
        .filter((t) => t.parentId === taskToMove.parentId)
        .sort((a, b) => a.position - b.position);

      const currentIndex = siblings.findIndex((t) => t.id === taskId);
      if (currentIndex === -1) return;

      const targetIndex =
        direction === "up"
          ? Math.max(0, currentIndex - 1)
          : Math.min(siblings.length - 1, currentIndex + 1);

      if (currentIndex === targetIndex) return;

      const targetTask = siblings[targetIndex];

      await updateTask.mutateAsync({
        id: taskId,
        position: targetTask.position,
        teamId,
      });

      await updateTask.mutateAsync({
        id: targetTask.id,
        position: taskToMove.position,
        teamId,
      });

      toast.success("LongTerm task reordered successfully");
    } catch (error) {
      console.error("Failed to reorder task:", error);
      setError("Failed to reorder task. Please try again.");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">LongTerm Tasks</h2>
        </div>
        <div className="space-y-2">
          {Array(3)
            .fill(0)
            .map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismissError}
            className="ml-auto"
          >
            Dismiss
          </Button>
        </Alert>
      )}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center space-x-2">
            <Switch
              id="today-only-mode"
              checked={showTodayOnly}
              onCheckedChange={setShowTodayOnly}
              aria-label="Toggle today only mode"
            />
            <Label
              htmlFor="today-only-mode"
              className="flex items-center gap-1 text-sm"
            >
              <CalendarIcon className="h-4 w-4" /> Today Only
            </Label>
          </div>

          <Button
            variant="outline"
            size="sm"
            className={cn(showCompleted && "bg-muted text-muted-foreground")}
            onClick={() => setShowCompleted(!showCompleted)}
          >
            {showCompleted ? (
              <>
                <EyeOffIcon className="mr-2 h-4 w-4" />
                Hide Completed
              </>
            ) : (
              <>
                <EyeIcon className="mr-2 h-4 w-4" />
                Show Completed
              </>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowUserList(!showUserList)}
          >
            <Users className="mr-2 h-4 w-4" />
            Members
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch?.()}
            disabled={isRefetching}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isRefetching ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>

          {isAdmin && (
            <Button
              onClick={() => {
                const today = startOfDay(new Date());
                if (showTodayOnly === true) {
                  setEditingTask({
                    deadline: today,
                  });
                } else {
                  setEditingTask(null);
                }
                // setInitialData(null);
                setShowTaskDialog(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {!visibleTasks?.length ? (
          <div className="rounded-md border border-dashed p-8 text-center">
            <p className="text-muted-foreground">
              {showTodayOnly
                ? 'No tasks due today. Try turning off "Today Only" mode.'
                : !topLevelTasks.length
                ? 'No LongTerm tasks yet. Click "Add Item" to create one.'
                : 'No tasks match the current filters (e.g., check "Show Completed").'}
            </p>
          </div>
        ) : (
          <div className="w-full">
            {visibleTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task as any}
                tasks={tasks as any}
                completions={completions as any}
                teamMembers={teamMembers}
                selectedDate="*"
                onAddSubtask={handleAddSubtask}
                onEditTask={(task: any) => onEditTask(task)}
                onDeleteTask={handleDeleteTask}
                onMoveTask={handleMoveTask}
                className="mb-2"
                refetch={refetch}
                isAdmin={isAdmin}
                hideTools={hideTools}
                hideNotAssignedToMe={showAssignedToMe}
                isCheckedIn={true}
                showReorderButtons={showReorderButtons}
                showCompleted={showCompleted}
              />
            ))}
          </div>
        )}
      </div>

      {showTaskDialog && (
        <TaskDialog
          open={showTaskDialog}
          onClose={() => setShowTaskDialog(false)}
          onSubmit={editingTask?.id ? handleEditTask : handleAddTask}
          title={
            editingTask?.id
              ? "Edit LongTerm Task"
              : editingTask?.parentId
              ? "Add Subtask"
              : "Add LongTerm Task"
          }
          initialData={editingTask}
          tasks={tasks as any}
          teamId={teamId}
          teamName={teamName}
          showDeadline={true}
        />
      )}

      {showUserList && (
        <UserList
          teamId={teamId}
          teamMembers={teamMembers}
          onClose={() => setShowUserList(false)}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}
