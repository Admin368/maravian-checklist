"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  X,
  ShieldCheck,
  User,
  Clock,
  MoreVertical,
  Copy,
  Shield,
  ShieldOff,
  Ban,
  LogOut,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import { useUser } from "./user-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { api } from "@/lib/trpc/client";
import { useSession } from "next-auth/react";
import { StarRating } from "@/components/ui/star-rating";
import { serverGetTeamMembersReturnType } from "@/server/api/routers/users";
import { MemberNotificationStatus } from "./member-notification-status";

// interface TeamMember {
//   id: string;
//   name: string;
//   email: string | null;
//   avatarUrl: string | null;
//   role: string | null;
//   notes?: string | null;
//   checkedInAt?: string | null;
//   isBanned?: boolean;
//   rating?: number | null;
//   checkoutAt?: string | null;
// }

interface UserListProps {
  teamMembers: serverGetTeamMembersReturnType[];
  onClose?: () => void;
  showTime?: boolean;
  teamId: string;
  refetch?: () => void;
  isAdmin?: boolean;
}

export function UserList({
  teamMembers,
  onClose,
  showTime,
  teamId,
  refetch,
  isAdmin = false,
}: UserListProps) {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const [expandedMembers, setExpandedMembers] = useState<Set<string>>(
    new Set()
  );

  const toggleMemberExpanded = (memberId: string) => {
    setExpandedMembers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(memberId)) {
        newSet.delete(memberId);
      } else {
        newSet.add(memberId);
      }
      return newSet;
    });
  };

  const isUserAdmin =
    teamMembers.find((member) => member.id === userId)?.role === "admin";
  const updateRole = api.teams.updateMemberRole.useMutation({
    onSuccess: () => {
      toast.success("Role updated", {
        description: "The member's role has been updated successfully",
      });
      refetch?.();
    },
    onError: (error) => {
      toast.error("Error", {
        description: error.message || "Failed to update role",
      });
    },
  });

  const banUser = api.users.banUser.useMutation({
    onSuccess: () => {
      toast.success("User banned", {
        description: "The user has been banned from the team",
      });
      refetch?.();
    },
    onError: (error) => {
      toast.error("Error", {
        description: error.message || "Failed to ban user",
      });
    },
  });

  const unbanUser = api.users.unbanUser.useMutation({
    onSuccess: () => {
      toast.success("User unbanned", {
        description: "The user has been unbanned from the team",
      });
      refetch?.();
    },
    onError: (error) => {
      toast.error("Error", {
        description: error.message || "Failed to unban user",
      });
    },
  });

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    toast.success("Copied", {
      description: "User ID copied to clipboard",
    });
  };

  const handleRoleChange = async (
    memberId: string,
    newRole: "member" | "admin"
  ) => {
    if (!teamId) return;

    try {
      await updateRole.mutateAsync({
        teamId,
        userId: memberId,
        role: newRole,
      });
    } catch (error) {
      console.error("Failed to update role:", error);
    }
  };

  const handleBanUser = async (memberId: string) => {
    if (!teamId) return;

    try {
      await banUser.mutateAsync({
        teamId,
        userId: memberId,
      });
    } catch (error) {
      console.error("Failed to ban user:", error);
    }
  };

  const handleUnbanUser = async (memberId: string) => {
    if (!teamId) return;

    try {
      await unbanUser.mutateAsync({
        teamId,
        userId: memberId,
      });
    } catch (error) {
      console.error("Failed to unban user:", error);
    }
  };

  const getRoleColor = (role: string | null) => {
    if (!role) return "bg-secondary text-secondary-foreground";
    switch (role.toLowerCase()) {
      case "admin":
        return "bg-primary text-primary-foreground";
      case "owner":
        return "bg-destructive text-destructive-foreground";
      default:
        return "bg-secondary text-secondary-foreground";
    }
  };

  const getRoleIcon = (role: string | null) => {
    if (!role) return <User className="h-3 w-3 mr-1" />;
    switch (role.toLowerCase()) {
      case "admin":
      case "owner":
        return <ShieldCheck className="h-3 w-3 mr-1" />;
      default:
        return <User className="h-3 w-3 mr-1" />;
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-xl">Members</CardTitle>
          <CardDescription>
            {teamMembers.length}{" "}
            {teamMembers.length === 1 ? "member" : "members"}{" "}
            {showTime ? "checked in" : "in the Checklist"}
          </CardDescription>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {teamMembers.map((member) => {
            const isExpanded = expandedMembers.has(member.id);
            return (
              <div
                key={member.id}
                className="rounded-md border hover:bg-muted group"
              >
                <div
                  className="p-3 cursor-pointer"
                  onClick={() => toggleMemberExpanded(member.id)}
                >
                  <div className="flex flex-wrap gap-3">
                    {/* Avatar and name - always on first line */}
                    <div className="flex items-center gap-2 flex-grow min-w-0 mb-1">
                      <Avatar className="flex-shrink-0">
                        {member.avatarUrl ? (
                          <img src={member.avatarUrl} alt={member.name} />
                        ) : (
                          <AvatarFallback>
                            {member.name
                              ? member.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")
                                  .toUpperCase()
                              : "?"}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate flex items-center gap-2">
                          {member.name}
                          {member.id === userId && (
                            <Badge variant="outline" className="text-xs">
                              Me
                            </Badge>
                          )}
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        {member.email && (
                          <div className="text-sm text-muted-foreground truncate">
                            {member.email}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Badges and actions - on second line in mobile, aligned right on desktop */}
                    <div className="flex items-center gap-2 flex-wrap w-full md:w-auto md:ml-auto">
                      {member.isBanned && (
                        <Badge variant="destructive" className="flex-shrink-0">
                          Banned
                        </Badge>
                      )}
                      <Badge
                        variant="secondary"
                        className={`flex items-center whitespace-nowrap flex-shrink-0 ${getRoleColor(
                          member.role
                        )}`}
                      >
                        {getRoleIcon(member.role)}
                        <span className="text-xs">
                          {member.role || "member"}
                        </span>
                      </Badge>

                      {/* Notification Status */}
                      {member.notificationSettings && (
                        <MemberNotificationStatus
                          notificationSettings={member.notificationSettings}
                          userName={member.name}
                          compact={true}
                        />
                      )}

                      {/* Render check-in time if available and requested */}
                      {showTime && (
                        <div className="text-xs text-muted-foreground flex items-center whitespace-nowrap flex-shrink-0">
                          <Clock className="h-3 w-3 mr-1" />
                          <span className="hidden sm:inline">Checked in</span>
                          <span className="sm:hidden">✓</span>
                        </div>
                      )}

                      {/* Admin actions */}
                      {(isUserAdmin || isAdmin) && member.id !== userId && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 flex-shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="sr-only">Open menu</span>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleCopyId(member.id)}
                              className="cursor-pointer"
                            >
                              <Copy className="h-4 w-4 mr-2 flex-shrink-0" />
                              <span className="truncate">Copy ID</span>
                            </DropdownMenuItem>
                            {member.role !== "owner" && (
                              <>
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleRoleChange(
                                      member.id,
                                      member.role === "admin"
                                        ? "member"
                                        : "admin"
                                    )
                                  }
                                  className="cursor-pointer"
                                >
                                  {member.role === "admin" ? (
                                    <>
                                      <ShieldOff className="h-4 w-4 mr-2 flex-shrink-0" />
                                      <span className="truncate">
                                        Remove Admin
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <Shield className="h-4 w-4 mr-2 flex-shrink-0" />
                                      <span className="truncate">
                                        Make Admin
                                      </span>
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    member.isBanned
                                      ? handleUnbanUser(member.id)
                                      : handleBanUser(member.id)
                                  }
                                  className="cursor-pointer"
                                >
                                  {member.isBanned ? (
                                    <>
                                      <LogOut className="h-4 w-4 mr-2 flex-shrink-0" />
                                      <span className="truncate">
                                        Unban User
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <Ban className="h-4 w-4 mr-2 flex-shrink-0" />
                                      <span className="truncate">Ban User</span>
                                    </>
                                  )}
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded notification details */}
                {isExpanded && member.notificationSettings && (
                  <div className="px-3 pb-3 border-t bg-muted/30">
                    <div className="pt-3">
                      <h4 className="text-sm font-medium mb-2">
                        Notification Settings
                      </h4>
                      <MemberNotificationStatus
                        notificationSettings={member.notificationSettings}
                        userName={member.name}
                        compact={false}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
