"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function updateRoomStatus(roomName: string, newStatus: string) {
  const session = await getServerSession(authOptions);

  // Security Check: Make sure they are logged in, have an email, and are a CR/ADMIN
  if (!session || !session.user?.email || ((session.user as any).role !== "CR" && (session.user as any).role !== "ADMIN")) {
    throw new Error("Unauthorized: Only CRs and Admins can update room statuses.");
  }

  // Use Prisma's 'connect' syntax to link the log via email instead of ID!
  await prisma.auditLog.create({
    data: {
      action: "ROOM_STATUS_UPDATE",
      details: `Changed status of ${roomName} to ${newStatus}`,
      user: {
        connect: { email: session.user.email } // <-- THIS IS THE MAGIC FIX
      }
    },
  });

  return { success: true, status: newStatus };
}