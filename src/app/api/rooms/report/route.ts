import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route"; // Verify this path matches your auth options location!

export async function POST(request: Request) {
  try {
    // --- 🛡️ THE BOUNCER STARTS HERE ---
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Query the DB directly to check their real role at this exact moment
    const dbUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true },
    });

    // Kick them out if they are not a CR or ADMIN
    if (!dbUser || (dbUser.role !== "CR" && dbUser.role !== "ADMIN")) {
      return NextResponse.json(
        { error: "Access denied. Your permissions have changed.", roleChanged: true },
        { status: 403 }
      );
    }
    // --- 🛡️ THE BOUNCER ENDS HERE ---

    const body = await request.json();
    const { roomId, status } = body;

    // 1. Basic validation
    if (!roomId || !status) {
      return NextResponse.json(
        { error: 'Missing roomId or status' },
        { status: 400 }
      );
    }

    // 2. Update the room in the database
    const updatedRoom = await prisma.room.update({
      where: { id: roomId },
      data: { status: status },
    });

    // 3. Clear the Redis cache for Block 5 so the new status is visible immediately
    const keys = await redis.keys('rooms:block5:*');
    if (keys.length > 0) {
      await redis.del(...keys);
      console.log('Cleared Redis cache for Block 5');
    }

    return NextResponse.json({ success: true, room: updatedRoom }, { status: 200 });

  } catch (error) {
    console.error('Error updating room status:', error);
    return NextResponse.json(
      { error: 'Failed to update room status' },
      { status: 500 }
    );
  }
}