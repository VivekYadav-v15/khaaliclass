import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; 

export async function GET() {
  try {
    // 🚀 Fetch ALL rooms unconditionally. The frontend will handle the filtering!
    const rooms = await prisma.room.findMany({
      orderBy: { name: 'asc' }
    });
    
    return NextResponse.json(rooms);
  } catch (error) {
    console.error("Failed to fetch rooms:", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}