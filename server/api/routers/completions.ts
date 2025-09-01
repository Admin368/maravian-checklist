import { z } from "zod";
import { router } from "@/lib/trpc/server";
import { protectedProcedure } from "../middleware";
import { TRPCError } from "@trpc/server";
import { prisma } from "@/lib/prisma";
import type { Context } from "@/lib/trpc/server";
import { serverGetTeamMembers } from "./users";
import { toISODateTime } from "./check-ins";
import { sendTaskCompletionNotification } from "@/lib/notifications";

// Define input schemas
const getByDateSchema = z.object({
  taskId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD format
});

const getAllByDateSchema = z.object({
  teamId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD format
});

const toggleSchema = z.object({
  userId: z.string().uuid(),
  taskId: z.string().uuid(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(), // YYYY-MM-DD format (optional for checklists)
  completed: z.boolean(),
  isChecklist: z.boolean().optional(),
});

type GetByDateInput = z.infer<typeof getByDateSchema>;
type GetAllByDateInput = z.infer<typeof getAllByDateSchema>;
type ToggleInput = z.infer<typeof toggleSchema>;

export const completionsRouter = router({
  getByDate: protectedProcedure
    .input(getByDateSchema)
    .query(async ({ ctx, input }: { ctx: Context; input: GetByDateInput }) => {
      try {
        // First verify the user has access to this task
        const task = await prisma.task.findFirst({
          where: {
            id: input.taskId,
            isDeleted: false,
          },
          include: {
            team: {
              include: {
                members: {
                  where: {
                    userId: ctx.userId!,
                  },
                },
              },
            },
          },
        });

        if (!task) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Task not found",
          });
        }

        if (!task.team?.members.length) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to this task",
          });
        }

        // Get completion status
        const completion = await prisma.taskCompletion.findFirst({
          where: {
            taskId: input.taskId,
            completionDate: toISODateTime(input.date),
            task: {
              team: {
                id: task.team.id,
              },
            },
          },
        });

        return {
          completed: !!completion,
          completionDetails: completion,
        };
      } catch (error) {
        console.error("Error fetching completion status:", error);
        if (error instanceof TRPCError) throw error;
        return { completed: false, completionDetails: null };
      }
    }),

  getAllByDate: protectedProcedure
    .input(getAllByDateSchema)
    .query(
      async ({ ctx, input }: { ctx: Context; input: GetAllByDateInput }) => {
        try {
          const { teamId, date } = input;
          if (!teamId) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Team ID is required",
            });
          }

          if (!ctx.userId) {
            throw new TRPCError({
              code: "UNAUTHORIZED",
              message: "You must be logged in to view completions",
            });
          }

          const teamMembers = await serverGetTeamMembers({
            ctx,
            teamId,
            userId: ctx.userId,
          });

          // Get all completions for the user on the specified date
          const completions = await ctx.prisma.taskCompletion.findMany({
            where: {
              completionDate: toISODateTime(input.date),
              task: {
                team: {
                  members: {
                    some: {
                      userId: ctx.userId,
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

          return { teamMembers, completions };
        } catch (error) {
          console.error("Error fetching completions:", error);
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch completions",
          });
        }
      }
    ),

  toggle: protectedProcedure
    .input(toggleSchema)
    .mutation(async ({ ctx, input }: { ctx: Context; input: ToggleInput }) => {
      try {
        if (!ctx.userId) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "You must be logged in to complete tasks",
          });
        }

        // For non-checklist items (daily tasks), verify check-in status
        if (!input.isChecklist) {
          if (!input.date) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Date is required for daily tasks",
            });
          }

          // Check if the user has checked in for the day
          const checkIn = await ctx.prisma.checkIn.findFirst({
            where: {
              userId: ctx.userId,
              checkInDate: toISODateTime(input.date),
            },
          });

          if (!checkIn && input.completed) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "You must check in before completing tasks",
            });
          }
        }

        // Verify the user has access to the task
        const task = await ctx.prisma.task.findFirst({
          where: {
            id: input.taskId,
            isDeleted: false,
          },
          include: {
            team: {
              include: {
                members: {
                  where: {
                    userId: ctx.userId,
                  },
                },
              },
            },
          },
        });

        if (!task) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Task not found",
          });
        }

        if (!task.team?.members.length) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to this task",
          });
        }

        // Handle task completion toggle
        if (input.completed) {
          // Mark task as completed
          const completionDate = input.date ? toISODateTime(input.date) : null;

          // Check if completion already exists
          const existingCompletion = await ctx.prisma.taskCompletion.findFirst({
            where: {
              taskId: input.taskId,
              userId: ctx.userId,
              ...(completionDate ? { completionDate } : {}),
            },
          });

          if (!existingCompletion) {
            await ctx.prisma.taskCompletion.create({
              data: {
                taskId: input.taskId,
                userId: ctx.userId,
                ...(completionDate ? { completionDate } : {}),
              },
            });

            // Send task completion notification
            try {
              await sendTaskCompletionNotification(
                {
                  teamId: task.team!.id,
                  actorUserId: ctx.userId!,
                  notificationType: "task_completion",
                },
                {
                  taskId: input.taskId,
                  taskTitle: task.title,
                  completedByUserId: ctx.userId!,
                }
              );
            } catch (error) {
              console.error(
                "Failed to send task completion notification:",
                error
              );
              // Don't fail the completion if notification fails
            }
          }
        } else {
          // Remove completion
          const completionDate = input.date ? toISODateTime(input.date) : null;

          if (completionDate) {
            // For daily tasks with date
            await ctx.prisma.taskCompletion.deleteMany({
              where: {
                taskId: input.taskId,
                userId: ctx.userId,
                completionDate,
              },
            });
          } else {
            // For checklist items without date
            await ctx.prisma.taskCompletion.deleteMany({
              where: {
                taskId: input.taskId,
                userId: ctx.userId,
                completionDate: null,
              },
            });
          }
        }

        return { success: true };
      } catch (error) {
        console.error("Error toggling task completion:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update task status",
        });
      }
    }),
});
