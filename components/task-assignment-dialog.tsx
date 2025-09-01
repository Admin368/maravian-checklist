"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/trpc/client";
import { Loader2, Search, UserCheck, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { serverGetTeamMembersReturnType } from "@/server/api/routers/users";

interface TaskAssignmentDialogProps {
  taskId: string;
  teamId: string;
  teamMembers: serverGetTeamMembersReturnType[];
  taskAssignments?: { userId: string }[];
  refetchMembers?: () => void;
  hideButtonBorder?: boolean;
  open: boolean;
  onClose: () => void;
}

export function TaskAssignmentDialog({
  taskId,
  teamId,
  teamMembers = [],
  taskAssignments = [],
  refetchMembers,
  hideButtonBorder = false,
  open,
  onClose,
}: TaskAssignmentDialogProps) {
  // Extract assigned user IDs once
  const assignedUserIds =
    taskAssignments?.map((assignment) => assignment.userId) || [];

  // Set up state for the component
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<string>("add");
  const [isLoading, setIsLoading] = useState(false);

  // Initialize selected users based on the active tab
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  // Batch update assignments mutation
  const updateAssignments = api.tasks.updateAssignments.useMutation({
    onSuccess: () => {
      toast.success(activeTab === "add" ? "Users assigned" : "Users removed", {
        description:
          activeTab === "add"
            ? "The users have been successfully assigned to this task"
            : "The users have been removed from this task",
      });
      if (refetchMembers) {
        refetchMembers();
      }
      onClose();
    },
    onError: (error) => {
      toast.error("Error", {
        description: error.message || "Failed to update assignments",
      });
      setIsLoading(false);
    },
  });

  // Handle tab change - reset selections when tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (value === "add") {
      setSelectedUsers([]);
    } else if (value === "remove") {
      // setSelectedUsers([...assignedUserIds]);
      setSelectedUsers([]);
    }
  };

  // Filtered team members based on search and current tab
  const filteredMembers = teamMembers.filter((member) => {
    const nameMatches =
      member.name?.toLowerCase().includes(searchQuery.toLowerCase()) || false;
    const shouldShow =
      activeTab === "add"
        ? !assignedUserIds.includes(member.id)
        : assignedUserIds.includes(member.id);
    return nameMatches && shouldShow;
  });

  // Toggle user selection
  const toggleUserSelection = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  // Handle submitting the form
  const handleSubmit = async () => {
    if (selectedUsers.length === 0) return;

    try {
      setIsLoading(true);
      await updateAssignments.mutateAsync({
        taskId,
        userIds: selectedUsers,
        action: activeTab === "add" ? "add" : "remove",
      });
    } catch (error) {
      console.error("Failed to update assignments:", error);
      setIsLoading(false);
    }
  };

  // Handle dialog close
  const handleDialogClose = (isOpen: boolean) => {
    if (!isOpen && !isLoading) {
      onClose();
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Task Assignments</DialogTitle>
        </DialogHeader>

        <Tabs
          defaultValue="add"
          value={activeTab}
          onValueChange={handleTabChange}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="add" className="flex items-center gap-1">
              <UserCheck className="h-4 w-4" />
              <span>Assign Users</span>
            </TabsTrigger>
            <TabsTrigger value="remove" className="flex items-center gap-1">
              <UserMinus className="h-4 w-4" />
              <span>Remove Users</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="add" className="mt-4">
            <div className="text-sm mb-2">
              Select users to assign to this task
            </div>
          </TabsContent>

          <TabsContent value="remove" className="mt-4">
            <div className="text-sm mb-2">
              Select users to remove from this task
            </div>
          </TabsContent>
        </Tabs>

        <div className="relative mt-2">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search team members..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="max-h-[300px] overflow-y-auto mt-2">
          {filteredMembers.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              {activeTab === "add"
                ? "No users available to assign"
                : "No users currently assigned"}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted"
                >
                  <Checkbox
                    id={`user-${member.id}`}
                    checked={selectedUsers.includes(member.id)}
                    onCheckedChange={() => toggleUserSelection(member.id)}
                  />
                  <Label
                    htmlFor={`user-${member.id}`}
                    className="flex items-center gap-2 cursor-pointer text-sm flex-1"
                  >
                    {member.avatarUrl ? (
                      <img
                        src={member.avatarUrl}
                        alt={member.name || "User"}
                        className="w-6 h-6 rounded-full"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                        {member.name?.[0]?.toUpperCase() || "U"}
                      </div>
                    )}
                    <span className="flex-1">{member.name}</span>
                    {member.role === "admin" || member.role === "owner" ? (
                      <span className="text-xs text-muted-foreground">
                        ({member.role})
                      </span>
                    ) : null}
                  </Label>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <div className="flex items-center text-sm text-muted-foreground">
            {selectedUsers.length} user{selectedUsers.length !== 1 ? "s" : ""}{" "}
            selected
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={selectedUsers.length === 0 || isLoading}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {activeTab === "add" ? "Assign" : "Remove"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
