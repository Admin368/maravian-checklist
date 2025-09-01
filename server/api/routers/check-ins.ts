import { z } from "zod";
import { router, Context } from "@/lib/trpc/server";
import { protectedProcedure } from "../middleware";
import { TRPCError } from "@trpc/server";
import { prisma } from "@/lib/prisma";
import { sendCheckinNotification } from "@/lib/notifications";

export const serverGetCheckIns = async (args: {
  teamId: string;
  date: string;
}) => {
  const checkIns = await prisma.checkIn.findMany({
    where: {
      teamId: args.teamId,
      checkInDate: toISODateTime(args.date),
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        },
      },
      team: {
        select: {
          id: true,
          name: true,
          bans: true,
          members: {
            select: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  avatarUrl: true,
                },
              },
              role: true,
            },
          },
        },
      },
    },
    orderBy: {
      checkedInAt: "asc",
    },
  });

  return checkIns.map((checkIn: CheckInWithUser) => ({
    id: checkIn.id,
    userId: checkIn.userId,
    checkInDate: checkIn.checkInDate,
    checkedInAt: checkIn.checkedInAt,
    notes: checkIn.notes,
    rating: checkIn.rating,
    checkoutAt: checkIn.checkoutAt,
    user: checkIn.user,
    role: (checkIn as any).team.members.find(
      (member: { user: { id: string }; role: string }) =>
        member.user.id === checkIn.userId
    )?.role,
    isBanned: (checkIn as any).team.bans.some(
      (ban: { userId: string }) => ban.userId === checkIn.userId
    ),
    memberId: (checkIn as any).team.members.find(
      (member: { user: { id: string } }) => member.user.id === checkIn.userId
    )?.id,
  }));
};

export type serverGetCheckInsReturnType = Awaited<
  ReturnType<typeof serverGetCheckIns>
>[number];

// Helper function to convert date string to ISO DateTime
export function toISODateTime(dateStr: string) {
  const date = new Date(dateStr);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

// Define input schemas
const getByTeamAndDateSchema = z.object({
  teamId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD format
});

const getHistorySchema = z.object({
  teamId: z.string().uuid(),
  limit: z.number().min(1).max(100).optional().default(30),
});

const getUserCheckInStatusSchema = z.object({
  teamId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD format
});

const checkInSchema = z.object({
  teamId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD format
  notes: z.string().optional(),
});

const checkoutSchema = z.object({
  checkInId: z.string().uuid(),
  rating: z.number().min(1).max(5),
  notes: z.string().optional(),
});

interface CheckInWithUser {
  id: string;
  userId: string;
  checkInDate: Date;
  checkedInAt: Date;
  notes: string | null;
  rating: number | null;
  checkoutAt: Date | null;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    avatarUrl: string | null;
  };
}

export async function serverGetCheckInStatus({
  ctx,
  teamId,
  date,
}: {
  ctx: Context;
  teamId: string;
  date: string;
}) {
  const userId = ctx.userId;
  const checkInDate = toISODateTime(date).toISOString(); // yyyy-mm-dd
  if (!userId || !teamId || !checkInDate) {
    return {
      checkedIn: false,
      checkInDetails: null,
    };
  }
  const checkIn = await prisma.checkIn.findUnique({
    where: {
      teamId_userId_checkInDate: {
        teamId: teamId,
        userId: userId,
        checkInDate: checkInDate,
      },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        },
      },
    },
  });

  return {
    checkedIn: !!checkIn,
    checkInDetails: checkIn
      ? {
          id: checkIn.id,
          userId: checkIn.userId,
          checkInDate: checkIn.checkInDate,
          checkedInAt: checkIn.checkedInAt,
          notes: checkIn.notes,
          rating: checkIn.rating,
          checkoutAt: checkIn.checkoutAt,
          user: checkIn.user,
        }
      : null,
  };
}

export const checkInsRouter = router({
  getByTeamAndDate: protectedProcedure
    .input(getByTeamAndDateSchema)
    .query(async ({ ctx, input }) => {
      try {
        // First verify the user has access to this team
        const membership = await prisma.teamMember.findUnique({
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

        // Get check-ins with user details

        return await serverGetCheckIns({
          teamId: input.teamId,
          date: input.date,
        });
      } catch (error) {
        console.error("Error fetching check-ins:", error);
        if (error instanceof TRPCError) throw error;
        return [];
      }
    }),

  getHistory: protectedProcedure
    .input(getHistorySchema)
    .query(async ({ ctx, input }) => {
      try {
        // First verify the user has access to this team
        const membership = await prisma.teamMember.findUnique({
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

        // Get daily check-in counts for the past X days
        const checkInCounts = await prisma.$queryRaw`
          SELECT 
            DATE(check_in_date)::text as check_in_date,
            COUNT(*) as check_in_count
          FROM check_ins
          WHERE team_id = ${input.teamId}::uuid
          GROUP BY DATE(check_in_date)
          ORDER BY DATE(check_in_date) DESC
          LIMIT ${input.limit}
        `;

        return checkInCounts;
      } catch (error) {
        console.error("Error fetching check-in history:", error);
        if (error instanceof TRPCError) throw error;
        return [];
      }
    }),

  getUserCheckInStatus: protectedProcedure
    .input(getUserCheckInStatusSchema)
    .query(async ({ ctx, input }) => {
      try {
        // First verify the user has access to this team
        const membership = await prisma.teamMember.findUnique({
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

        // Check if the user has checked in for the day
        return await serverGetCheckInStatus({
          ctx,
          teamId: input.teamId,
          date: input.date,
        });
      } catch (error) {
        console.error("Error fetching check-in status:", error);
        if (error instanceof TRPCError) throw error;
        return { checkedIn: false, checkInDetails: null };
      }
    }),

  checkIn: protectedProcedure
    .input(checkInSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // First verify the user has access to this team
        const membership = await prisma.teamMember.findUnique({
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

        // Create the check-in
        const date = toISODateTime(input.date);
        const checkIn = await prisma.checkIn.create({
          data: {
            teamId: input.teamId,
            userId: ctx.userId!,
            checkInDate: date,
            notes: input.notes,
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });

        // Send check-in notification
        try {
          await sendCheckinNotification(
            {
              teamId: input.teamId,
              actorUserId: ctx.userId!,
              notificationType: "checkin",
            },
            {
              checkinUserId: ctx.userId!,
              checkinUserName: checkIn.user.name,
              notes: input.notes,
            }
          );
        } catch (error) {
          console.error("Failed to send check-in notification:", error);
          // Don't fail the check-in if notification fails
        }

        return {
          success: true,
          message: "Successfully checked in",
          checkIn,
        };
      } catch (error) {
        console.error("Error checking in:", error);
        throw error;
      }
    }),

  checkout: protectedProcedure
    .input(checkoutSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // Get the check-in
        const checkIn = await prisma.checkIn.findUnique({
          where: { id: input.checkInId },
          include: { team: true },
        });

        if (!checkIn) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Check-in not found",
          });
        }

        // Verify user owns this check-in
        if (checkIn.userId !== ctx.userId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You can only checkout your own check-in",
          });
        }

        // Verify user hasn't already checked out
        if (checkIn.checkoutAt) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "You have already checked out for today",
          });
        }

        // Update the check-in with checkout information
        const updatedCheckIn = await prisma.checkIn.update({
          where: { id: input.checkInId },
          data: {
            rating: input.rating,
            notes: input.notes,
            checkoutAt: new Date(),
          },
        });

        return {
          success: true,
          message: "Successfully checked out",
          checkIn: updatedCheckIn,
        };
      } catch (error) {
        console.error("Error checking out:", error);
        throw error;
      }
    }),
});
