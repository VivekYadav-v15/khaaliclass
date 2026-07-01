import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route"; // adjust your import path
import prisma from "@/lib/prisma"; // adjust based on your ORM

export async function POST(req: Request) {
  try {
    // 1. Get the session (The Cookie)
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. THE BOUNCER: Query the DB for the absolute truth
    const dbUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true }, // Only fetch what we need!
    });

    // 3. Kick them out if they aren't a CR anymore
    if (!dbUser || dbUser.role !== "CR") {
      return NextResponse.json(
        { error: "Access denied. Your role has changed.", roleChanged: true }, 
        { status: 403 }
      );
    }

    // 4. If they pass, execute the VIP action here...
    return NextResponse.json({ success: "Action completed successfully!" });

  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}