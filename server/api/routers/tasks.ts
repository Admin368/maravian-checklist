import { z } from "zod";
import { router } from "@/lib/trpc/server";
import { protectedProcedure } from "../middleware";
import { TRPCError } from "@trpc/server";
import { serverGetTeamMembers } from "./users";
import { toISODateTime } from "./check-ins";
import { serverGetCheckInStatus } from "./check-ins";
import { prisma } from "@/lib/prisma";
import { TaskType } from "@/types/task";
import {
  sendTaskAssignmentNotification,
  sendNewTaskNotification,
} from "@/lib/notifications";

export const serverGetTasks = async (args: {
  teamId: string;
  date?: string;
  type?: string;
  userId?: string;
  includeDeleted?: boolean;
}) => {
  const whereClause: any = {
    teamId: args.teamId,
    isDeleted: false,
  };

  if (args.type) {
    whereClause.type = args.type;
  }

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
  date?: string;
  userId: string;
  isChecklist?: boolean;
}) => {
  const whereClause: any = {
    task: {
      teamId: args.teamId,
      isDeleted: false,
    },
  };

  if (args.isChecklist) {
    whereClause.completionDate = null;
  } else if (args.date) {
    whereClause.completionDate = toISODateTime(args.date);
  } else {
    return [];
  }

  return await prisma.taskCompletion.findMany({
    where: whereClause,
    include: {
      task: true,
      user: true,
    },
  });
};

export type serverGetCompletionsReturnType = Awaited<
  ReturnType<typeof serverGetCompletions>
>[number];

export const tasksRouter = router({
  getById: protectedProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const task = await prisma.task.findUnique({
        where: { id: input.taskId },
        include: { assignments: true },
      });

      if (!task)
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });

      const membership = await prisma.teamMember.findUnique({
        where: {
          teamId_userId: {
            teamId: task.teamId!,
            userId: ctx.userId!,
          },
        },
      });

      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this task",
        });
      }

      return task;
    }),

  getByTeam: protectedProcedure
    .input(
      z.object({
        teamId: z.string().uuid(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        taskType: z.nativeEnum(TaskType).default(TaskType.DAILY),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
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

        const tasks = await serverGetTasks({
          teamId: input.teamId,
          date: input.date,
          type: input.taskType === "all" ? undefined : input.taskType,
          userId: ctx.userId!,
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
          isChecklist: false,
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
        deadline: z.string().optional(),
        time: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
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
        const deadline_ = input.deadline;
        const deadline = deadline_
          ? (() => {
              const [month, day, year] = deadline_.split("/");
              return new Date(
                Date.UTC(
                  parseInt(year),
                  parseInt(month) - 1, // months are 0-based in JavaScript
                  parseInt(day)
                )
              );
            })()
          : null;
        const task = await ctx.prisma.task.create({
          data: {
            title: input.title,
            parentId: input.parentId,
            teamId: input.teamId,
            position,
            type: input.type,
            visibility: input.visibility,
            deadline: deadline,
            time: input.time,
          },
        });

        // Send new task notification
        try {
          await sendNewTaskNotification(
            {
              teamId: input.teamId,
              actorUserId: ctx.userId!,
              notificationType: "new_tasks",
            },
            {
              taskId: task.id,
              taskTitle: task.title,
              taskType: task.type,
            }
          );
        } catch (error) {
          console.error("Failed to send new task notification:", error);
          // Don't fail the task creation if notification fails
        }

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
        id: z.string().uuid(),
        teamId: z.string().uuid(),
        title: z.string().min(1).optional(),
        parentId: z.string().uuid().nullable().optional(),
        position: z.number().optional(),
        visibility: z.enum(["team", "private", "public"]).optional(),
        deadline: z.string().optional().nullable(),
        time: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const membership = await ctx.prisma.teamMember.findUnique({
          where: {
            teamId_userId: { teamId: input.teamId, userId: ctx.userId },
          },
        });

        if (!membership) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
        }

        const { id, teamId, ...updateDataInput } = input;

        if (updateDataInput.parentId === id) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Task cannot be its own parent",
          });
        }

        const updatePayload: any = { ...updateDataInput };
        if (input.hasOwnProperty("deadline")) {
          const deadline_ = input.deadline;
          const deadline = deadline_
            ? (() => {
                const [month, day, year] = deadline_.split("/");
                return new Date(
                  Date.UTC(
                    parseInt(year),
                    parseInt(month) - 1, // months are 0-based in JavaScript
                    parseInt(day)
                  )
                );
              })()
            : null;
          updatePayload.deadline = deadline;
        }
        if (input.hasOwnProperty("time")) {
          updatePayload.time = input.time;
        }

        const updatedTask = await ctx.prisma.task.update({
          where: { id: id },
          data: updatePayload,
        });
        return updatedTask;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update task.",
        });
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
          const children = await ctx.prisma.task.findMany({
            where: { parentId: taskId },
          });

          await ctx.prisma.task.update({
            where: { id: taskId },
            data: { isDeleted: true },
          });

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

      if (teamMember.role !== "admin" && teamMember.role !== "owner") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can assign tasks",
        });
      }

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

        // Send task assignment notification
        try {
          await sendTaskAssignmentNotification(
            {
              teamId: teamId,
              actorUserId: ctx.userId!,
              notificationType: "assignment",
            },
            {
              taskId: taskId,
              taskTitle: task.title,
              assignedToUserId: userId,
            }
          );
        } catch (error) {
          console.error("Failed to send task assignment notification:", error);
          // Don't fail the assignment if notification fails
        }
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

      if (teamMember.role !== "admin" && teamMember.role !== "owner") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can manage task assignments",
        });
      }

      const currentAssignments = task.assignments.map((a) => a.userId);

      try {
        if (action === "set") {
          await ctx.prisma.taskAssignment.deleteMany({
            where: { taskId },
          });

          if (userIds.length > 0) {
            await ctx.prisma.taskAssignment.createMany({
              data: userIds.map((userId) => ({
                taskId,
                userId,
              })),
              skipDuplicates: true,
            });

            // Send notifications for new assignments (only to users not previously assigned)
            try {
              const newAssignments = userIds.filter(
                (userId) => !currentAssignments.includes(userId)
              );
              for (const userId of newAssignments) {
                await sendTaskAssignmentNotification(
                  {
                    teamId: teamId,
                    actorUserId: ctx.userId!,
                    notificationType: "assignment",
                  },
                  {
                    taskId: taskId,
                    taskTitle: task.title,
                    assignedToUserId: userId,
                  }
                );
              }
            } catch (error) {
              console.error(
                "Failed to send task assignment notifications:",
                error
              );
            }
          }
        } else if (action === "add") {
          if (userIds.length > 0) {
            await ctx.prisma.taskAssignment.createMany({
              data: userIds.map((userId) => ({
                taskId,
                userId,
              })),
              skipDuplicates: true,
            });

            // Send notifications for new assignments
            try {
              for (const userId of userIds) {
                await sendTaskAssignmentNotification(
                  {
                    teamId: teamId,
                    actorUserId: ctx.userId!,
                    notificationType: "assignment",
                  },
                  {
                    taskId: taskId,
                    taskTitle: task.title,
                    assignedToUserId: userId,
                  }
                );
              }
            } catch (error) {
              console.error(
                "Failed to send task assignment notifications:",
                error
              );
            }
          }
        } else if (action === "remove") {
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

        const tasks = await serverGetTasks({
          teamId: input.teamId,
          date: "",
          type: "checklist",
          userId: ctx.userId!,
        });

        const teamMembers = await serverGetTeamMembers({
          ctx,
          teamId: input.teamId,
          userId: ctx.userId!,
        });

        const completions = await serverGetCompletions({
          teamId: input.teamId,
          userId: ctx.userId!,
          isChecklist: true,
        });

        return {
          teamMembers,
          tasks,
          completions,
        };
      } catch (error) {
        console.error("Error fetching checklists:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch checklists",
        });
      }
    }),
});
