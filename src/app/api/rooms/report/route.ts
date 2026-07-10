import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    // Make sure suggestedStatus matches what your frontend sends!
    const { roomId, suggestedStatus } = body; 

    // 1. Fetch the user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // 2. 🚨 THE GHOSTING PROTOCOL 🚨
    if (user.trustScore < 20) {
      await prisma.report.create({
        data: {
          roomId: roomId,
          userId: user.id,
          status: suggestedStatus || "UNKNOWN", // 👈 FIXED: Required field added back!
          moderationStatus: "REJECTED",
          rejectedReason: `Shadow Banned: Trust score too low (${user.trustScore}/100)`
        }
      });

      return NextResponse.json({ 
        success: true, 
        message: "Thank you! Your report has been submitted." 
      });
    }

    // 3. NORMAL PROTOCOL
    await prisma.report.create({
      data: {
        roomId: roomId,
        userId: user.id,
        status: suggestedStatus || "UNKNOWN", // 👈 FIXED: Required field added back!
        moderationStatus: "PENDING", 
      }
    });

    return NextResponse.json({ success: true, message: "Report submitted successfully." });

  } catch (error) {
    console.error("Report Submission Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}