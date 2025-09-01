import { z } from "zod";
import { router, publicProcedure } from "@/lib/trpc/server";
import { protectedProcedure } from "../middleware";
import { slugify } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { Context } from "@/lib/trpc/server";
import { TRPCError } from "@trpc/server";
import { serverGetTeamMembers } from "./users";
import { hashPassword, verifyPassword } from "@/lib/auth";
import {
  addUserToTeamNotifications,
  addUserToTeamNotificationsWithSettings,
} from "@/lib/notifications";

type TeamInput = {
  name: string;
  password: string;
  isPrivate?: boolean;
  isCloneable?: boolean;
  notificationOnInvitation?: boolean;
  notificationOnAssignment?: boolean;
  notificationOnTaskCompletion?: boolean;
  notificationOnCheckin?: boolean;
  notificationOnNewTasks?: boolean;
};

type JoinInput = {
  teamId: string;
  password: string;
};

type TeamIdInput = {
  teamId: string;
};

export const teamsRouter = router({
  getAll: publicProcedure.query(async ({ ctx }) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const teams = await ctx.prisma.team.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          createdAt: true,
          isPrivate: true,
          members: {
            select: {
              userId: true,
              role: true,
            },
          },
          checkIns: {
            where: {
              checkInDate: today,
            },
            select: {
              user: {
                select: {
                  id: true,
                  name: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
        where: {
          isDeleted: false,
        },
      });
      return teams || [];
    } catch (error) {
      console.error("Error fetching teams:", error);
      return [];
    }
  }),

  getJoinedTeams: protectedProcedure.query(async ({ ctx }) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const teams = await ctx.prisma.team.findMany({
        where: {
          isDeleted: false,
          members: {
            some: {
              userId: ctx.userId,
            },
          },
        },
        select: {
          id: true,
          name: true,
          slug: true,
          createdAt: true,
          isPrivate: true,
          members: {
            select: {
              userId: true,
              role: true,
            },
          },
          checkIns: {
            where: {
              checkInDate: today,
            },
            select: {
              user: {
                select: {
                  id: true,
                  name: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
      });
      return teams || [];
    } catch (error) {
      console.error("Error fetching joined teams:", error);
      return [];
    }
  }),

  getBySlug: protectedProcedure
    .input(
      z.object({
        slug: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const team = await ctx.prisma.team.findFirst({
          where: {
            slug: input.slug,
            isDeleted: false,
          },
          select: {
            id: true,
            name: true,
            slug: true,
            isPrivate: true,
            isCloneable: true,
            isDeleted: true,
            createdAt: true,
          },
        });

        if (!team) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Team not found",
          });
        }

        const teamMembers = await serverGetTeamMembers({
          ctx,
          teamId: team.id,
          userId: ctx.userId,
          checkIfMember: true,
        });

        return {
          team,
          teamMembers,
        };
      } catch (error) {
        console.error("Error fetching team:", error);
        throw error;
      }
    }),

  getBySlugPublic: protectedProcedure
    .input(
      z.object({
        slug: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const team = await ctx.prisma.team.findFirst({
          where: {
            slug: input.slug,
            isDeleted: false,
          },
        });
        if (!team) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Team not found",
          });
        }

        // Check if the user is already a member
        const existingMembership = await ctx.prisma.teamMember.findFirst({
          where: {
            teamId: team.id,
            userId: ctx.userId,
          },
        });

        return {
          team,
          isMember: !!existingMembership,
        };
      } catch (error) {
        console.error("Error fetching team for join page:", error);
        throw error;
      }
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        password: z.string().min(4),
        isPrivate: z.boolean().optional(),
        isCloneable: z.boolean().optional(),
        notificationOnInvitation: z.boolean().optional(),
        notificationOnAssignment: z.boolean().optional(),
        notificationOnTaskCompletion: z.boolean().optional(),
        notificationOnCheckin: z.boolean().optional(),
        notificationOnNewTasks: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }: { ctx: Context; input: TeamInput }) => {
      try {
        if (!ctx.userId) throw new Error("User ID is required");
        const userId = ctx.userId; // Create a non-nullable reference

        // Generate slug from name
        let slug = slugify(input.name);

        // Check if slug already exists
        const existingTeam = await ctx.prisma.team.findUnique({
          where: { slug },
        });

        // If slug exists, append a random number
        if (existingTeam) {
          slug = `${slug}-${Math.floor(Math.random() * 1000)}`;
        }

        // Hash the password
        const hashedPassword = await hashPassword(input.password);

        // Create team and add creator as admin in a transaction
        const team = await ctx.prisma.$transaction(async (prisma) => {
          const newTeam = await prisma.team.create({
            data: {
              name: input.name,
              slug,
              password: hashedPassword,
              isPrivate: input.isPrivate || false,
              isCloneable: input.isCloneable || false,
            },
          });

          await prisma.teamMember.create({
            data: {
              teamId: newTeam.id,
              userId,
              role: "admin",
            },
          });

          return newTeam;
        });

        // Add creator to team notification settings with custom preferences
        try {
          await addUserToTeamNotificationsWithSettings(userId, team.id, {
            notificationOnInvitation: input.notificationOnInvitation ?? true,
            notificationOnAssignment: input.notificationOnAssignment ?? true,
            notificationOnTaskCompletion:
              input.notificationOnTaskCompletion ?? true,
            notificationOnCheckin: input.notificationOnCheckin ?? true,
            notificationOnNewTasks: input.notificationOnNewTasks ?? true,
          });
        } catch (error) {
          console.error("Failed to add creator to team notifications:", error);
          // Don't fail team creation if notification setup fails
        }

        return team;
      } catch (error) {
        console.error("Error creating team:", error);
        throw error;
      }
    }),

  join: protectedProcedure
    .input(
      z.object({
        teamId: z.string().uuid(),
        password: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        if (!ctx.userId) throw new Error("User ID is required");

        // Check if user is banned from the team
        const ban = await ctx.prisma.teamBan.findUnique({
          where: {
            teamId_userId: {
              teamId: input.teamId,
              userId: ctx.userId,
            },
          },
        });

        if (ban) {
          throw new Error("You have been banned from this team");
        }

        // Check if user is already a member
        const existingMembership = await ctx.prisma.teamMember.findUnique({
          where: {
            teamId_userId: {
              teamId: input.teamId,
              userId: ctx.userId,
            },
          },
        });

        // If already a member, return success
        if (existingMembership) {
          return { success: true };
        }

        // If not a member, verify password
        const team = await ctx.prisma.team.findUnique({
          where: { id: input.teamId },
          select: { password: true },
        });

        if (!team) {
          throw new Error("Team not found");
        }

        // Check if the password matches
        const isPasswordValid = await verifyPassword(
          team.password,
          input.password
        );
        if (!isPasswordValid) {
          throw new Error("Incorrect password");
        }

        // Add them as a member
        await ctx.prisma.teamMember.create({
          data: {
            teamId: input.teamId,
            userId: ctx.userId,
            role: "member",
          },
        });

        // Add user to team notification settings based on their preferences
        try {
          await addUserToTeamNotifications(ctx.userId, input.teamId);
        } catch (error) {
          console.error("Failed to add user to team notifications:", error);
          // Don't fail team join if notification setup fails
        }

        return { success: true };
      } catch (error) {
        console.error("Error joining team:", error);
        throw error;
      }
    }),

  verifyAccess: protectedProcedure
    .input(
      z.object({
        teamId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }: { ctx: Context; input: TeamIdInput }) => {
      try {
        if (!ctx.userId) throw new Error("User ID is required");
        const userId = ctx.userId; // Create a non-nullable reference

        // Check if user is banned from the team
        const ban = await ctx.prisma.teamBan.findUnique({
          where: {
            teamId_userId: {
              teamId: input.teamId,
              userId,
            },
          },
        });

        if (ban) {
          return { hasAccess: false, reason: "banned" };
        }

        const membership = await ctx.prisma.teamMember.findUnique({
          where: {
            teamId_userId: {
              teamId: input.teamId,
              userId,
            },
          },
        });
        return { hasAccess: !!membership };
      } catch (error) {
        console.error("Error verifying team access:", error);
        return { hasAccess: false };
      }
    }),

  delete: protectedProcedure
    .input(
      z.object({
        teamId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }: { ctx: Context; input: TeamIdInput }) => {
      try {
        if (!ctx.userId) throw new Error("User ID is required");
        const userId = ctx.userId;

        // First verify the current user is an admin
        const currentUserRole = await ctx.prisma.teamMember.findUnique({
          where: {
            teamId_userId: {
              teamId: input.teamId,
              userId,
            },
          },
          select: { role: true },
        });

        if (
          !currentUserRole ||
          !["admin", "owner"].includes(currentUserRole.role ?? "")
        ) {
          throw new Error("You don't have permission to delete this team");
        }

        // Soft delete the team and its tasks in a transaction
        await ctx.prisma.$transaction([
          ctx.prisma.team.update({
            where: { id: input.teamId },
            data: { isDeleted: true },
          }),
          ctx.prisma.task.updateMany({
            where: { teamId: input.teamId },
            data: { isDeleted: true },
          }),
        ]);

        return { success: true };
      } catch (error) {
        console.error("Error deleting team:", error);
        throw error;
      }
    }),

  updateMemberRole: protectedProcedure
    .input(
      z.object({
        teamId: z.string().uuid(),
        userId: z.string().uuid(),
        role: z.enum(["admin", "member"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the current user is an admin
      const currentMember = await ctx.prisma.teamMember.findUnique({
        where: {
          teamId_userId: {
            teamId: input.teamId,
            userId: ctx.userId,
          },
        },
      });

      if (!currentMember || currentMember.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can update member roles",
        });
      }

      // Update the member's role
      return ctx.prisma.teamMember.update({
        where: {
          teamId_userId: {
            teamId: input.teamId,
            userId: input.userId,
          },
        },
        data: {
          role: input.role,
        },
      });
    }),

  getMember: protectedProcedure
    .input(
      z.object({
        teamId: z.string().uuid(),
        userId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      const member = await ctx.prisma.teamMember.findUnique({
        where: {
          teamId_userId: {
            teamId: input.teamId,
            userId: input.userId,
          },
        },
      });
      return member;
    }),

  update: protectedProcedure
    .input(
      z.object({
        teamId: z.string().uuid(),
        name: z.string().min(1).optional(),
        isPrivate: z.boolean().optional(),
        isCloneable: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        if (!ctx.userId) throw new Error("User ID is required");

        // Check if user is admin
        const isAdmin = await ctx.prisma.teamMember.findFirst({
          where: {
            teamId: input.teamId,
            userId: ctx.userId,
            role: "admin",
          },
        });

        if (!isAdmin) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only team admins can update team settings",
          });
        }

        // Generate new slug if name changes
        let updateData: any = {};

        if (input.name) {
          let slug = slugify(input.name);

          // Check if slug already exists (excluding current team)
          const existingTeam = await ctx.prisma.team.findFirst({
            where: {
              slug,
              id: { not: input.teamId },
            },
          });

          // If slug exists, append a random number
          if (existingTeam) {
            slug = `${slug}-${Math.floor(Math.random() * 1000)}`;
          }

          updateData.name = input.name;
          updateData.slug = slug;
        }

        if (input.isPrivate !== undefined) {
          updateData.isPrivate = input.isPrivate;
        }

        if (input.isCloneable !== undefined) {
          updateData.isCloneable = input.isCloneable;
        }

        // Update team
        const updatedTeam = await ctx.prisma.team.update({
          where: { id: input.teamId },
          data: updateData,
        });

        return updatedTeam;
      } catch (error) {
        console.error("Error updating team:", error);
        throw error;
      }
    }),

  updatePassword: protectedProcedure
    .input(
      z.object({
        teamId: z.string().uuid(),
        currentPassword: z.string().min(1).optional(),
        newPassword: z.string().min(4),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        if (!ctx.userId) throw new Error("User ID is required");

        // Check if user is admin
        const isAdmin = await ctx.prisma.teamMember.findFirst({
          where: {
            teamId: input.teamId,
            userId: ctx.userId,
            role: "admin",
          },
        });

        if (!isAdmin) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only team admins can update team password",
          });
        }

        // Get current team
        const team = await ctx.prisma.team.findUnique({
          where: { id: input.teamId },
          select: { password: true },
        });

        if (!team) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Team not found",
          });
        }

        // Verify current password if provided
        if (input.currentPassword) {
          const isPasswordValid = await verifyPassword(
            team.password,
            input.currentPassword
          );

          if (!isPasswordValid) {
            throw new TRPCError({
              code: "UNAUTHORIZED",
              message: "Current password is incorrect",
            });
          }
        }

        // Hash the new password
        const hashedNewPassword = await hashPassword(input.newPassword);

        // Update team with new password
        await ctx.prisma.team.update({
          where: { id: input.teamId },
          data: { password: hashedNewPassword },
        });

        return { success: true };
      } catch (error) {
        console.error("Error updating team password:", error);
        throw error;
      }
    }),

  cloneTeam: protectedProcedure
    .input(
      z.object({
        teamId: z.string().uuid(),
        newTeamName: z.string().min(1),
        newTeamPassword: z.string().min(4),
        isPrivate: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        if (!ctx.userId) throw new Error("User ID is required");
        const userId = ctx.userId;

        // Verify the user is a member of the team being cloned
        const membership = await ctx.prisma.teamMember.findUnique({
          where: {
            teamId_userId: {
              teamId: input.teamId,
              userId: userId,
            },
          },
        });

        if (!membership) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You must be a member of the team to clone it",
          });
        }

        // Check if the team is cloneable
        const sourceTeam = await ctx.prisma.team.findUnique({
          where: { id: input.teamId },
        });

        if (!sourceTeam || !sourceTeam.isCloneable) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "This team does not allow cloning",
          });
        }

        // Generate slug from new name
        let slug = slugify(input.newTeamName);

        // Check if slug already exists
        const existingTeam = await ctx.prisma.team.findUnique({
          where: { slug },
        });

        // If slug exists, throw an error
        if (existingTeam) {
          const existingNameError = `A team with the name "${input.newTeamName}" already exists. Please choose a different name.`;
          throw new TRPCError({
            code: "CONFLICT",
            message: existingNameError,
          });
        }

        // Hash the password
        const hashedPassword = await hashPassword(input.newTeamPassword);

        // Use a transaction for all database operations to ensure atomicity
        return await ctx.prisma.$transaction(
          async (tx) => {
            // Step 1: Create the new team
            const team = await tx.team.create({
              data: {
                name: input.newTeamName,
                slug,
                password: hashedPassword,
                isPrivate: input.isPrivate ?? false,
                isCloneable: false, // Default to not cloneable for cloned teams
              },
            });

            // Step 2: Add current user as admin
            await tx.teamMember.create({
              data: {
                teamId: team.id,
                userId,
                role: "admin",
              },
            });

            // Copy tasks with assignments
            // Step 3: Get all tasks from the source team with their assignments
            const allTasks = await tx.task.findMany({
              where: {
                teamId: input.teamId,
                isDeleted: false,
              },
              include: {
                assignments: true,
              },
              orderBy: [{ parentId: "asc" }, { position: "asc" }],
            });

            // Map to track original task ID to new task ID
            const taskIdMap = new Map();

            // Step 4: First process top-level tasks (parentId is null)
            const topLevelTasks = allTasks.filter(
              (task) => task.parentId === null
            );

            for (const task of topLevelTasks) {
              const newTask = await tx.task.create({
                data: {
                  title: task.title,
                  position: task.position,
                  teamId: team.id,
                  type: task.type, // Include task type (daily/checklist)
                  visibility: task.visibility, // Include visibility setting
                },
              });
              taskIdMap.set(task.id, newTask.id);

              // Copy assignments for this task
              if (task.assignments && task.assignments.length > 0) {
                for (const assignment of task.assignments) {
                  await tx.taskAssignment.create({
                    data: {
                      taskId: newTask.id,
                      userId: assignment.userId,
                    },
                  });
                }
              }
            }

            // Step 5: Process child tasks level by level to maintain parent-child relationships
            // Group tasks by parentId for faster lookup
            const tasksByParentId = allTasks
              .filter((task) => task.parentId !== null)
              .reduce((acc, task) => {
                if (!acc.has(task.parentId!)) {
                  acc.set(task.parentId!, []);
                }
                acc.get(task.parentId!).push(task);
                return acc;
              }, new Map());

            // Process levels in order
            const processedParentIds = Array.from(taskIdMap.keys());

            while (processedParentIds.length > 0) {
              const parentId = processedParentIds.shift();
              if (!parentId) continue;

              const childTasks = tasksByParentId.get(parentId) || [];

              // Create child tasks for this parent
              for (const childTask of childTasks) {
                const newTask = await tx.task.create({
                  data: {
                    title: childTask.title,
                    position: childTask.position,
                    teamId: team.id,
                    parentId: taskIdMap.get(childTask.parentId!),
                    type: childTask.type, // Include task type (daily/checklist)
                    visibility: childTask.visibility, // Include visibility setting
                  },
                });

                taskIdMap.set(childTask.id, newTask.id);
                processedParentIds.push(childTask.id);

                // Copy assignments for this child task
                if (childTask.assignments && childTask.assignments.length > 0) {
                  for (const assignment of childTask.assignments) {
                    await tx.taskAssignment.create({
                      data: {
                        taskId: newTask.id,
                        userId: assignment.userId,
                      },
                    });
                  }
                }
              }
            }

            return team;
          },
          {
            // Set a longer timeout for large teams with many tasks
            timeout: 30000, // 30 seconds
          }
        );
      } catch (error) {
        console.error("Error cloning team:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "An error occurred while cloning the team",
        });
      }
    }),

  // Invite user by email
  inviteByEmail: protectedProcedure
    .input(
      z.object({
        teamId: z.string().uuid(),
        email: z.string().email(),
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
          include: {
            team: true,
            user: true,
          },
        });

        if (!teamMember) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have permission to invite users to this team",
          });
        }

        // Check if user is already a member
        const existingMember = await ctx.prisma.teamMember.findFirst({
          where: {
            teamId: input.teamId,
            user: { email: input.email },
          },
        });

        if (existingMember) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "User is already a member of this team",
          });
        }

        // Check if there's already a pending invitation
        const existingInvitation = await ctx.prisma.teamInvitation.findFirst({
          where: {
            teamId: input.teamId,
            email: input.email,
            acceptedAt: null,
            expiresAt: { gt: new Date() },
          },
        });

        if (existingInvitation) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "There's already a pending invitation for this email",
          });
        }

        // Generate invitation token
        const crypto = await import("crypto");
        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        // Create invitation
        const invitation = await ctx.prisma.teamInvitation.create({
          data: {
            email: input.email,
            teamId: input.teamId,
            invitedBy: ctx.userId,
            token,
            expiresAt,
          },
        });

        // Send invitation email
        const { EmailService } = await import("@/lib/email");
        const { env } = await import("@/lib/env");

        const inviteUrl = `${env.NEXT_PUBLIC_APP_URL}/invite/${token}`;

        await EmailService.sendTeamInviteEmail(input.email, {
          invitedUserName: input.email.split("@")[0], // Use email prefix as name
          teamName: teamMember.team.name,
          invitedByName: teamMember.user.name,
          inviteUrl,
        });

        return {
          message: "Invitation sent successfully",
          invitation: {
            id: invitation.id,
            email: invitation.email,
            expiresAt: invitation.expiresAt,
          },
        };
      } catch (error) {
        console.error("Error sending team invitation:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to send invitation",
        });
      }
    }),

  // Accept invitation
  acceptInvitation: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Find the invitation
        const invitation = await ctx.prisma.teamInvitation.findUnique({
          where: { token: input.token },
          include: { team: true },
        });

        if (
          !invitation ||
          invitation.acceptedAt ||
          invitation.expiresAt < new Date()
        ) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Invalid or expired invitation",
          });
        }

        // Check if user's email matches invitation
        const user = await ctx.prisma.user.findUnique({
          where: { id: ctx.userId },
        });

        if (!user || user.email !== invitation.email) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "This invitation was not sent to your email address",
          });
        }

        // Check if user is already a member
        const existingMember = await ctx.prisma.teamMember.findFirst({
          where: {
            teamId: invitation.teamId,
            userId: ctx.userId,
          },
        });

        if (existingMember) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "You are already a member of this team",
          });
        }

        // Accept invitation and add user to team
        await ctx.prisma.$transaction(async (tx) => {
          // Mark invitation as accepted
          await tx.teamInvitation.update({
            where: { id: invitation.id },
            data: { acceptedAt: new Date() },
          });

          // Add user to team
          await tx.teamMember.create({
            data: {
              teamId: invitation.teamId,
              userId: ctx.userId,
              role: "member",
            },
          });

          // Apply team default notification settings to the new member
          const team = await tx.team.findUnique({
            where: { id: invitation.teamId },
            select: {
              defaultNotificationOnInvitation: true,
              defaultNotificationOnAssignment: true,
              defaultNotificationOnTaskCompletion: true,
              defaultNotificationOnCheckin: true,
              defaultNotificationOnNewTasks: true,
            },
          });

          if (team) {
            const { addUserToTeamNotificationsWithSettings } = await import(
              "@/lib/notifications"
            );
            await addUserToTeamNotificationsWithSettings(
              ctx.userId,
              invitation.teamId,
              {
                notificationOnInvitation: team.defaultNotificationOnInvitation,
                notificationOnAssignment: team.defaultNotificationOnAssignment,
                notificationOnTaskCompletion:
                  team.defaultNotificationOnTaskCompletion,
                notificationOnCheckin: team.defaultNotificationOnCheckin,
                notificationOnNewTasks: team.defaultNotificationOnNewTasks,
              }
            );
          }
        });

        return {
          message: "Successfully joined the team",
          team: {
            id: invitation.team.id,
            name: invitation.team.name,
            slug: invitation.team.slug,
          },
        };
      } catch (error) {
        console.error("Error accepting invitation:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to accept invitation",
        });
      }
    }),

  // Get team invitations (for admins)
  getInvitations: protectedProcedure
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
            message: "You don't have permission to view team invitations",
          });
        }

        const invitations = await ctx.prisma.teamInvitation.findMany({
          where: { teamId: input.teamId },
          include: {
            inviter: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { createdAt: "desc" },
        });

        return invitations;
      } catch (error) {
        console.error("Error fetching team invitations:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch invitations",
        });
      }
    }),
});

export type TeamsRouter = typeof teamsRouter;
export type TeamsInput = inferRouterInputs<TeamsRouter>;
export type TeamsOutput = inferRouterOutputs<TeamsRouter>;
