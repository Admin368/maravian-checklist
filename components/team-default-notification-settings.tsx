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
  Settings,
  Mail,
  UserPlus,
  CheckSquare,
  Calendar,
  Plus,
} from "lucide-react";

const teamDefaultSettingsSchema = z.object({
  defaultNotificationOnInvitation: z.boolean().optional(),
  defaultNotificationOnAssignment: z.boolean().optional(),
  defaultNotificationOnTaskCompletion: z.boolean().optional(),
  defaultNotificationOnCheckin: z.boolean().optional(),
  defaultNotificationOnNewTasks: z.boolean().optional(),
});

type TeamDefaultFormData = z.infer<typeof teamDefaultSettingsSchema>;

interface TeamDefaultNotificationSettingsProps {
  teamId: string;
  teamName: string;
  userRole: string;
}

export function TeamDefaultNotificationSettings({
  teamId,
  teamName,
  userRole,
}: TeamDefaultNotificationSettingsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const utils = api.useUtils();

  const isAdmin = userRole === "admin" || userRole === "owner";

  // Fetch current team default settings
  const { data: currentDefaults, isLoading: isLoadingDefaults } =
    api.notifications.getTeamDefaults.useQuery(
      { teamId },
      { enabled: isAdmin }
    );

  // Update team default settings mutation
  const updateTeamDefaults = api.notifications.updateTeamDefaults.useMutation({
    onSuccess: () => {
      toast.success(`Default notification settings updated for ${teamName}`);
      setIsEditing(false);
      utils.notifications.getTeamDefaults.invalidate({ teamId });
    },
    onError: (error) => {
      toast.error(error.message || "Something went wrong. Please try again.");
      console.error(error);
    },
  });

  const { watch, setValue, handleSubmit, reset } = useForm<TeamDefaultFormData>(
    {
      resolver: zodResolver(teamDefaultSettingsSchema),
      defaultValues: {
        defaultNotificationOnInvitation: true,
        defaultNotificationOnAssignment: true,
        defaultNotificationOnTaskCompletion: true,
        defaultNotificationOnCheckin: true,
        defaultNotificationOnNewTasks: true,
      },
    }
  );

  // Update form values when currentDefaults data loads
  useEffect(() => {
    if (currentDefaults) {
      reset({
        defaultNotificationOnInvitation:
          currentDefaults.defaultNotificationOnInvitation,
        defaultNotificationOnAssignment:
          currentDefaults.defaultNotificationOnAssignment,
        defaultNotificationOnTaskCompletion:
          currentDefaults.defaultNotificationOnTaskCompletion,
        defaultNotificationOnCheckin:
          currentDefaults.defaultNotificationOnCheckin,
        defaultNotificationOnNewTasks:
          currentDefaults.defaultNotificationOnNewTasks,
      });
    }
  }, [currentDefaults, reset]);

  // Watch all form values
  const formValues = watch();

  async function onSubmit(data: TeamDefaultFormData) {
    updateTeamDefaults.mutate({
      teamId,
      ...data,
    });
  }

  function handleCancel() {
    setIsEditing(false);
    if (currentDefaults) {
      reset({
        defaultNotificationOnInvitation:
          currentDefaults.defaultNotificationOnInvitation,
        defaultNotificationOnAssignment:
          currentDefaults.defaultNotificationOnAssignment,
        defaultNotificationOnTaskCompletion:
          currentDefaults.defaultNotificationOnTaskCompletion,
        defaultNotificationOnCheckin:
          currentDefaults.defaultNotificationOnCheckin,
        defaultNotificationOnNewTasks:
          currentDefaults.defaultNotificationOnNewTasks,
      });
    }
  }

  const handleSwitchChange = (
    field: keyof TeamDefaultFormData,
    value: boolean
  ) => {
    setValue(field, value);
  };

  if (!isAdmin) {
    return null;
  }

  // Show loading state while fetching settings
  if (isLoadingDefaults) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Default Notification Settings
          </CardTitle>
          <CardDescription>
            Set default notification preferences for new team members
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-6">
            <Icons.spinner className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading default settings...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const allNotificationsDisabled = !Object.values(formValues).some(Boolean);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {allNotificationsDisabled ? (
            <Bell className="h-5 w-5 text-muted-foreground" />
          ) : (
            <Settings className="h-5 w-5" />
          )}
          Default Notification Settings
        </CardTitle>
        <CardDescription>
          Set default notification preferences for new team members joining{" "}
          {teamName}. These settings will be applied when users accept
          invitations or join the team.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label
                    htmlFor="default-invitation-notifications"
                    className="text-base font-medium flex items-center gap-2"
                  >
                    <UserPlus className="h-4 w-4" />
                    Team Invitations
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    New members will be notified about team invitations by
                    default
                  </p>
                </div>
                <Switch
                  id="default-invitation-notifications"
                  checked={formValues.defaultNotificationOnInvitation ?? true}
                  onCheckedChange={(value) =>
                    handleSwitchChange("defaultNotificationOnInvitation", value)
                  }
                  disabled={updateTeamDefaults.isLoading || !isEditing}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label
                    htmlFor="default-assignment-notifications"
                    className="text-base font-medium flex items-center gap-2"
                  >
                    <Mail className="h-4 w-4" />
                    Task Assignments
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    New members will be notified about task assignments by
                    default
                  </p>
                </div>
                <Switch
                  id="default-assignment-notifications"
                  checked={formValues.defaultNotificationOnAssignment ?? true}
                  onCheckedChange={(value) =>
                    handleSwitchChange("defaultNotificationOnAssignment", value)
                  }
                  disabled={updateTeamDefaults.isLoading || !isEditing}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label
                    htmlFor="default-completion-notifications"
                    className="text-base font-medium flex items-center gap-2"
                  >
                    <CheckSquare className="h-4 w-4" />
                    Task Completions
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    New members will be notified about task completions by
                    default
                  </p>
                </div>
                <Switch
                  id="default-completion-notifications"
                  checked={
                    formValues.defaultNotificationOnTaskCompletion ?? true
                  }
                  onCheckedChange={(value) =>
                    handleSwitchChange(
                      "defaultNotificationOnTaskCompletion",
                      value
                    )
                  }
                  disabled={updateTeamDefaults.isLoading || !isEditing}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label
                    htmlFor="default-checkin-notifications"
                    className="text-base font-medium flex items-center gap-2"
                  >
                    <Calendar className="h-4 w-4" />
                    Team Check-ins
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    New members will be notified about team check-ins by default
                  </p>
                </div>
                <Switch
                  id="default-checkin-notifications"
                  checked={formValues.defaultNotificationOnCheckin ?? true}
                  onCheckedChange={(value) =>
                    handleSwitchChange("defaultNotificationOnCheckin", value)
                  }
                  disabled={updateTeamDefaults.isLoading || !isEditing}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label
                    htmlFor="default-newtask-notifications"
                    className="text-base font-medium flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    New Tasks
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    New members will be notified about new tasks by default
                  </p>
                </div>
                <Switch
                  id="default-newtask-notifications"
                  checked={formValues.defaultNotificationOnNewTasks ?? true}
                  onCheckedChange={(value) =>
                    handleSwitchChange("defaultNotificationOnNewTasks", value)
                  }
                  disabled={updateTeamDefaults.isLoading || !isEditing}
                />
              </div>
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
                  Edit Default Settings
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
                  <Button type="submit" disabled={updateTeamDefaults.isLoading}>
                    {updateTeamDefaults.isLoading && (
                      <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Save Default Settings
                  </Button>
                </>
              )}
            </div>

            {!isEditing && allNotificationsDisabled && (
              <div className="mt-4 p-3 rounded-md bg-orange-50 border border-orange-200 dark:bg-orange-950 dark:border-orange-800">
                <p className="text-sm text-orange-800 dark:text-orange-200 flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  All default notifications are disabled. New team members won't
                  receive any notification emails by default.
                </p>
              </div>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
