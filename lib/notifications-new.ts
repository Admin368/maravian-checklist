import { EmailService } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

export interface NotificationContext {
  teamId: string;
  actorUserId: string; // User who performed the action
  notificationType:
    | "invitation"
    | "assignment"
    | "task_completion"
    | "checkin"
    | "new_tasks";
}

export interface TaskNotificationData {
  taskId: string;
  taskTitle: string;
  assignedToUserId?: string;
  completedByUserId?: string;
}

export interface CheckinNotificationData {
  checkinUserId: string;
  checkinUserName: string;
  notes?: string;
}

export interface TeamInviteNotificationData {
  invitedUserId: string;
  invitedByUserId: string;
}

/**
 * Determines if a user should receive notifications based on their profile settings and team-specific settings
 */
async function shouldNotifyUser(
  userId: string,
  teamId: string,
  notificationType: NotificationContext["notificationType"],
  actorUserId: string
): Promise<boolean> {
  // Don't notify the user about their own actions
  if (userId === actorUserId) {
    return false;
  }

  // Get user's global notification preferences
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      notificationOnInvitation: true,
      notificationOnAssignment: true,
      notificationOnTaskCompletion: true,
      notificationOnCheckin: true,
      notificationOnNewTasks: true,
    },
  });

  if (!user) return false;

  // Check global user preference first
  let globalPrefEnabled = false;
  switch (notificationType) {
    case "invitation":
      globalPrefEnabled = user.notificationOnInvitation;
      break;
    case "assignment":
      globalPrefEnabled = user.notificationOnAssignment;
      break;
    case "task_completion":
      globalPrefEnabled = user.notificationOnTaskCompletion;
      break;
    case "checkin":
      globalPrefEnabled = user.notificationOnCheckin;
      break;
    case "new_tasks":
      globalPrefEnabled = user.notificationOnNewTasks;
      break;
  }

  // If global preference is disabled, don't send notification
  if (!globalPrefEnabled) {
    return false;
  }

  // Check team-specific notification settings using the many-to-many relationship
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      notificationOnInvitationUserIds: {
        where: { id: userId },
        select: { id: true },
      },
      notificationOnAssignmentUserIds: {
        where: { id: userId },
        select: { id: true },
      },
      notificationOnTaskCompletionUserIds: {
        where: { id: userId },
        select: { id: true },
      },
      notificationOnCheckinUserIds: {
        where: { id: userId },
        select: { id: true },
      },
      notificationOnNewTasksUserIds: {
        where: { id: userId },
        select: { id: true },
      },
    },
  });

  if (!team) return false;

  // Check if user has enabled this notification type for this team
  let teamPrefEnabled = false;
  switch (notificationType) {
    case "invitation":
      teamPrefEnabled = team.notificationOnInvitationUserIds.length > 0;
      break;
    case "assignment":
      teamPrefEnabled = team.notificationOnAssignmentUserIds.length > 0;
      break;
    case "task_completion":
      teamPrefEnabled = team.notificationOnTaskCompletionUserIds.length > 0;
      break;
    case "checkin":
      teamPrefEnabled = team.notificationOnCheckinUserIds.length > 0;
      break;
    case "new_tasks":
      teamPrefEnabled = team.notificationOnNewTasksUserIds.length > 0;
      break;
  }

  return teamPrefEnabled;
}

/**
 * Send task assignment notification
 */
export async function sendTaskAssignmentNotification(
  context: NotificationContext,
  data: TaskNotificationData
) {
  if (!data.assignedToUserId) return;

  const shouldNotify = await shouldNotifyUser(
    data.assignedToUserId,
    context.teamId,
    "assignment",
    context.actorUserId
  );

  if (!shouldNotify) return;

  try {
    // Get user, team, and actor details
    const [assignedUser, team, actor] = await Promise.all([
      prisma.user.findUnique({ where: { id: data.assignedToUserId } }),
      prisma.team.findUnique({ where: { id: context.teamId } }),
      prisma.user.findUnique({ where: { id: context.actorUserId } }),
    ]);

    if (!assignedUser?.email || !team || !actor) return;

    await EmailService.sendTaskAssignmentEmail(assignedUser.email, {
      recipientName: assignedUser.name,
      assignedByName: actor.name,
      taskTitle: data.taskTitle,
      teamName: team.name,
      teamSlug: team.slug,
      appUrl: env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    });
  } catch (error) {
    console.error("Failed to send task assignment notification:", error);
  }
}

/**
 * Send task completion notification to team members
 */
export async function sendTaskCompletionNotification(
  context: NotificationContext,
  data: TaskNotificationData
) {
  try {
    // Get team members who should be notified
    const team = await prisma.team.findUnique({
      where: { id: context.teamId },
      include: {
        members: {
          include: { user: true },
        },
      },
    });

    if (!team) return;

    const completedByUser = await prisma.user.findUnique({
      where: { id: context.actorUserId },
    });

    if (!completedByUser) return;

    // Notify all team members (filtering will be done by shouldNotifyUser)
    const notificationPromises = team.members.map(async (member) => {
      const shouldNotify = await shouldNotifyUser(
        member.userId,
        context.teamId,
        "task_completion",
        context.actorUserId
      );

      if (!shouldNotify || !member.user.email) return;

      return EmailService.sendTaskCompletionEmail(member.user.email, {
        recipientName: member.user.name,
        completedByName: completedByUser.name,
        taskTitle: data.taskTitle,
        teamName: team.name,
        teamSlug: team.slug,
        appUrl: env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      });
    });

    await Promise.all(notificationPromises);
  } catch (error) {
    console.error("Failed to send task completion notification:", error);
  }
}

/**
 * Send check-in notification to team members
 */
export async function sendCheckinNotification(
  context: NotificationContext,
  data: CheckinNotificationData
) {
  try {
    // Get team members who should be notified
    const team = await prisma.team.findUnique({
      where: { id: context.teamId },
      include: {
        members: {
          include: { user: true },
        },
      },
    });

    if (!team) return;

    // Notify all team members (filtering will be done by shouldNotifyUser)
    const notificationPromises = team.members.map(async (member) => {
      const shouldNotify = await shouldNotifyUser(
        member.userId,
        context.teamId,
        "checkin",
        context.actorUserId
      );

      if (!shouldNotify || !member.user.email) return;

      return EmailService.sendCheckinNotificationEmail(member.user.email, {
        recipientName: member.user.name,
        checkedInUserName: data.checkinUserName,
        teamName: team.name,
        teamSlug: team.slug,
        appUrl: env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        notes: data.notes,
      });
    });

    await Promise.all(notificationPromises);
  } catch (error) {
    console.error("Failed to send check-in notification:", error);
  }
}

/**
 * Send new task notification to team members
 */
export async function sendNewTaskNotification(
  context: NotificationContext,
  data: TaskNotificationData & { taskType: string }
) {
  try {
    // Get team members who should be notified
    const team = await prisma.team.findUnique({
      where: { id: context.teamId },
      include: {
        members: {
          include: { user: true },
        },
      },
    });

    if (!team) return;

    const createdByUser = await prisma.user.findUnique({
      where: { id: context.actorUserId },
    });

    if (!createdByUser) return;

    // Notify all team members (filtering will be done by shouldNotifyUser)
    const notificationPromises = team.members.map(async (member) => {
      const shouldNotify = await shouldNotifyUser(
        member.userId,
        context.teamId,
        "new_tasks",
        context.actorUserId
      );

      if (!shouldNotify || !member.user.email) return;

      return EmailService.sendNewTaskEmail(member.user.email, {
        recipientName: member.user.name,
        createdByName: createdByUser.name,
        taskTitle: data.taskTitle,
        teamName: team.name,
        teamSlug: team.slug,
        appUrl: env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        taskType: (data as any).taskType,
      });
    });

    await Promise.all(notificationPromises);
  } catch (error) {
    console.error("Failed to send new task notification:", error);
  }
}

/**
 * Add user to team notification settings when they join a team
 */
export async function addUserToTeamNotifications(
  userId: string,
  teamId: string
) {
  try {
    // Get user's global notification preferences
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        notificationOnInvitation: true,
        notificationOnAssignment: true,
        notificationOnTaskCompletion: true,
        notificationOnCheckin: true,
        notificationOnNewTasks: true,
      },
    });

    if (!user) return;

    // Connect user to team notification settings based on their global preferences
    const updateData: any = {};

    if (user.notificationOnInvitation) {
      updateData.notificationOnInvitationUserIds = { connect: { id: userId } };
    }

    if (user.notificationOnAssignment) {
      updateData.notificationOnAssignmentUserIds = { connect: { id: userId } };
    }

    if (user.notificationOnTaskCompletion) {
      updateData.notificationOnTaskCompletionUserIds = {
        connect: { id: userId },
      };
    }

    if (user.notificationOnCheckin) {
      updateData.notificationOnCheckinUserIds = { connect: { id: userId } };
    }

    if (user.notificationOnNewTasks) {
      updateData.notificationOnNewTasksUserIds = { connect: { id: userId } };
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.team.update({
        where: { id: teamId },
        data: updateData,
      });
    }
  } catch (error) {
    console.error("Failed to add user to team notifications:", error);
  }
}

/**
 * Update user's team notification preferences
 */
export async function updateTeamNotificationPreferences(
  userId: string,
  teamId: string,
  preferences: {
    notificationOnInvitation?: boolean;
    notificationOnAssignment?: boolean;
    notificationOnTaskCompletion?: boolean;
    notificationOnCheckin?: boolean;
    notificationOnNewTasks?: boolean;
  }
) {
  try {
    const updateOperations: any = {};

    // For each notification type, connect or disconnect the user
    if (preferences.notificationOnInvitation !== undefined) {
      updateOperations.notificationOnInvitationUserIds =
        preferences.notificationOnInvitation
          ? { connect: { id: userId } }
          : { disconnect: { id: userId } };
    }

    if (preferences.notificationOnAssignment !== undefined) {
      updateOperations.notificationOnAssignmentUserIds =
        preferences.notificationOnAssignment
          ? { connect: { id: userId } }
          : { disconnect: { id: userId } };
    }

    if (preferences.notificationOnTaskCompletion !== undefined) {
      updateOperations.notificationOnTaskCompletionUserIds =
        preferences.notificationOnTaskCompletion
          ? { connect: { id: userId } }
          : { disconnect: { id: userId } };
    }

    if (preferences.notificationOnCheckin !== undefined) {
      updateOperations.notificationOnCheckinUserIds =
        preferences.notificationOnCheckin
          ? { connect: { id: userId } }
          : { disconnect: { id: userId } };
    }

    if (preferences.notificationOnNewTasks !== undefined) {
      updateOperations.notificationOnNewTasksUserIds =
        preferences.notificationOnNewTasks
          ? { connect: { id: userId } }
          : { disconnect: { id: userId } };
    }

    if (Object.keys(updateOperations).length > 0) {
      await prisma.team.update({
        where: { id: teamId },
        data: updateOperations,
      });
    }
  } catch (error) {
    console.error("Failed to update team notification preferences:", error);
  }
}
