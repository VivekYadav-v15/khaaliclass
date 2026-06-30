import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; // Adjust this import if your prisma client is somewhere else!

export async function GET() {
  try {
    const apjRooms = [
      "APJ 1", "APJ 2", "APJ 3", "APJ 4", "APJ 5", 
      "APJ 6", "APJ 7", "APJ 8", "APJ 9", "APJ 10", "APJ 11"
    ];

    // Map them to match your Prisma Room schema
    const roomData = apjRooms.map((roomName) => ({
      name: roomName,
      building: "APJ Complex",
      floor: "Ground", // Putting them on Ground floor by default
      latitude: 28.6121502,  // Rough APJ coordinates
      longitude: 77.0365392,
      capacity: 60,
      status: "AVAILABLE"
    }));

    // Inject them into Supabase
    await prisma.room.createMany({
      data: roomData,
      skipDuplicates: true, // Prevents crashing if you run it twice
    });

    return NextResponse.json({ message: "✅ All 11 APJ Complex rooms successfully added to the database!" });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}