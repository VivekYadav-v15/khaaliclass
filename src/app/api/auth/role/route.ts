import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route"; 

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    // If they aren't logged in, do nothing
    if (!session?.user?.email) {
      return NextResponse.json({ role: null });
    }

    // Check their exact role in the DB at this very second
    const dbUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true },
    });

    return NextResponse.json({ role: dbUser?.role || 'STUDENT' });
  } catch (error) {
    return NextResponse.json({ error: "Failed to check role" }, { status: 500 });
  }
}