import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { redis } from '@/lib/redis';

// Constants
const ALLOWED_CAMPUS_IP_PREFIX = "14.139."; 
const MAX_DISTANCE_METERS = 20;

// NO PRISMA INITIALIZATION HERE! We keep the global scope clean.

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const toRadians = (deg: number) => deg * (Math.PI / 180);
  
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaPhi = toRadians(lat2 - lat1);
  const deltaLambda = toRadians(lon2 - lon1);

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function POST(request: Request) {
  // 1. INITIALIZE PRISMA STRICTLY INSIDE THE FUNCTION
  const prisma = new PrismaClient();

  try {
    const body = await request.json();
    const { roomId, status, userLat, userLon, userId } = body;

    // 2. Fetch Room Data (Check Cache First)
    const cachedRoom = await redis.get(`room:${roomId}`);
    let room: any;

    if (cachedRoom) {
      room = JSON.parse(cachedRoom as string);
    } else {
      room = await prisma.room.findUnique({ where: { id: roomId } });
      if (!room) {
        return NextResponse.json({ error: "Room not found" }, { status: 404 });
      }
      await redis.set(`room:${roomId}`, JSON.stringify(room), { ex: 3600 });
    }

    // 3. Trust Engine Check: Network
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ip = forwardedFor ? forwardedFor.split(',')[0] : 'unknown';
    const isCampusNetwork = ip.startsWith(ALLOWED_CAMPUS_IP_PREFIX) || ip === '::1';

    // 4. Trust Engine Check: Geofencing
    const distance = calculateDistance(userLat, userLon, room.latitude, room.longitude);
    const isWithinRange = distance <= MAX_DISTANCE_METERS;

    // 5. SHADOW VALIDATION
    if (!isCampusNetwork || !isWithinRange) {
      console.log(`[Shadow Drop] User ${userId} failed validation. Distance: ${distance}m, IP: ${ip}`);
      await prisma.report.create({
        data: { roomId, userId, status, trusted: false }
      });
      return NextResponse.json({ success: true, message: "Report received and validated." }, { status: 200 });
    }

    // 6. Validated Execution
    await prisma.$transaction([
      prisma.report.create({
        data: { roomId, userId, status, trusted: true }
      }),
      prisma.room.update({
        where: { id: roomId },
        data: { status }
      })
    ]);

    await redis.set(`room:${roomId}`, JSON.stringify({ ...room, status }), { ex: 3600 });

    return NextResponse.json({ success: true, message: "Report received and validated." }, { status: 200 });

  } catch (error) {
    console.error("Report API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  } finally {
    // Clean up the connection when we are done
    await prisma.$disconnect();
  }
}