import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const notificationSettingsSchema = z.object({
  notificationOnInvitation: z.boolean(),
  notificationOnAssignment: z.boolean(),
  notificationOnTaskCompletion: z.boolean(),
  notificationOnCheckin: z.boolean(),
  notificationOnNewTasks: z.boolean(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = notificationSettingsSchema.parse(body);

    // Update user's notification settings
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        notificationOnInvitation: validatedData.notificationOnInvitation,
        notificationOnAssignment: validatedData.notificationOnAssignment,
        notificationOnTaskCompletion:
          validatedData.notificationOnTaskCompletion,
        notificationOnCheckin: validatedData.notificationOnCheckin,
        notificationOnNewTasks: validatedData.notificationOnNewTasks,
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

    return NextResponse.json({
      message: "Notification settings updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error updating notification settings:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data format", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
