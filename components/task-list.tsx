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
    <div className="flex-1 overflow-hidden">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <h1 className="text-xl md:text-2xl font-bold">{teamName}</h1>
          <div className="text-sm text-muted-foreground">
            Logged in as: {userName}
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription className="flex justify-between items-center">
              <span>{error}</span>
              <Button variant="outline" size="sm" onClick={handleDismissError}>
                Dismiss
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 flex-wrap">
          <DatePicker date={selectedDate} onDateChange={handleDateChange} />
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingTask(null);
                setShowTaskDialog(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Task
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowUserList(true)}
          >
            <Users className="h-4 w-4 mr-2" />
            Team Members
          </Button>
        </div>

        {showUserList && teamMembers && (
          <UserList
            teamId={teamId}
            teamMembers={teamMembers}
            onClose={() => setShowUserList(false)}
            refetch={refetch}
          />
        )}

        <div className="border rounded-md flex flex-col">
          <div className="p-2 md:p-4 border-b bg-muted/50">
            <h2 className="font-semibold text-sm md:text-base">
              Tasks for {format(selectedDate, "MMMM d, yyyy")}
            </h2>
          </div>
          <div className="p-2 md:p-4 border-b bg-muted/50 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!isAdmin}
              onClick={() => {
                setHideTools(!hideTools);
              }}
              className="text-xs md:text-sm py-1 px-2 h-auto"
            >
              {hideTools ? "Show Task Tools" : "Hide Task Tools"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAssignedToMe(!showAssignedToMe)}
              className="text-xs md:text-sm py-1 px-2 h-auto"
            >
              {showAssignedToMe ? "Show All Tasks" : "Show Only Mine"}
            </Button>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isRefetching}
                className="text-xs md:text-sm py-1 px-2 h-auto"
              >
                <RefreshCw
                  className={cn("h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2", {
                    "animate-spin": isRefetching,
                  })}
                />
                Refresh
              </Button>
              {isAdmin && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowReorderButtons(!showReorderButtons)}
                    className="text-xs md:text-sm py-1 px-2 h-auto"
                  >
                    <ArrowUpDown className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                    {showReorderButtons ? "Hide Reorder" : "Reorder"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingTask(null);
                      setShowTaskDialog(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Task
                  </Button>
                </>
              )}
            </div>
          </div>
          {!checkInStatus?.checkedIn && (
            <div className="flex flex-1 text-center justify-center p-2 items-center gap-2 text-muted-foreground text-xs md:text-sm">
              You must be checked in to complete tasks
            </div>
          )}
          <div className="">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-2 p-2">
                    <Skeleton className="h-4 w-4 rounded-sm" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                ))}
              </div>
            ) : tasksError ? (
              <div className="text-center py-8 text-destructive text-sm">
                <p>Failed to load tasks. Please try refreshing the page.</p>
              </div>
            ) : tasks?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <p>No tasks found. Add your first task to get started.</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-2 md:p-4">
                {error && (
                  <div className="mb-4 text-sm text-red-500">{error}</div>
                )}

                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {topLevelTasks.map((task) => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        tasks={tasks || []}
                        completions={completions || []}
                        teamMembers={teamMembers || []}
                        selectedDate={selectedDate}
                        onAddSubtask={handleAddSubtask}
                        onEditTask={onEditTask}
                        onDeleteTask={handleDeleteTask}
                        onMoveTask={handleMoveTask}
                        refetch={refetch}
                        isAdmin={isAdmin}
                        hideTools={hideTools}
                        hideNotAssignedToMe={showAssignedToMe}
                        isCheckedIn={checkInStatus?.checkedIn ?? false}
                        showReorderButtons={showReorderButtons}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Task Dialog for adding/editing tasks */}
      {showTaskDialog && (
        <TaskDialog
          open={showTaskDialog}
          onClose={() => {
            setShowTaskDialog(false);
            setEditingTask(null);
          }}
          onSubmit={editingTask?.id ? handleEditTask : handleAddTask}
          title={editingTask?.id ? "Edit Task" : "Add Task"}
          initialData={editingTask}
          tasks={tasks || []}
          teamId={teamId}
        />
      )}
    </div>
  );
}
