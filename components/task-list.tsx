"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Users,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ArrowUpDown,
  EyeIcon,
  EyeOffIcon,
} from "lucide-react";
import { api } from "@/lib/trpc/client";
import { DatePicker } from "./date-picker";
import { TaskItem } from "./task-item";
import { TaskDialog } from "./task-dialog";
import { useUser } from "./user-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { UserList } from "./user-list";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Task } from "@prisma/client";
import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { UserCircle } from "lucide-react";

interface TeamMember {
  id: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  role: string | null;
}

export function TaskList({
  teamId,
  teamName,
  isAdmin = false,
}: {
  teamId: string;
  teamName: string;
  isAdmin?: boolean;
}) {
  const { userId, userName } = useUser();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [showUserList, setShowUserList] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [hideTools, setHideTools] = useState(false);
  const [showAssignedToMe, setShowAssignedToMe] = useState(false);
  const [showReorderButtons, setShowReorderButtons] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  // const today = format(new Date(), "yyyy-MM-dd");

  // const formattedDate = selectedDate.toISOString().split("T")[0];
  const formattedDate = format(selectedDate, "yyyy-MM-dd");
  // Fetch tasks and completions for the specific team
  const {
    data,
    isLoading,
    isRefetching,
    error: tasksError,
    refetch,
  } = api.tasks.getByTeam.useQuery(
    { teamId, date: formattedDate },
    {
      enabled: !!userId,
      refetchInterval: 10000,
      onError: (err) => {
        console.error("Error fetching tasks:", err);
        setError("Failed to load tasks. Please try refreshing the page.");
      },
    }
  );

  const { teamMembers, completions, tasks, checkInStatus } = data || {};

  // Mutations
  const createTask = api.tasks.create.useMutation({
    onError: (err) => {
      console.error("Error creating task:", err);
      setError("Failed to create task. Please try again.");
    },
  });

  const updateTask = api.tasks.update.useMutation({
    onError: (err) => {
      console.error("Error updating task:", err);
      setError("Failed to update task. Please try again.");
    },
  });

  const deleteTask = api.tasks.delete.useMutation({
    onError: (err) => {
      console.error("Error deleting task:", err);
      setError("Failed to delete task. Please try again.");
    },
  });

  // const utils = api.useContext();

  // Get top-level tasks
  const topLevelTasks =
    tasks
      ?.filter((task: Task) => task.parentId === null)
      .sort((a: Task, b: Task) => a.position - b.position) || [];

  const visibleTasks = showCompleted
    ? topLevelTasks
    : topLevelTasks.filter((task: any) => {
        const isTaskCompleted = completions?.some(
          (c: any) => c.taskId === task.id
        );
        return !isTaskCompleted;
      });

  const handleDateChange = (date: Date) => {
    setSelectedDate(date);
  };

  const handleAddTask = async (data: {
    title: string;
    parentId: string | null;
  }) => {
    if (!isAdmin) return;
    try {
      setError(null);
      await createTask.mutateAsync({
        title: data.title,
        parentId: data.parentId,
        teamId,
      });

      // utils.tasks.getByTeam.invalidate({ teamId });
      await refetch?.();
      setShowTaskDialog(false);
      toast.success("Task created successfully");
      return true;
    } catch (error) {
      console.error("Failed to create task:", error);
      throw error;
    }
  };
  const onEditTask = (task: Task) => {
    setEditingTask(task);
    setShowTaskDialog(true);
  };

  const handleEditTask = async (data: {
    title: string;
    parentId: string | null;
  }) => {
    if (!isAdmin || !editingTask) return;

    try {
      setError(null);
      await updateTask.mutateAsync({
        id: editingTask.id,
        title: data.title,
        parentId: data.parentId,
      });

      // utils.tasks.getByTeam.invalidate({ teamId });
      await refetch?.();
      setEditingTask(null);
      setShowTaskDialog(false);
      toast.success("Task updated successfully");
      return true;
    } catch (error) {
      console.error("Failed to update task:", error);
      throw error;
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!isAdmin) return;

    if (
      !confirm(
        "Are you sure you want to delete this task and all its subtasks?"
      )
    )
      return;

    try {
      setError(null);
      await deleteTask.mutateAsync({ id: taskId });
      // utils.tasks.getByTeam.invalidate({ teamId });
      refetch?.();
    } catch (error) {
      console.error("Failed to delete task:", error);
    }
  };

  const handleAddSubtask = (parentId: string) => {
    if (!isAdmin) return;
    // Find the parent task
    const parentTask = tasks?.find((t: Task) => t.id === parentId);
    if (parentTask) {
      // For subtasks, we need to set empty initial data with just the parentId
      setEditingTask({
        parentId,
        // Don't set an ID to make it clear this is a new task
        title: "",
      });
      setShowTaskDialog(true);
    } else {
      toast.error("Parent task not found");
      console.error("Parent task not found:", parentId);
    }
  };

  const handleDismissError = () => {
    setError(null);
  };

  const handleMoveTask = async (taskId: string, direction: "up" | "down") => {
    if (!isAdmin) return;
    try {
      // Find the task and its siblings
      const task = tasks?.find((t: Task) => t.id === taskId);
      if (!task) return;

      const siblingTasks = tasks
        ?.filter((t: Task) => t.parentId === task.parentId)
        .sort((a: Task, b: Task) => a.position - b.position);

      if (!siblingTasks) return;

      const currentIndex = siblingTasks.findIndex((t: Task) => t.id === taskId);
      if (currentIndex === -1) return;

      // Calculate new index
      const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (newIndex < 0 || newIndex >= siblingTasks.length) return;

      // Create a new array with the updated order
      const newTasks = [...siblingTasks];
      const [movedTask] = newTasks.splice(currentIndex, 1);
      newTasks.splice(newIndex, 0, movedTask);

      // Calculate new positions for all affected tasks
      const updates = newTasks.map((task: Task, index: number) => ({
        id: task.id,
        position: calculateNewPosition(index, index, newTasks),
      }));

      // Update task positions in batch
      await updateTask.mutateAsync({
        updates: updates.map((update) => ({
          ...update,
          position: update.position || 0,
        })),
        teamId,
      });

      // Invalidate tasks query to refresh the list
      // utils.tasks.getByTeam.invalidate({ teamId });
      refetch?.();
    } catch (error) {
      console.error("Error moving task:", error);
      setError("Failed to move task. Please try again.");
    }
  };

  const calculateNewPosition = (
    oldIndex: number,
    newIndex: number,
    tasks: Task[]
  ) => {
    if (!isAdmin) return;
    if (tasks.length === 0) return 0;
    if (tasks.length === 1) return tasks[0].position;

    // If moving to start
    if (newIndex === 0) {
      return Math.max(0, tasks[0].position - 1000);
    }

    // If moving to end
    if (newIndex === tasks.length - 1) {
      return tasks[tasks.length - 1].position + 1000;
    }

    // Moving between two tasks - ensure integer result
    const beforePosition = tasks[newIndex - 1].position;
    const afterPosition = tasks[newIndex].position;
    return Math.floor(beforePosition + (afterPosition - beforePosition) / 2);
  };

  if (!userId) {
    return (
      <div className="flex justify-center items-center h-screen">
        Loading user...
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-full overflow-hidden">
      <div className="flex flex-col justify-between items-start mb-4 gap-4">
        <div className="flex flex-col gap-2 w-full">
          <h3 className="text-xl font-semibold">{teamName}</h3>
          <p className="text-sm text-muted-foreground">
            {format(selectedDate, "EEEE, MMMM do, yyyy")}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <div className="flex items-center">
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "gap-2",
                showCompleted && "bg-muted text-muted-foreground"
              )}
              onClick={() => setShowCompleted(!showCompleted)}
            >
              {showCompleted ? (
                <>
                  <EyeOffIcon className="h-4 w-4" />
                  <span className="hidden md:inline">Hide Completed</span>
                </>
              ) : (
                <>
                  <EyeIcon className="h-4 w-4" />
                  <span className="hidden md:inline">Show Completed</span>
                </>
              )}
            </Button>
          </div>

          {/* <DatePicker
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
          /> */}

          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingTask(null);
                setShowTaskDialog(true);
              }}
              className="flex-shrink-0"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Task
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowUserList(!showUserList)}
            className="flex-shrink-0"
          >
            <Users className="h-4 w-4 mr-2" />
            Team Members
            <span className="sr-only">Toggle Team Members</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch?.()}
            className="flex-shrink-0"
          >
            <RefreshCw
              className={cn(
                "h-4 w-4",
                (isLoading || isRefetching) && "animate-spin"
              )}
            />
            <span className="">Refresh</span>
          </Button>

          {!hideTools && (
            <Button
              variant={showAssignedToMe ? "default" : "outline"}
              size="sm"
              onClick={() => setShowAssignedToMe(!showAssignedToMe)}
              className="flex-shrink-0"
            >
              <UserCircle className="h-4 w-4 mr-2" />
              <span className="hidden md:inline">
                {showAssignedToMe ? "Show All" : "Assigned to Me"}
              </span>
            </Button>
          )}

          {isAdmin && (
            <Button
              variant={showReorderButtons ? "default" : "outline"}
              size="sm"
              onClick={() => setShowReorderButtons(!showReorderButtons)}
              className="flex-shrink-0"
            >
              <ArrowUpDown className="h-4 w-4 mr-2" />
              <span className="hidden md:inline">
                {showReorderButtons ? "Hide Order" : "Reorder"}
              </span>
            </Button>
          )}
        </div>
      </div>

      {showUserList && teamMembers && (
        <div className="mb-4 w-full">
          <UserList teamId={teamId} teamMembers={teamMembers} />
        </div>
      )}

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          <Button
            variant="destructive"
            size="sm"
            className="mt-2"
            onClick={handleDismissError}
          >
            Dismiss
          </Button>
        </Alert>
      )}

      {/* Check-in status */}
      {checkInStatus && !checkInStatus.checkedIn && (
        <Alert className="mb-4">
          <AlertTitle>Not Checked In</AlertTitle>
          <AlertDescription>
            You need to check in before you can mark tasks as completed.
          </AlertDescription>
        </Alert>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-2 w-full">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && visibleTasks.length === 0 && (
        <div className="text-center py-6 border rounded-lg w-full">
          <p className="text-muted-foreground">No tasks for this day.</p>
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingTask(null);
                setShowTaskDialog(true);
              }}
              className="mt-2"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Task
            </Button>
          )}
        </div>
      )}

      {/* Task list */}
      {!isLoading && visibleTasks.length > 0 && (
        <div className="space-y-2 w-full px-1">
          {visibleTasks.map((task: Task) => (
            <TaskItem
              key={task.id}
              task={task as any}
              tasks={tasks as any}
              completions={completions as any}
              teamMembers={teamMembers as any}
              selectedDate={formattedDate}
              onAddSubtask={handleAddSubtask}
              onEditTask={onEditTask}
              onDeleteTask={handleDeleteTask}
              onMoveTask={handleMoveTask}
              refetch={refetch as any}
              isAdmin={isAdmin}
              hideTools={hideTools}
              hideNotAssignedToMe={showAssignedToMe}
              isCheckedIn={checkInStatus?.checkedIn || false}
              showReorderButtons={showReorderButtons}
              showCompleted={showCompleted}
              className="w-full"
            />
          ))}
        </div>
      )}

      {/* Task dialog */}
      {showTaskDialog && (
        <TaskDialog
          open={showTaskDialog}
          onClose={() => {
            setShowTaskDialog(false);
            setEditingTask(null);
          }}
          initialData={editingTask}
          onSubmit={editingTask?.id ? handleEditTask : handleAddTask}
          title={editingTask?.id ? "Edit Task" : "Add Task"}
          tasks={tasks || []}
          teamId={teamId}
        />
      )}
    </div>
  );
}
