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
} from "lucide-react";

const notificationSettingsSchema = z.object({
  notificationOnInvitation: z.boolean(),
  notificationOnAssignment: z.boolean(),
  notificationOnTaskCompletion: z.boolean(),
  notificationOnCheckin: z.boolean(),
  notificationOnNewTasks: z.boolean(),
});

type NotificationFormData = z.infer<typeof notificationSettingsSchema>;

export function NotificationSettings() {
  const [isEditing, setIsEditing] = useState(false);

  // Get current user's notification settings
  const {
    data: userProfile,
    isLoading: profileLoading,
    refetch,
  } = api.users.me.useQuery();

  // Update notification settings mutation
  const updateNotificationSettings =
    api.notifications.updateSettings.useMutation({
      onSuccess: () => {
        toast.success("Notification settings updated successfully");
        setIsEditing(false);
        refetch();
      },
      onError: (error) => {
        toast.error(error.message || "Something went wrong. Please try again.");
        console.error(error);
      },
    });

  const { watch, setValue, handleSubmit, reset } =
    useForm<NotificationFormData>({
      resolver: zodResolver(notificationSettingsSchema),
      defaultValues: {
        notificationOnInvitation: true,
        notificationOnAssignment: true,
        notificationOnTaskCompletion: true,
        notificationOnCheckin: true,
        notificationOnNewTasks: true,
      },
    });

  // Watch all form values
  const formValues = watch();

  // Update form values when user profile data changes
  useEffect(() => {
    if (userProfile) {
      reset({
        notificationOnInvitation: userProfile.notificationOnInvitation ?? true,
        notificationOnAssignment: userProfile.notificationOnAssignment ?? true,
        notificationOnTaskCompletion:
          userProfile.notificationOnTaskCompletion ?? true,
        notificationOnCheckin: userProfile.notificationOnCheckin ?? true,
        notificationOnNewTasks: userProfile.notificationOnNewTasks ?? true,
      });
    }
  }, [userProfile, reset]);

  async function onSubmit(data: NotificationFormData) {
    updateNotificationSettings.mutate(data);
  }

  function handleCancel() {
    setIsEditing(false);
    if (userProfile) {
      reset({
        notificationOnInvitation: userProfile.notificationOnInvitation ?? true,
        notificationOnAssignment: userProfile.notificationOnAssignment ?? true,
        notificationOnTaskCompletion:
          userProfile.notificationOnTaskCompletion ?? true,
        notificationOnCheckin: userProfile.notificationOnCheckin ?? true,
        notificationOnNewTasks: userProfile.notificationOnNewTasks ?? true,
      });
    }
  }

  const handleSwitchChange = (
    field: keyof NotificationFormData,
    value: boolean
  ) => {
    setValue(field, value);
  };

  if (profileLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Email Notifications
          </CardTitle>
          <CardDescription>
            Manage when you receive email notifications
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <Icons.spinner className="h-6 w-6 animate-spin" />
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
            <BellOff className="h-5 w-5" />
          ) : (
            <Bell className="h-5 w-5" />
          )}
          Email Notifications
        </CardTitle>
        <CardDescription>
          Manage when you receive email notifications. These are global defaults
          that apply to all teams.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-0.5">
                <Label
                  htmlFor="invitation-notifications"
                  className="text-base font-medium flex items-center gap-2"
                >
                  <UserPlus className="h-4 w-4" />
                  Team Invitations
                </Label>
                <p className="text-sm text-muted-foreground">
                  Get notified when you're invited to join a team
                </p>
              </div>
              <Switch
                id="invitation-notifications"
                checked={formValues.notificationOnInvitation}
                onCheckedChange={(value) =>
                  handleSwitchChange("notificationOnInvitation", value)
                }
                disabled={updateNotificationSettings.isLoading || !isEditing}
              />
            </div>

            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-0.5">
                <Label
                  htmlFor="assignment-notifications"
                  className="text-base font-medium flex items-center gap-2"
                >
                  <Mail className="h-4 w-4" />
                  Task Assignments
                </Label>
                <p className="text-sm text-muted-foreground">
                  Get notified when tasks are assigned to you
                </p>
              </div>
              <Switch
                id="assignment-notifications"
                checked={formValues.notificationOnAssignment}
                onCheckedChange={(value) =>
                  handleSwitchChange("notificationOnAssignment", value)
                }
                disabled={updateNotificationSettings.isLoading || !isEditing}
              />
            </div>

            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-0.5">
                <Label
                  htmlFor="completion-notifications"
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
                id="completion-notifications"
                checked={formValues.notificationOnTaskCompletion}
                onCheckedChange={(value) =>
                  handleSwitchChange("notificationOnTaskCompletion", value)
                }
                disabled={updateNotificationSettings.isLoading || !isEditing}
              />
            </div>

            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-0.5">
                <Label
                  htmlFor="checkin-notifications"
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
                id="checkin-notifications"
                checked={formValues.notificationOnCheckin}
                onCheckedChange={(value) =>
                  handleSwitchChange("notificationOnCheckin", value)
                }
                disabled={updateNotificationSettings.isLoading || !isEditing}
              />
            </div>

            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-0.5">
                <Label
                  htmlFor="new-task-notifications"
                  className="text-base font-medium flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  New Tasks
                </Label>
                <p className="text-sm text-muted-foreground">
                  Get notified when new tasks are created in your teams
                </p>
              </div>
              <Switch
                id="new-task-notifications"
                checked={formValues.notificationOnNewTasks}
                onCheckedChange={(value) =>
                  handleSwitchChange("notificationOnNewTasks", value)
                }
                disabled={updateNotificationSettings.isLoading || !isEditing}
              />
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
                  Edit Notification Settings
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
                    disabled={updateNotificationSettings.isLoading}
                  >
                    {updateNotificationSettings.isLoading && (
                      <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Save Settings
                  </Button>
                </>
              )}
            </div>

            {!isEditing && allNotificationsDisabled && (
              <div className="mt-4 p-3 rounded-md bg-orange-50 border border-orange-200 dark:bg-orange-950 dark:border-orange-800">
                <p className="text-sm text-orange-800 dark:text-orange-200 flex items-center gap-2">
                  <BellOff className="h-4 w-4" />
                  All email notifications are currently disabled. You won't
                  receive any notification emails.
                </p>
              </div>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
