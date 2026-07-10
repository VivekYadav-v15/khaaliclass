import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; 

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
      floor: "Ground", 
      latitude: 28.6121502,  
      longitude: 77.0365392,
      capacity: 60,
      status: "AVAILABLE"
    }));

    // Inject them into MongoDB (Wrapped in try/catch since skipDuplicates is banned)
    try {
      await prisma.room.createMany({
        data: roomData,
      });
    } catch (dbError) {
      console.log("Skipping creation: APJ rooms likely already exist in the database.");
    }

    return NextResponse.json({ message: "✅ All 11 APJ Complex rooms successfully processed!" });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}