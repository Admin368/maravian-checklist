import { z } from "zod";
import { router } from "@/lib/trpc/server";
import { protectedProcedure } from "../middleware";
import { TRPCError } from "@trpc/server";
import { serverGetTeamMembers } from "./users";
import { toISODateTime } from "./check-ins";
import { serverGetCheckInStatus } from "./check-ins";
import { prisma } from "@/lib/prisma";

export const serverGetTasks = async (args: {
  teamId: string;
  date: string;
  type?: string;
  userId?: string;
}) => {
  const whereClause: any = {
    teamId: args.teamId,
    isDeleted: false,
  };

  // Add type filter if specified
  if (args.type) {
    whereClause.type = args.type;
  } else {
    // Default to daily tasks
    whereClause.type = "daily";
  }

  // For private checklists, filter by userId
  if (args.type === "checklist" && args.userId) {
    whereClause.OR = [
      { visibility: "team" },
      { visibility: "public" },
      {
        visibility: "private",
        assignments: {
          some: {
            userId: args.userId,
          },
        },
      },
    ];
  }

  return await prisma.task.findMany({
    where: whereClause,
    include: {
      assignments: {
        select: {
          userId: true,
        },
      },
    },
    orderBy: {
      position: "asc",
    },
  });
};

export type serverGetTasksReturnType = Awaited<
  ReturnType<typeof serverGetTasks>
>[number];

export const serverGetCompletions = async (args: {
  teamId: string;
  date: string;
  userId: string;
}) => {
  return await prisma.taskCompletion.findMany({
    where: {
      completionDate: toISODateTime(args.date),
      task: {
        team: {
          members: {
            some: {
              userId: args.userId,
            },
          },
        },
        isDeleted: false,
      },
    },
    include: {
      task: {
        include: {
          team: {
            include: {
              members: {
                include: {
                  user: true,
                },
              },
            },
          },
        },
      },
      user: true,
    },
  });
};

export type serverGetCompletionsReturnType = Awaited<
  ReturnType<typeof serverGetCompletions>
>[number];

export const tasksRouter = router({
  getByTeam: protectedProcedure
    .input(
      z.object({
        teamId: z.string().uuid(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        // First verify the user has access to this team
        const membership = await ctx.prisma.teamMember.findUnique({
          where: {
            teamId_userId: {
              teamId: input.teamId,
              userId: ctx.userId!,
            },
          },
        });

        if (!membership) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to this team",
          });
        }

        // Get tasks with assignments
        const tasks = await serverGetTasks({
          teamId: input.teamId,
          date: input.date,
        });
        const teamMembers = await serverGetTeamMembers({
          ctx,
          teamId: input.teamId,
          userId: ctx.userId!,
        });

        const completions = await serverGetCompletions({
          teamId: input.teamId,
          date: input.date,
          userId: ctx.userId!,
        });

        const checkInStatus = await serverGetCheckInStatus({
          ctx,
          teamId: input.teamId,
          date: input.date,
        });

        return {
          teamMembers,
          tasks,
          completions,
          checkInStatus,
        };
      } catch (error) {
        console.error("Error fetching tasks:", error);
        if (error instanceof TRPCError) throw error;
        return null;
      }
    }),

  getAll: protectedProcedure.query(async ({ ctx }) => {
    try {
      // Get user's teams
      const memberships = await ctx.prisma.teamMember.findMany({
        where: { userId: ctx.userId },
        select: { teamId: true },
      });

      if (memberships.length === 0) {
        return [];
      }

      const teamIds = memberships.map((m: { teamId: string }) => m.teamId);

      const tasks = await ctx.prisma.task.findMany({
        where: {
          teamId: {
            in: teamIds,
          },
          isDeleted: false,
        },
        orderBy: {
          position: "asc",
        },
      });

      return tasks;
    } catch (error) {
      console.error("Error fetching tasks:", error);
      return [];
    }
  }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1),
        parentId: z.string().uuid().nullable(),
        teamId: z.string().uuid(),
        position: z.number().optional(),
        type: z.enum(["daily", "checklist"]).default("daily"),
        visibility: z.enum(["team", "private", "public"]).default("team"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify user has access to the team
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

        // If position is not provided, get the max position for the parent and add 1
        let position = input.position;
        if (position === undefined) {
          const lastTask = await ctx.prisma.task.findFirst({
            where: {
              parentId: input.parentId,
              teamId: input.teamId,
              isDeleted: false,
            },
            orderBy: {
              position: "desc",
            },
          });

          position = lastTask ? lastTask.position + 1 : 0;
        }

        const task = await ctx.prisma.task.create({
          data: {
            title: input.title,
            parentId: input.parentId,
            teamId: input.teamId,
            position,
            type: input.type,
            visibility: input.visibility,
          },
        });

        return task;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error creating task:", error);
        throw error;
      }
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid().optional(),
        title: z.string().min(1).optional(),
        parentId: z.string().uuid().nullable().optional(),
        teamId: z.string().uuid().optional(),
        position: z.number().optional(),
        updates: z
          .array(
            z.object({
              id: z.string().uuid(),
              position: z.number(),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // If this is a batch update
        if (input.updates) {
          // Get the first task to check team access
          const firstTask = await ctx.prisma.task.findUnique({
            where: { id: input.updates[0].id },
            select: { teamId: true },
          });

          if (!firstTask || !firstTask.teamId) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Task not found",
            });
          }

          // Verify user has access to the team
          const membership = await ctx.prisma.teamMember.findUnique({
            where: {
              teamId_userId: {
                teamId: firstTask.teamId,
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

          // Update positions in a transaction
          await ctx.prisma.$transaction(
            input.updates.map((update) =>
              ctx.prisma.task.update({
                where: { id: update.id },
                data: { position: update.position },
              })
            )
          );

          return { success: true };
        }

        // Regular single task update
        if (!input.id) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Task ID is required for single task update",
          });
        }

        // Get current task to check team
        const task = await ctx.prisma.task.findUnique({
          where: { id: input.id },
          select: { teamId: true },
        });

        if (!task || !task.teamId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Task not found",
          });
        }

        // Verify user has access to the team
        const membership = await ctx.prisma.teamMember.findUnique({
          where: {
            teamId_userId: {
              teamId: task.teamId,
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

        const updatedTask = await ctx.prisma.task.update({
          where: { id: input.id },
          data: {
            ...(input.title && { title: input.title }),
            ...(input.parentId !== undefined && { parentId: input.parentId }),
            ...(input.teamId && { teamId: input.teamId }),
            ...(input.position !== undefined && { position: input.position }),
          },
        });

        return updatedTask;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error updating task:", error);
        throw error;
      }
    }),

  delete: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Get current task to check team
        const task = await ctx.prisma.task.findUnique({
          where: { id: input.id },
          select: { teamId: true },
        });

        if (!task || !task.teamId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Task not found",
          });
        }

        // Verify user has access to the team and is an admin
        const membership = await ctx.prisma.teamMember.findUnique({
          where: {
            teamId_userId: {
              teamId: task.teamId,
              userId: ctx.userId,
            },
          },
          select: {
            role: true,
          },
        });

        if (
          !membership ||
          !membership.role ||
          !["admin", "owner"].includes(membership.role)
        ) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have permission to delete tasks",
          });
        }

        const softDeleteTaskAndChildren = async (taskId: string) => {
          // Get all descendant tasks
          const children = await ctx.prisma.task.findMany({
            where: { parentId: taskId },
          });

          // Soft delete the current task
          await ctx.prisma.task.update({
            where: { id: taskId },
            data: { isDeleted: true },
          });

          // Recursively soft delete all children
          for (const child of children) {
            await softDeleteTaskAndChildren(child.id);
          }
        };

        await softDeleteTaskAndChildren(input.id);

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Error deleting task:", error);
        throw error;
      }
    }),

  assign: protectedProcedure
    .input(
      z.object({
        taskId: z.string().uuid(),
        userId: z.string().uuid(),
        isRemove: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { taskId, userId, isRemove } = input;

      // Verify user has access to the task
      const task = await ctx.prisma.task.findUnique({
        where: { id: taskId },
        include: { team: true },
      });

      if (!task) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Task not found",
        });
      }
      const teamId = task.teamId;
      if (!teamId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Team not found",
        });
      }

      // Verify user is a member of the team
      const teamMember = await ctx.prisma.teamMember.findUnique({
        where: {
          teamId_userId: {
            teamId,
            userId: ctx.userId,
          },
        },
      });

      if (!teamMember) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this task",
        });
      }

      // Verify user is admin
      if (teamMember.role !== "admin" && teamMember.role !== "owner") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can assign tasks",
        });
      }

      // Create or update assignment
      if (isRemove) {
        await ctx.prisma.taskAssignment.delete({
          where: {
            taskId_userId: {
              taskId,
              userId,
            },
          },
        });
      } else {
        await ctx.prisma.taskAssignment.upsert({
          where: {
            taskId_userId: {
              taskId,
              userId,
            },
          },
          create: {
            taskId,
            userId,
          },
          update: {},
        });
      }

      return { success: true };
    }),

  updateAssignments: protectedProcedure
    .input(
      z.object({
        taskId: z.string().uuid(),
        userIds: z.array(z.string().uuid()),
        action: z.enum(["add", "remove", "set"]).default("add"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { taskId, userIds, action } = input;

      // Verify user has access to the task
      const task = await ctx.prisma.task.findUnique({
        where: { id: taskId },
        include: {
          team: true,
          assignments: true,
        },
      });

      if (!task) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Task not found",
        });
      }

      const teamId = task.teamId;
      if (!teamId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Team not found",
        });
      }

      // Verify user is a member of the team
      const teamMember = await ctx.prisma.teamMember.findUnique({
        where: {
          teamId_userId: {
            teamId,
            userId: ctx.userId,
          },
        },
      });

      if (!teamMember) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this task",
        });
      }

      // Verify user is admin
      if (teamMember.role !== "admin" && teamMember.role !== "owner") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can manage task assignments",
        });
      }

      // Get current assignments
      const currentAssignments = task.assignments.map((a) => a.userId);

      try {
        // Handle different actions
        if (action === "set") {
          // Remove all existing assignments
          await ctx.prisma.taskAssignment.deleteMany({
            where: { taskId },
          });

          // Add all specified assignments
          if (userIds.length > 0) {
            await ctx.prisma.taskAssignment.createMany({
              data: userIds.map((userId) => ({
                taskId,
                userId,
              })),
              skipDuplicates: true,
            });
          }
        } else if (action === "add") {
          // Add new assignments
          if (userIds.length > 0) {
            await ctx.prisma.taskAssignment.createMany({
              data: userIds.map((userId) => ({
                taskId,
                userId,
              })),
              skipDuplicates: true,
            });
          }
        } else if (action === "remove") {
          // Remove specified assignments
          if (userIds.length > 0) {
            await ctx.prisma.$transaction(
              userIds.map((userId) =>
                ctx.prisma.taskAssignment.deleteMany({
                  where: {
                    taskId,
                    userId,
                  },
                })
              )
            );
          }
        }

        return { success: true };
      } catch (error) {
        console.error("Error updating task assignments:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update task assignments",
        });
      }
    }),

  getChecklists: protectedProcedure
    .input(
      z.object({
        teamId: z.string().uuid(),
        type: z.enum(["checklist"]).default("checklist"),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        // First verify the user has access to this team
        const membership = await ctx.prisma.teamMember.findUnique({
          where: {
            teamId_userId: {
              teamId: input.teamId,
              userId: ctx.userId!,
            },
          },
        });

        if (!membership) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to this team",
          });
        }

        // Get checklist tasks with assignments
        const tasks = await serverGetTasks({
          teamId: input.teamId,
          date: "", // Date is not relevant for checklists
          type: "checklist",
          userId: ctx.userId!,
        });

        const teamMembers = await serverGetTeamMembers({
          ctx,
          teamId: input.teamId,
          userId: ctx.userId!,
        });

        // Get completions for checklist items (without date filter)
        const completions = await ctx.prisma.taskCompletion.findMany({
          where: {
            task: {
              teamId: input.teamId,
              type: "checklist",
              isDeleted: false,
            },
          },
          include: {
            task: true,
            user: true,
          },
        });

        return {
          teamMembers,
          tasks,
          completions,
        };
      } catch (error) {
        console.error("Error fetching checklists:", error);
        if (error instanceof TRPCError) throw error;
        return null;
      }
    }),
});
