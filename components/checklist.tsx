"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Users,
  AlertTriangle,
  Loader2,
  Globe,
  Lock,
  RefreshCw,
} from "lucide-react";
import { api } from "@/lib/trpc/client";
import { TaskItem } from "./task-item";
import { TaskDialog } from "./task-dialog";
import { useUser } from "./user-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { UserList } from "./user-list";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

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
  const [visibility, setVisibility] = useState<"team" | "private" | "public">(
    "team"
  );

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

  // Ensure tasks have the correct structure
  const tasks: ChecklistTask[] = (data?.tasks || []).map((task: any) => ({
    ...task,
    assignments: task.assignments || [],
  }));

  // Mutations
  const createTask = api.tasks.create.useMutation({
    onError: (err) => {
      console.error("Error creating LongTerm task:", err);
      setError("Failed to create LongTerm task. Please try again.");
    },
  });

  const updateTask = api.tasks.update.useMutation({
    onError: (err) => {
      console.error("Error updating LongTerm task:", err);
      setError("Failed to update LongTerm task. Please try again.");
    },
  });

  const deleteTask = api.tasks.delete.useMutation({
    onError: (err) => {
      console.error("Error deleting LongTerm task:", err);
      setError("Failed to delete LongTerm task. Please try again.");
    },
  });

  // Get top-level tasks
  const topLevelTasks = tasks
    .filter((task) => task.parentId === null)
    .sort((a, b) => a.position - b.position);

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
        type: "checklist",
        visibility,
      });

      await refetch?.();
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
        teamId,
      });

      await refetch?.();
      setShowTaskDialog(false);
      setEditingTask(null);
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

      await refetch?.();
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
      const taskToMove = tasks.find(t => t.id === taskId);
      if (!taskToMove) return;
      
      const siblings = tasks
        .filter(t => t.parentId === taskToMove.parentId)
        .sort((a, b) => a.position - b.position);
      
      const currentIndex = siblings.findIndex(t => t.id === taskId);
      if (currentIndex === -1) return;
      
      const targetIndex = direction === "up" 
        ? Math.max(0, currentIndex - 1) 
        : Math.min(siblings.length - 1, currentIndex + 1);
      
      if (currentIndex === targetIndex) return;
      
      const targetTask = siblings[targetIndex];
      
      await updateTask.mutateAsync({
        id: taskId,
        position: targetTask.position,
        teamId
      });
      
      await updateTask.mutateAsync({
        id: targetTask.id,
        position: taskToMove.position,
        teamId
      });
      
      await refetch?.();
    } catch (error) {
      console.error("Failed to move task:", error);
      setError("Failed to reorder tasks. Please try again.");
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

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">LongTerm Tasks</h2>
        <div className="flex space-x-2">
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
            <>
              {/* <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    {visibility === "team" ? (
                      <Users className="mr-2 h-4 w-4" />
                    ) : visibility === "private" ? (
                      <Lock className="mr-2 h-4 w-4" />
                    ) : (
                      <Globe className="mr-2 h-4 w-4" />
                    )}
                    {visibility === "team"
                      ? "Team"
                      : visibility === "private"
                      ? "Private"
                      : "Public"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setVisibility("team")}>
                    <Users className="mr-2 h-4 w-4" />
                    Team
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setVisibility("private")}>
                    <Lock className="mr-2 h-4 w-4" />
                    Private
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setVisibility("public")}>
                    <Globe className="mr-2 h-4 w-4" />
                    Public
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu> */}

              <Button
                onClick={() => {
                  setEditingTask(null);
                  setShowTaskDialog(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {!topLevelTasks?.length ? (
          <div className="rounded-md border border-dashed p-8 text-center">
            <p className="text-muted-foreground">
              No LongTerm tasks yet. Click &quot;Add Item&quot; to create one.
            </p>
          </div>
        ) : (
          <div>
            {topLevelTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task as any}
                tasks={tasks as any}
                completions={completions as any}
                teamMembers={teamMembers}
                selectedDate="*" // Not date specific
                onAddSubtask={handleAddSubtask}
                onEditTask={onEditTask}
                onDeleteTask={handleDeleteTask}
                onMoveTask={handleMoveTask}
                className="mb-2"
                refetch={refetch}
                isAdmin={isAdmin}
                hideTools={hideTools}
                hideNotAssignedToMe={showAssignedToMe}
                isCheckedIn={true} // Always allow checklist completions
                showReorderButtons={showReorderButtons}
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
          initialData={{
            id: editingTask?.id || "",
            title: editingTask?.title || "",
            parentId: editingTask?.parentId || null,
          }}
          tasks={tasks as any}
          teamId={teamId}
          teamName={teamName}
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
