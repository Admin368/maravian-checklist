import { z } from "zod";
import { router, publicProcedure, Context } from "@/lib/trpc/server";
import { protectedProcedure } from "../middleware";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@prisma/client";
import { hashPassword } from "@/lib/auth";

export const serverGetTeamMembers = async ({
  ctx,
  teamId,
  userId,
  checkIfMember = true,
}: {
  ctx: Context;
  teamId: string;
  userId: string;
  checkIfMember?: boolean;
}) => {
  // Get the team with notification settings
  const team = await ctx.prisma.team.findUnique({
    where: { id: teamId },
    select: {
      id: true,
      notificationOnInvitationUserIds: {
        select: { id: true },
      },
      notificationOnAssignmentUserIds: {
        select: { id: true },
      },
      notificationOnTaskCompletionUserIds: {
        select: { id: true },
      },
      notificationOnCheckinUserIds: {
        select: { id: true },
      },
      notificationOnNewTasksUserIds: {
        select: { id: true },
      },
    },
  });

  if (!team) {
    throw new Error("Team not found");
  }

  // Get all team members with user details and ban status
  const members = await ctx.prisma.teamMember.findMany({
    where: {
      teamId: teamId,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          // Include global notification preferences
          notificationOnInvitation: true,
          notificationOnAssignment: true,
          notificationOnTaskCompletion: true,
          notificationOnCheckin: true,
          notificationOnNewTasks: true,
        },
      },
    },
  });

  // Get ban status for all members
  const bans = await ctx.prisma.teamBan.findMany({
    where: {
      teamId: teamId,
    },
    select: {
      userId: true,
    },
  });

  const bannedUserIds = new Set(
    bans.map((ban: { userId: string }) => ban.userId)
  );

  if (checkIfMember) {
    const isMember = members.some(
      (member: { user: { id: string } }) => member.user.id === userId
    );
    if (!isMember) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You are not a member of this team",
      });
    }
  }

  // Create helper functions to check notification preferences
  const teamNotificationUserIds = {
    invitation: new Set(team.notificationOnInvitationUserIds.map((u) => u.id)),
    assignment: new Set(team.notificationOnAssignmentUserIds.map((u) => u.id)),
    taskCompletion: new Set(
      team.notificationOnTaskCompletionUserIds.map((u) => u.id)
    ),
    checkin: new Set(team.notificationOnCheckinUserIds.map((u) => u.id)),
    newTasks: new Set(team.notificationOnNewTasksUserIds.map((u) => u.id)),
  };

  // Transform the data to include role information, ban status, and notification settings
  return members.map(
    (member: {
      user: {
        id: string;
        name: string;
        email: string;
        avatarUrl: string | null;
        notificationOnInvitation: boolean;
        notificationOnAssignment: boolean;
        notificationOnTaskCompletion: boolean;
        notificationOnCheckin: boolean;
        notificationOnNewTasks: boolean;
      };
      role: string | null;
    }) => {
      const userId = member.user.id;

      // Calculate effective notification settings (team-specific overrides global)
      const notificationSettings = {
        invitation:
          teamNotificationUserIds.invitation.has(userId) ||
          (!teamNotificationUserIds.invitation.has(userId) &&
            member.user.notificationOnInvitation),
        assignment:
          teamNotificationUserIds.assignment.has(userId) ||
          (!teamNotificationUserIds.assignment.has(userId) &&
            member.user.notificationOnAssignment),
        taskCompletion:
          teamNotificationUserIds.taskCompletion.has(userId) ||
          (!teamNotificationUserIds.taskCompletion.has(userId) &&
            member.user.notificationOnTaskCompletion),
        checkin:
          teamNotificationUserIds.checkin.has(userId) ||
          (!teamNotificationUserIds.checkin.has(userId) &&
            member.user.notificationOnCheckin),
        newTasks:
          teamNotificationUserIds.newTasks.has(userId) ||
          (!teamNotificationUserIds.newTasks.has(userId) &&
            member.user.notificationOnNewTasks),
      };

      return {
        id: member.user.id,
        name: member.user.name,
        email: member.user.email,
        avatarUrl: member.user.avatarUrl,
        role: member.role,
        isBanned: bannedUserIds.has(member.user.id),
        notificationSettings: {
          notificationOnInvitation: notificationSettings.invitation,
          notificationOnAssignment: notificationSettings.assignment,
          notificationOnTaskCompletion: notificationSettings.taskCompletion,
          notificationOnCheckin: notificationSettings.checkin,
          notificationOnNewTasks: notificationSettings.newTasks,
          // Also include which are team-specific vs global
          hasTeamSpecificSettings: {
            invitation: teamNotificationUserIds.invitation.has(userId),
            assignment: teamNotificationUserIds.assignment.has(userId),
            taskCompletion: teamNotificationUserIds.taskCompletion.has(userId),
            checkin: teamNotificationUserIds.checkin.has(userId),
            newTasks: teamNotificationUserIds.newTasks.has(userId),
          },
        },
      };
    }
  );
};

export type serverGetTeamMembersReturnType = Awaited<
  ReturnType<typeof serverGetTeamMembers>
>[number];

export const usersRouter = router({
  getAll: publicProcedure.query(async ({ ctx }) => {
    try {
      const users = await ctx.prisma.user.findMany({
        orderBy: { name: "asc" },
      });
      return users;
    } catch (error) {
      console.error("Error fetching users:", error);
      return [];
    }
  }),

  getTeamMembers: protectedProcedure
    .input(
      z.object({
        teamId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        // First verify the user has access to this team
        const membership = await ctx.prisma.teamMember.findUnique({
          where: {
            teamId_userId: {
              teamId: input.teamId,
              userId: ctx.userId,
            },
          },
        });

        if (!membership) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to this team",
          });
        }
        return await serverGetTeamMembers({
          ctx,
          teamId: input.teamId,
          userId: ctx.userId,
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error fetching team members:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch team members",
        });
      }
    }),

  getOrCreate: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email().optional(),
        avatarUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // First try to find by email if provided
        if (input.email) {
          const existingUser = await ctx.prisma.user.findFirst({
            where: { email: input.email },
          });

          if (existingUser) return existingUser;
        }

        // Generate a temporary email if none provided
        const tempEmail =
          input.email ||
          `temp-${input.name
            .toLowerCase()
            .replace(/\s+/g, "-")}-${Date.now()}@temporary.com`;

        // Generate a temporary password
        const tempPassword = `temp-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}`;
        const hashedPassword = await hashPassword(tempPassword);

        // Create a new user
        const user = await ctx.prisma.user.create({
          data: {
            name: input.name,
            email: tempEmail,
            password: hashedPassword,
            avatarUrl: input.avatarUrl,
          },
        });

        return user;
      } catch (error) {
        console.error("Error in getOrCreate:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get or create user",
        });
      }
    }),

  updateRole: publicProcedure
    .input(
      z.object({
        teamId: z.string().uuid(),
        userId: z.string().uuid(),
        role: z.enum(["member", "admin"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // First verify the current user is an admin
        const currentUserRole = await ctx.prisma.teamMember.findUnique({
          where: {
            teamId_userId: {
              teamId: input.teamId,
              userId: ctx.userId ?? "",
            },
          },
          select: { role: true },
        });

        if (
          !currentUserRole ||
          !currentUserRole.role ||
          !["admin", "owner"].includes(currentUserRole.role)
        ) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have permission to update roles",
          });
        }

        // Update the target user's role
        await ctx.prisma.teamMember.update({
          where: {
            teamId_userId: {
              teamId: input.teamId,
              userId: input.userId,
            },
          },
          data: { role: input.role },
        });

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error updating user role:", error);
        throw error;
      }
    }),

  banUser: protectedProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        teamId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // First verify the current user is an admin
        const currentUserRole = await ctx.prisma.teamMember.findUnique({
          where: {
            teamId_userId: {
              teamId: input.teamId,
              userId: ctx.userId ?? "",
            },
          },
          select: { role: true },
        });

        if (
          !currentUserRole ||
          !currentUserRole.role ||
          !["admin", "owner"].includes(currentUserRole.role)
        ) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have permission to ban users",
          });
        }

        // Check if user is already banned
        const existingBan = await ctx.prisma.teamBan.findUnique({
          where: {
            teamId_userId: {
              teamId: input.teamId,
              userId: input.userId,
            },
          },
        });

        if (existingBan) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "User is already banned from this team",
          });
        }

        // Create a new team ban
        await ctx.prisma.teamBan.create({
          data: {
            teamId: input.teamId,
            userId: input.userId,
          },
        });

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error banning user:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to ban user",
        });
      }
    }),

  unbanUser: protectedProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        teamId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // First verify the current user is an admin
        const currentUserRole = await ctx.prisma.teamMember.findUnique({
          where: {
            teamId_userId: {
              teamId: input.teamId,
              userId: ctx.userId ?? "",
            },
          },
          select: { role: true },
        });

        if (
          !currentUserRole ||
          !currentUserRole.role ||
          !["admin", "owner"].includes(currentUserRole.role)
        ) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have permission to unban users",
          });
        }

        // Remove the team ban
        await ctx.prisma.teamBan.delete({
          where: {
            teamId_userId: {
              teamId: input.teamId,
              userId: input.userId,
            },
          },
        });

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error unbanning user:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to unban user",
        });
      }
    }),

  me: protectedProcedure.query(async ({ ctx }) => {
    try {
      const user = await ctx.prisma.user.findUnique({
        where: { id: ctx.userId },
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          notificationOnInvitation: true,
          notificationOnAssignment: true,
          notificationOnTaskCompletion: true,
          notificationOnCheckin: true,
          notificationOnNewTasks: true,
          // isBanned: true,
        },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      return user;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      console.error("Error fetching current user:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch current user",
      });
    }
  }),
});
function getMembers(arg0: {
  ctx: { prisma: any; headers: Headers; userId: string };
  teamId: string;
}): any {
  throw new Error("Function not implemented.");
}
