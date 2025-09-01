"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/lib/trpc/client";
import { toast } from "sonner";
import { Icons } from "@/components/icons";
import {
  Bell,
  BellOff,
  Mail,
  UserPlus,
  CheckSquare,
  Calendar,
  Plus,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";

const teamNotificationSettingsSchema = z.object({
  notificationOnInvitation: z.boolean().optional(),
  notificationOnAssignment: z.boolean().optional(),
  notificationOnTaskCompletion: z.boolean().optional(),
  notificationOnCheckin: z.boolean().optional(),
  notificationOnNewTasks: z.boolean().optional(),
});

type TeamNotificationFormData = z.infer<typeof teamNotificationSettingsSchema>;

interface TeamNotificationSettingsProps {
  teamId: string;
  teamName: string;
}

export function TeamNotificationSettings({
  teamId,
  teamName,
}: TeamNotificationSettingsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const utils = api.useUtils();

  // Fetch current team notification settings for this user
  const { data: currentSettings, isLoading: isLoadingSettings } =
    api.notifications.getTeamSettings.useQuery({ teamId });

  // Fetch user's global notification settings to detect conflicts
  const { data: userProfile } = api.users.me.useQuery();

  // Update notification settings mutation
  const updateTeamNotificationSettings =
    api.notifications.updateTeamSettings.useMutation({
      onSuccess: () => {
        toast.success(`Notification settings updated for ${teamName}`);
        setIsEditing(false);
        // Invalidate and refetch the team settings
        utils.notifications.getTeamSettings.invalidate({ teamId });
      },
      onError: (error) => {
        toast.error(error.message || "Something went wrong. Please try again.");
        console.error(error);
      },
    });

  const { watch, setValue, handleSubmit, reset } =
    useForm<TeamNotificationFormData>({
      resolver: zodResolver(teamNotificationSettingsSchema),
      defaultValues: {
        notificationOnInvitation: true,
        notificationOnAssignment: true,
        notificationOnTaskCompletion: true,
        notificationOnCheckin: true,
        notificationOnNewTasks: true,
      },
    });

  // Update form values when currentSettings data loads
  useEffect(() => {
    if (currentSettings) {
      reset({
        notificationOnInvitation: currentSettings.notificationOnInvitation,
        notificationOnAssignment: currentSettings.notificationOnAssignment,
        notificationOnTaskCompletion:
          currentSettings.notificationOnTaskCompletion,
        notificationOnCheckin: currentSettings.notificationOnCheckin,
        notificationOnNewTasks: currentSettings.notificationOnNewTasks,
      });
    }
  }, [currentSettings, reset]);

  // Watch all form values
  const formValues = watch();

  // Helper function to detect conflicts between team and global settings
  const getConflictStatus = (
    teamSetting: boolean | undefined,
    globalSetting: boolean | undefined,
    settingName: string
  ) => {
    if (!userProfile || teamSetting === undefined) return null;

    // If team setting is enabled but global setting is disabled, there's a conflict
    if (teamSetting && !globalSetting) {
      return {
        hasConflict: true,
        message: `Your global ${settingName} setting is disabled. You won't receive these notifications even though they're enabled for this team.`,
      };
    }

    return { hasConflict: false, message: null };
  };

  // Calculate conflicts for each notification type
  const conflicts = {
    invitation: getConflictStatus(
      formValues.notificationOnInvitation,
      userProfile?.notificationOnInvitation,
      "team invitation"
    ),
    assignment: getConflictStatus(
      formValues.notificationOnAssignment,
      userProfile?.notificationOnAssignment,
      "task assignment"
    ),
    completion: getConflictStatus(
      formValues.notificationOnTaskCompletion,
      userProfile?.notificationOnTaskCompletion,
      "task completion"
    ),
    checkIn: getConflictStatus(
      formValues.notificationOnCheckin,
      userProfile?.notificationOnCheckin,
      "check-in"
    ),
    newTask: getConflictStatus(
      formValues.notificationOnNewTasks,
      userProfile?.notificationOnNewTasks,
      "new task"
    ),
  };

  const hasAnyConflicts = Object.values(conflicts).some(
    (conflict) => conflict?.hasConflict
  );

  async function onSubmit(data: TeamNotificationFormData) {
    updateTeamNotificationSettings.mutate({
      teamId,
      ...data,
    });
  }

  function handleCancel() {
    setIsEditing(false);
    if (currentSettings) {
      reset({
        notificationOnInvitation: currentSettings.notificationOnInvitation,
        notificationOnAssignment: currentSettings.notificationOnAssignment,
        notificationOnTaskCompletion:
          currentSettings.notificationOnTaskCompletion,
        notificationOnCheckin: currentSettings.notificationOnCheckin,
        notificationOnNewTasks: currentSettings.notificationOnNewTasks,
      });
    }
  }

  const handleSwitchChange = (
    field: keyof TeamNotificationFormData,
    value: boolean
  ) => {
    setValue(field, value);
  };

  const allNotificationsDisabled = !Object.values(formValues).some(Boolean);

  // Component to show conflict warnings
  const ConflictWarning = ({
    conflict,
  }: {
    conflict: { hasConflict: boolean; message: string | null } | null;
  }) => {
    if (!conflict?.hasConflict || !conflict.message) return null;

    return (
      <div className="mt-1 p-2 bg-red-50 border border-red-200 rounded-md dark:bg-red-950 dark:border-red-800">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-red-700 dark:text-red-300">
            <p>{conflict.message}</p>
            <a
              href="/account#notifications"
              className="inline-flex items-center gap-1 text-red-800 dark:text-red-200 underline hover:no-underline mt-1"
            >
              Fix in Account Settings
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>
    );
  };

  // Show loading state while fetching settings
  if (isLoadingSettings) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Team Notifications
          </CardTitle>
          <CardDescription>
            Manage your notification preferences for {teamName}. These settings
            override your global preferences for this team only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-6">
            <Icons.spinner className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading notification settings...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {allNotificationsDisabled ? (
            <BellOff className="h-5 w-5" />
          ) : (
            <Bell className="h-5 w-5" />
          )}
          My Notification Preferences
        </CardTitle>
        <CardDescription>
          Manage your personal notification preferences for {teamName}. These
          settings override your global account preferences for this team only.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label
                    htmlFor="team-invitation-notifications"
                    className="text-base font-medium flex items-center gap-2"
                  >
                    <UserPlus className="h-4 w-4" />
                    Team Invitations
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified when others are invited to this team
                  </p>
                </div>
                <Switch
                  id="team-invitation-notifications"
                  checked={formValues.notificationOnInvitation ?? true}
                  onCheckedChange={(value) =>
                    handleSwitchChange("notificationOnInvitation", value)
                  }
                  disabled={
                    updateTeamNotificationSettings.isLoading || !isEditing
                  }
                />
              </div>
              <ConflictWarning conflict={conflicts.invitation} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label
                    htmlFor="team-assignment-notifications"
                    className="text-base font-medium flex items-center gap-2"
                  >
                    <Mail className="h-4 w-4" />
                    Task Assignments
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified when tasks are assigned in this team
                  </p>
                </div>
                <Switch
                  id="team-assignment-notifications"
                  checked={formValues.notificationOnAssignment ?? true}
                  onCheckedChange={(value) =>
                    handleSwitchChange("notificationOnAssignment", value)
                  }
                  disabled={
                    updateTeamNotificationSettings.isLoading || !isEditing
                  }
                />
              </div>
              <ConflictWarning conflict={conflicts.assignment} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label
                    htmlFor="team-completion-notifications"
                    className="text-base font-medium flex items-center gap-2"
                  >
                    <CheckSquare className="h-4 w-4" />
                    Task Completions
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified when team members complete tasks
                  </p>
                </div>
                <Switch
                  id="team-completion-notifications"
                  checked={formValues.notificationOnTaskCompletion ?? true}
                  onCheckedChange={(value) =>
                    handleSwitchChange("notificationOnTaskCompletion", value)
                  }
                  disabled={
                    updateTeamNotificationSettings.isLoading || !isEditing
                  }
                />
              </div>
              <ConflictWarning conflict={conflicts.completion} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label
                    htmlFor="team-checkin-notifications"
                    className="text-base font-medium flex items-center gap-2"
                  >
                    <Calendar className="h-4 w-4" />
                    Team Check-ins
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified when team members check in
                  </p>
                </div>
                <Switch
                  id="team-checkin-notifications"
                  checked={formValues.notificationOnCheckin ?? true}
                  onCheckedChange={(value) =>
                    handleSwitchChange("notificationOnCheckin", value)
                  }
                  disabled={
                    updateTeamNotificationSettings.isLoading || !isEditing
                  }
                />
              </div>
              <ConflictWarning conflict={conflicts.checkIn} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label
                    htmlFor="team-new-task-notifications"
                    className="text-base font-medium flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    New Tasks
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified when new tasks are created in this team
                  </p>
                </div>
                <Switch
                  id="team-new-task-notifications"
                  checked={formValues.notificationOnNewTasks ?? true}
                  onCheckedChange={(value) =>
                    handleSwitchChange("notificationOnNewTasks", value)
                  }
                  disabled={
                    updateTeamNotificationSettings.isLoading || !isEditing
                  }
                />
              </div>
              <ConflictWarning conflict={conflicts.newTask} />
            </div>
          </div>

          <div className="pt-4 border-t">
            <div className="flex gap-4">
              {!isEditing ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditing(true)}
                >
                  Edit My Notification Preferences
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={updateTeamNotificationSettings.isLoading}
                  >
                    {updateTeamNotificationSettings.isLoading && (
                      <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Save My Preferences
                  </Button>
                </>
              )}
            </div>

            {!isEditing && allNotificationsDisabled && (
              <div className="mt-4 p-3 rounded-md bg-orange-50 border border-orange-200 dark:bg-orange-950 dark:border-orange-800">
                <p className="text-sm text-orange-800 dark:text-orange-200 flex items-center gap-2">
                  <BellOff className="h-4 w-4" />
                  All notifications for this team are disabled. You won't
                  receive any notification emails about {teamName}.
                </p>
              </div>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
