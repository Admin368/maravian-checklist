"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { TaskList } from "@/components/task-list";
import { api } from "@/lib/trpc/client";
import {
  Loader2,
  ExternalLink,
  Copy,
  Trash2,
  Ban,
  Settings,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { CheckInButton } from "@/components/check-in-button";
import { CheckInStatusBar } from "@/components/check-in-status-bar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import CheckInsPage from "./check-ins/page";
import { UserList } from "@/components/user-list";
import { useSession } from "next-auth/react";
import { CheckoutDialog } from "@/components/checkout-dialog";
import { format } from "date-fns";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { DatePicker } from "@/components/date-picker";
import { CloneTeamButton } from "@/components/clone-team-button";
import { ChecklistComponent } from "@/components/checklist";

export default function TeamPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;
  const [teamLoaded, setTeamLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState("tasks");
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const today = format(new Date(), "yyyy-MM-dd");
  const [selectedDate, setSelectedDate] = useState(new Date());

  const { data: teamData, isLoading } = api.teams.getBySlug.useQuery(
    { slug },
    {
      enabled: !teamLoaded,
      onError: (error) => {
        toast.error("Team not found or you don't have access.");
        router.push("/");
      },
    }
  );
  // const teamMembers = team?.members;
  const { team, teamMembers } = teamData || {};

  // Add isCloneable property with default value if it doesn't exist
  const teamWithCloneable = team
    ? { ...team, isCloneable: team?.isCloneable ?? true }
    : undefined;
  // Verify team access
  const { data: accessData } = api.teams.verifyAccess.useQuery(
    { teamId: team?.id || "" },
    {
      enabled: !!team?.id,
      onSuccess: (data) => {
        if (!data.hasAccess) {
          if (data.reason === "banned") {
            toast.error("You have been banned from this team.");
          }
          router.push(`/team/${slug}/join`);
        } else {
          setTeamLoaded(true);
        }
      },
      onError: () => {
        router.push(`/team/${slug}/join`);
      },
    }
  );

  // Get team members count for check-in status
  // const { data: teamMembers } = api.users.getTeamMembers.useQuery(
  //   { teamId: team?.id || "" },
  //   { enabled: !!team?.id && teamLoaded }
  // );
  const {
    data: checkIns,
    isLoading: checkInsIsLoading,
    refetch: refreshCheckIns,
  } = api.checkIns.getByTeamAndDate.useQuery(
    {
      teamId: team?.id || "",
      date: today,
    },
    {
      enabled: !!team?.id,
      // retry: false,
      refetchInterval: 1000 * 60 * 1, // ms * sec * min
      onError: (error) => {
        toast.error("Failed to get check-ins. Please refresh the page.");
      },
    }
  );
  // const isCheckedIn = checkIns?.some((checkIn) => checkIn.userId === userId);
  const checkIn = checkIns?.find((checkIn) => checkIn.userId === userId);
  console.log(checkIn);
  const isCheckedIn = checkIn ? true : false;
  // Get current user's role
  const currentUserRole = teamMembers?.find(
    (member: any) => member.id === userId
  )?.role;

  // Check if the current user is an admin
  const isAdmin = currentUserRole === "admin";

  const totalMembers = teamMembers?.length || 0;

  const deleteTeam = api.teams.delete.useMutation({
    onSuccess: () => {
      toast.success("Team deleted successfully.");
      router.push("/");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete team");
    },
  });

  const handleCopyInviteLink = () => {
    try {
      const inviteLink = `${window.location.origin}/team/${slug}/join`;
      const message = `🌟 Maravian Checklist 🌟\nA collaborative task manager with daily check-ins to keep your team in sync!\n\n👋 Join my team "${team?.name}" on Maravian Checklist!\n\n📎 Team Link: ${inviteLink}\n🔑 Team Password: [Get from team admin]\n\nClick the link and use the password to join our team. Let's collaborate together!`;

      if (navigator && navigator.clipboard) {
        navigator.clipboard
          .writeText(message)
          .then(() => {
            toast.success("Invite link copied to clipboard");
          })
          .catch((err) => {
            console.error("Failed to copy:", err);
            toast.error("Failed to copy invite link");
          });
      } else {
        // Fallback for browsers without clipboard API
        const textarea = document.createElement("textarea");
        textarea.value = message;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);

        toast.success("Invite link copied to clipboard");
      }
    } catch (error) {
      console.error("Copy error:", error);
      toast.error("Failed to copy invite link");
    }
  };

  if (isLoading || !teamLoaded) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!team) {
    return null;
  }

  return (
    <div className="container mx-auto py-6 max-w-5xl">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sidebar for check-ins */}
        <div className="space-y-6">
          <CheckInButton
            teamId={team.id}
            checkIns={checkIns || []}
            refetch={refreshCheckIns}
            isCheckedIn={isCheckedIn || false}
          />
          <CheckInStatusBar
            teamId={team.id}
            totalMembers={totalMembers}
            checkIns={checkIns || []}
            isLoading={checkInsIsLoading}
          />

          <Button
            variant="outline"
            className="w-full"
            onClick={handleCopyInviteLink}
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy Invite Message
          </Button>

          <CloneTeamButton
            teamId={teamWithCloneable?.id || ""}
            teamName={teamWithCloneable?.name || ""}
            isCloneable={teamWithCloneable?.isCloneable ?? true}
          />

          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.push(`/team/${slug}/check-ins`)}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            View Full Check-in History
          </Button>
          {checkIn && (
            <CheckoutDialog
              isDisabled={!isCheckedIn}
              // teamId={team.id}
              // userId={userId}
              checkInData={checkIn}
              refetch={refreshCheckIns}
            />
          )}

          {isAdmin && (
            <Button
              variant="outline"
              className="w-full"
              // size="sm"
              onClick={() => router.push(`/team/${slug}/settings`)}
            >
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          )}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="hidden">
                <Trash2 className="h-4 w-4 mr-2" /> Delete Team
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action will delete the team and all associated data. This
                  action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground"
                  onClick={async () => {
                    try {
                      if (!teamData?.team?.id) return;
                      await deleteTeam.mutateAsync({
                        teamId: teamData.team.id,
                      });
                    } catch (error) {
                      // Handled in mutation
                    }
                  }}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Main content area */}
        <div className="lg:col-span-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full max-w-md mx-auto mb-4 sm:mb-8 overflow-hidden flex flex-wrap gap-1">
              <TabsTrigger
                value="tasks"
                onClick={() => setActiveTab("tasks")}
                className="flex-grow basis-auto text-xs sm:text-sm px-1 sm:px-3"
              >
                Recurring
              </TabsTrigger>
              <TabsTrigger
                value="checklists"
                onClick={() => setActiveTab("checklists")}
                className="flex-grow basis-auto text-xs sm:text-sm px-1 sm:px-3"
              >
                LongTerm
              </TabsTrigger>
              <TabsTrigger
                value="members"
                onClick={() => setActiveTab("members")}
                className="flex-grow basis-auto text-xs sm:text-sm px-1 sm:px-3"
              >
                Members
              </TabsTrigger>
              <TabsTrigger
                value="check-ins"
                onClick={() => setActiveTab("check-ins")}
                className="flex-grow basis-auto text-xs sm:text-sm px-1 sm:px-3"
              >
                Check-ins
              </TabsTrigger>
            </TabsList>

            <TabsContent value="tasks" className="mt-0">
              <div className="flex flex-col">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                  <div className="flex flex-col mb-4">
                    <p className="text-sm text-muted-foreground mb-4">
                      {`Daily recurring tasks that happen frequently and are
                      tracked separately for each day. When completed, they're
                      recorded for the specific date selected.`}
                    </p>
                    <DatePicker
                      date={selectedDate}
                      onDateChange={setSelectedDate}
                    />
                  </div>
                  {/* <div className="flex space-x-2">
                    <Button
                      onClick={() => {
                        setIsAddingTask(true);
                        setParentTaskId(null);
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Task
                    </Button>
                  </div> */}
                </div>

                <div className="mt-4">
                  <h2 className="text-base sm:text-lg font-semibold mb-2 sm:mb-4">
                    Tasks for {format(selectedDate, "MMM d, yyyy")}
                  </h2>

                  <TaskList
                    teamId={team.id}
                    teamName={team.name}
                    isAdmin={isAdmin}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent
              value="checklists"
              className="space-y-4 sm:space-y-6 mt-0"
            >
              <p className="text-sm text-muted-foreground mb-4">
                Long-term tasks represent ongoing responsibilities or one-time
                activities that persist over time. When completed, they remain
                checked off regardless of the date.
              </p>
              <ChecklistComponent
                teamId={team?.id || ""}
                teamName={team?.name || ""}
                isAdmin={isAdmin}
              />
            </TabsContent>

            <TabsContent
              value="members"
              className="space-y-4 sm:space-y-6 mt-0"
            >
              <UserList
                teamId={team?.id || ""}
                teamMembers={teamMembers || []}
                isAdmin={isAdmin}
              />
            </TabsContent>

            <TabsContent
              value="check-ins"
              className="space-y-4 sm:space-y-6 mt-0 px-0 sm:px-4"
            >
              <CheckInsPage />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
