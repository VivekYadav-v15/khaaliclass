import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { redis } from '@/lib/redis'

const prisma = new PrismaClient()

// Constants for Trust Engine
const ALLOWED_CAMPUS_IP_PREFIX = "14.139." // Example Indian academic IP block
const MAX_DISTANCE_METERS = 20

// Haversine formula implementation to calculate distance between two coordinates
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3 // Earth radius in meters
  const toRadians = (deg: number) => deg * (Math.PI / 180)
  
  const phi1 = toRadians(lat1)
  const phi2 = toRadians(lat2)
  const deltaPhi = toRadians(lat2 - lat1)
  const deltaLambda = toRadians(lon2 - lon1)

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2)
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { roomId, status, userLat, userLon, userId } = body

    // 1. Fetch Room Data (Check Cache First)
    let room = await redis.get(`room:${roomId}`) as any
    if (!room) {
      room = await prisma.room.findUnique({ where: { id: roomId } })
      if (!room) {
        return NextResponse.json({ error: "Room not found" }, { status: 404 })
      }
      await redis.set(`room:${roomId}`, JSON.stringify(room), { ex: 3600 }) // Cache for 1 hour
    }

    // 2. Trust Engine Check: Network
    const forwardedFor = request.headers.get('x-forwarded-for')
    const ip = forwardedFor ? forwardedFor.split(',')[0] : 'unknown'
    const isCampusNetwork = ip.startsWith(ALLOWED_CAMPUS_IP_PREFIX) || ip === '::1' // Allow localhost for dev

    // 3. Trust Engine Check: Geofencing
    const distance = calculateDistance(userLat, userLon, room.latitude, room.longitude)
    const isWithinRange = distance <= MAX_DISTANCE_METERS

    // 4. SHADOW VALIDATION (The Silent Ignore)
    // If the user fails either check, we return a 200 SUCCESS to trick the client, but drop the DB operation.
    if (!isCampusNetwork || !isWithinRange) {
      console.log(`[Shadow Drop] User ${userId} failed validation. Distance: ${distance}m, IP: ${ip}`)
      // Still log the untrusted report for future data analysis/banning algorithms
      await prisma.report.create({
        data: { roomId, userId, status, trusted: false }
      })
      return NextResponse.json({ success: true, message: "Report received and validated." }, { status: 200 })
    }

    // 5. Validated Execution: Cache-Aside Update
    // Write to Source of Truth (Atlas)
    await prisma.$transaction([
      prisma.report.create({
        data: { roomId, userId, status, trusted: true }
      }),
      prisma.room.update({
        where: { id: roomId },
        data: { status }
      })
    ])

    // Invalidate/Update the Redis Cache immediately
    const updatedRoom = { ...room, status }
    await redis.set(`room:${roomId}`, JSON.stringify(updatedRoom), { ex: 3600 })

    return NextResponse.json({ success: true, message: "Report received and validated." }, { status: 200 })

  } catch (error) {
    console.error("Report API Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
