import { z } from "zod";
import { router, publicProcedure } from "@/lib/trpc/server";
import { protectedProcedure } from "../middleware";
import { slugify } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { Context } from "@/lib/trpc/server";

type TeamInput = {
  name: string;
  password: string;
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
      const teams = await ctx.prisma.team.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          createdAt: true,
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

  getBySlug: publicProcedure
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
        return team;
      } catch (error) {
        console.error("Error fetching team:", error);
        throw error;
      }
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        password: z.string().min(4),
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

        // Create team and add creator as admin in a transaction
        const team = await ctx.prisma.$transaction(async (tx) => {
          const newTeam = await tx.team.create({
            data: {
              name: input.name,
              slug,
              password: input.password, // In a real app, you'd hash this
            },
          });

          await tx.teamMember.create({
            data: {
              teamId: newTeam.id,
              userId,
              role: "admin",
            },
          });

          return newTeam;
        });

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
    .mutation(async ({ ctx, input }: { ctx: Context; input: JoinInput }) => {
      try {
        if (!ctx.userId) throw new Error("User ID is required");
        const userId = ctx.userId; // Create a non-nullable reference

        // Verify password
        const team = await ctx.prisma.team.findUnique({
          where: { id: input.teamId },
          select: { password: true },
        });

        if (!team || team.password !== input.password) {
          throw new Error("Incorrect password");
        }

        // Check if user is already a member
        const existingMembership = await ctx.prisma.teamMember.findUnique({
          where: {
            teamId_userId: {
              teamId: input.teamId,
              userId,
            },
          },
        });

        // If not already a member, add them
        if (!existingMembership) {
          await ctx.prisma.teamMember.create({
            data: {
              teamId: input.teamId,
              userId,
              role: "member",
            },
          });
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
    .mutation(async ({ ctx, input }) => {
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
          !["admin", "owner"].includes(currentUserRole.role)
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
});

export type TeamsRouter = typeof teamsRouter;
export type TeamsInput = inferRouterInputs<TeamsRouter>;
export type TeamsOutput = inferRouterOutputs<TeamsRouter>;
