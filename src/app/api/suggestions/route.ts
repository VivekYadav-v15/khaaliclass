import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // 👇 THIS IS THE LINE WE FIXED
    const { roomName, reportedStatus, distanceMeters, isValidated, userName } = body;

    const suggestion = await (prisma as any).studentSuggestion.create({
      data: {
        roomName,
        reportedStatus,
        distanceMeters,
        isValidated,
        userName, 
      },
    });

    return NextResponse.json(suggestion, { status: 200 });
  } catch (error) {
    console.error("❌ Failed to save suggestion to database:", error);
    return NextResponse.json({ error: "Failed to save suggestion" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const suggestions = await prisma.studentSuggestion.findMany({
      orderBy: { timestamp: 'desc' }, 
      take: 50 
    });
    return NextResponse.json(suggestions, { status: 200 });
  } catch (error) {
    console.error("❌ Failed to fetch suggestions for Admin:", error);
    return NextResponse.json({ error: "Failed to fetch suggestions" }, { status: 500 });
  }
}