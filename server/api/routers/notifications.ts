import { z } from "zod";
import { router } from "@/lib/trpc/server";
import { protectedProcedure } from "../middleware";
import { TRPCError } from "@trpc/server";

const notificationSettingsSchema = z.object({
  notificationOnInvitation: z.boolean(),
  notificationOnAssignment: z.boolean(),
  notificationOnTaskCompletion: z.boolean(),
  notificationOnCheckin: z.boolean(),
  notificationOnNewTasks: z.boolean(),
});

export const notificationsRouter = router({
  updateSettings: protectedProcedure
    .input(notificationSettingsSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // Update user's notification settings
        const updatedUser = await ctx.prisma.user.update({
          where: { id: ctx.userId },
          data: {
            notificationOnInvitation: input.notificationOnInvitation,
            notificationOnAssignment: input.notificationOnAssignment,
            notificationOnTaskCompletion: input.notificationOnTaskCompletion,
            notificationOnCheckin: input.notificationOnCheckin,
            notificationOnNewTasks: input.notificationOnNewTasks,
          },
          select: {
            id: true,
            name: true,
            email: true,
            notificationOnInvitation: true,
            notificationOnAssignment: true,
            notificationOnTaskCompletion: true,
            notificationOnCheckin: true,
            notificationOnNewTasks: true,
          },
        });

        return {
          message: "Notification settings updated successfully",
          user: updatedUser,
        };
      } catch (error) {
        console.error("Error updating notification settings:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update notification settings",
        });
      }
    }),

  getTeamSettings: protectedProcedure
    .input(z.object({ teamId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        // Verify user is a member of the team
        const teamMember = await ctx.prisma.teamMember.findFirst({
          where: {
            teamId: input.teamId,
            userId: ctx.userId,
          },
        });

        if (!teamMember) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You are not a member of this team",
          });
        }

        // Get team data with notification settings for the user
        const team = await ctx.prisma.team.findUnique({
          where: { id: input.teamId },
          select: {
            id: true,
            name: true,
            notificationOnInvitationUserIds: {
              where: { id: ctx.userId },
              select: { id: true },
            },
            notificationOnAssignmentUserIds: {
              where: { id: ctx.userId },
              select: { id: true },
            },
            notificationOnTaskCompletionUserIds: {
              where: { id: ctx.userId },
              select: { id: true },
            },
            notificationOnCheckinUserIds: {
              where: { id: ctx.userId },
              select: { id: true },
            },
            notificationOnNewTasksUserIds: {
              where: { id: ctx.userId },
              select: { id: true },
            },
          },
        });

        if (!team) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Team not found",
          });
        }

        // Convert the user arrays to boolean flags
        return {
          notificationOnInvitation:
            team.notificationOnInvitationUserIds.length > 0,
          notificationOnAssignment:
            team.notificationOnAssignmentUserIds.length > 0,
          notificationOnTaskCompletion:
            team.notificationOnTaskCompletionUserIds.length > 0,
          notificationOnCheckin: team.notificationOnCheckinUserIds.length > 0,
          notificationOnNewTasks: team.notificationOnNewTasksUserIds.length > 0,
        };
      } catch (error) {
        console.error("Error fetching team notification settings:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch team notification settings",
        });
      }
    }),

  updateTeamSettings: protectedProcedure
    .input(
      z.object({
        teamId: z.string().uuid(),
        notificationOnInvitation: z.boolean().optional(),
        notificationOnAssignment: z.boolean().optional(),
        notificationOnTaskCompletion: z.boolean().optional(),
        notificationOnCheckin: z.boolean().optional(),
        notificationOnNewTasks: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify user is a member of the team
        const teamMember = await ctx.prisma.teamMember.findFirst({
          where: {
            teamId: input.teamId,
            userId: ctx.userId,
          },
        });

        if (!teamMember) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You are not a member of this team",
          });
        }

        // Update team notification preferences for this user
        const { teamId, ...settings } = input;

        // Use the existing function to update team notification preferences
        const { updateTeamNotificationPreferences } = await import(
          "@/lib/notifications"
        );
        await updateTeamNotificationPreferences(ctx.userId, teamId, settings);

        return {
          message: "Team notification settings updated successfully",
        };
      } catch (error) {
        console.error("Error updating team notification settings:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update team notification settings",
        });
      }
    }),

  // Get team default notification settings (for admins)
  getTeamDefaults: protectedProcedure
    .input(z.object({ teamId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        // Check if user is admin/owner of the team
        const teamMember = await ctx.prisma.teamMember.findFirst({
          where: {
            teamId: input.teamId,
            userId: ctx.userId,
            role: { in: ["admin", "owner"] },
          },
        });

        if (!teamMember) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have permission to view team default settings",
          });
        }

        const team = await ctx.prisma.team.findUnique({
          where: { id: input.teamId },
          select: {
            defaultNotificationOnInvitation: true,
            defaultNotificationOnAssignment: true,
            defaultNotificationOnTaskCompletion: true,
            defaultNotificationOnCheckin: true,
            defaultNotificationOnNewTasks: true,
          },
        });

        if (!team) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Team not found",
          });
        }

        return team;
      } catch (error) {
        console.error("Error fetching team default settings:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch team default settings",
        });
      }
    }),

  // Update team default notification settings (for admins)
  updateTeamDefaults: protectedProcedure
    .input(
      z.object({
        teamId: z.string().uuid(),
        defaultNotificationOnInvitation: z.boolean().optional(),
        defaultNotificationOnAssignment: z.boolean().optional(),
        defaultNotificationOnTaskCompletion: z.boolean().optional(),
        defaultNotificationOnCheckin: z.boolean().optional(),
        defaultNotificationOnNewTasks: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Check if user is admin/owner of the team
        const teamMember = await ctx.prisma.teamMember.findFirst({
          where: {
            teamId: input.teamId,
            userId: ctx.userId,
            role: { in: ["admin", "owner"] },
          },
        });

        if (!teamMember) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "You don't have permission to update team default settings",
          });
        }

        const { teamId, ...settings } = input;

        await ctx.prisma.team.update({
          where: { id: teamId },
          data: settings,
        });

        return {
          message: "Team default notification settings updated successfully",
        };
      } catch (error) {
        console.error("Error updating team default settings:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update team default settings",
        });
      }
    }),
});
