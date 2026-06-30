import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { roomId, status } = body;

    // 1. Basic validation
    if (!roomId || !status) {
      return NextResponse.json(
        { error: 'Missing roomId or status' },
        { status: 400 }
      );
    }

    // 2. Update the room in Supabase
    const updatedRoom = await prisma.room.update({
      where: { id: roomId },
      data: { status: status },
    });

    // 3. Clear the Redis cache for Block 5 so the new status is visible immediately
    // In a production app, you might only clear the specific floor/status key, 
    // but clearing all Block 5 keys guarantees no one sees stale data.
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