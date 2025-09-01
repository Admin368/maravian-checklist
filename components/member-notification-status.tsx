import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Bell,
  BellOff,
  Mail,
  UserPlus,
  CheckSquare,
  Calendar,
  Plus,
} from "lucide-react";

interface NotificationStatusProps {
  notificationSettings: {
    notificationOnInvitation: boolean;
    notificationOnAssignment: boolean;
    notificationOnTaskCompletion: boolean;
    notificationOnCheckin: boolean;
    notificationOnNewTasks: boolean;
    hasTeamSpecificSettings: {
      invitation: boolean;
      assignment: boolean;
      taskCompletion: boolean;
      checkin: boolean;
      newTasks: boolean;
    };
  };
  userName: string;
  compact?: boolean;
}

export function MemberNotificationStatus({
  notificationSettings,
  userName,
  compact = false,
}: NotificationStatusProps) {
  const notifications = [
    {
      key: "invitation" as const,
      icon: UserPlus,
      label: "Invitations",
      enabled: notificationSettings.notificationOnInvitation,
      isTeamSpecific: notificationSettings.hasTeamSpecificSettings.invitation,
    },
    {
      key: "assignment" as const,
      icon: Mail,
      label: "Assignments",
      enabled: notificationSettings.notificationOnAssignment,
      isTeamSpecific: notificationSettings.hasTeamSpecificSettings.assignment,
    },
    {
      key: "taskCompletion" as const,
      icon: CheckSquare,
      label: "Completions",
      enabled: notificationSettings.notificationOnTaskCompletion,
      isTeamSpecific:
        notificationSettings.hasTeamSpecificSettings.taskCompletion,
    },
    {
      key: "checkin" as const,
      icon: Calendar,
      label: "Check-ins",
      enabled: notificationSettings.notificationOnCheckin,
      isTeamSpecific: notificationSettings.hasTeamSpecificSettings.checkin,
    },
    {
      key: "newTasks" as const,
      icon: Plus,
      label: "New Tasks",
      enabled: notificationSettings.notificationOnNewTasks,
      isTeamSpecific: notificationSettings.hasTeamSpecificSettings.newTasks,
    },
  ];

  const enabledNotifications = notifications.filter((n) => n.enabled);
  const disabledNotifications = notifications.filter((n) => !n.enabled);
  const allDisabled = enabledNotifications.length === 0;

  if (compact) {
    // Compact view - just show a bell icon with count
    const enabledCount = enabledNotifications.length;
    const teamSpecificCount = enabledNotifications.filter(
      (n) => n.isTeamSpecific
    ).length;

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant={allDisabled ? "secondary" : "outline"}
              className={`flex items-center gap-1 text-xs ${
                allDisabled ? "text-muted-foreground" : ""
              }`}
            >
              {allDisabled ? (
                <BellOff className="h-3 w-3" />
              ) : (
                <Bell className="h-3 w-3" />
              )}
              {enabledCount}/5
              {teamSpecificCount > 0 && (
                <span className="text-blue-600 font-medium">*</span>
              )}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-sm">
            <div className="space-y-2">
              <p className="font-medium">{userName}'s Notification Settings</p>
              {enabledNotifications.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-green-600 mb-1">
                    Enabled:
                  </p>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    {enabledNotifications.map((notification) => {
                      const Icon = notification.icon;
                      return (
                        <div
                          key={notification.key}
                          className="flex items-center gap-1"
                        >
                          <Icon className="h-3 w-3" />
                          {notification.label}
                          {notification.isTeamSpecific && (
                            <span className="text-blue-600">*</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {disabledNotifications.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-red-600 mb-1">
                    Disabled:
                  </p>
                  <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                    {disabledNotifications.map((notification) => {
                      const Icon = notification.icon;
                      return (
                        <div
                          key={notification.key}
                          className="flex items-center gap-1"
                        >
                          <Icon className="h-3 w-3" />
                          {notification.label}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground border-t pt-2">
                * = Team-specific setting (overrides global preference)
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Full view - show individual notification badges
  return (
    <div className="flex flex-wrap gap-1">
      {notifications.map((notification) => {
        const Icon = notification.icon;
        return (
          <TooltipProvider key={notification.key}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant={notification.enabled ? "default" : "secondary"}
                  className={`flex items-center gap-1 text-xs ${
                    notification.enabled
                      ? notification.isTeamSpecific
                        ? "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900 dark:text-blue-200"
                        : ""
                      : "text-muted-foreground opacity-60"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {notification.isTeamSpecific && notification.enabled && "*"}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>
                  {notification.label}:{" "}
                  {notification.enabled ? "Enabled" : "Disabled"}
                  {notification.isTeamSpecific && " (Team-specific)"}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      })}
    </div>
  );
}
