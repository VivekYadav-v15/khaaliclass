"use server";
import { prisma } from "@/lib/prisma";

// 1. THE APPLY FUNCTION (Used by students)
export async function applyForCR(userEmail: string) {
  if (!userEmail) throw new Error("No email provided");
  
  // Use the boolean flag your schema expects, not a new role string
  await prisma.user.update({
    where: { email: userEmail },
    data: { crRequested: true } 
  });

  return { success: true };
}

// 2. THE DEMOTE FUNCTION (Used by Admin)
export async function demoteCR(targetUserId: string, adminId: string) {
  // Update the user AND grab their name
  const updatedUser = await prisma.user.update({
    where: { id: targetUserId },
    data: { role: 'STUDENT', crRequested: false }, // Reset the request flag just in case
    select: { name: true } 
  });

  // Create the log using the exact column names your schema expects
  await prisma.auditLog.create({
    data: {
      userId: adminId,  // Changed from adminId
      action: 'CR_DEMOTED',
      details: `Demoted ${updatedUser.name} back to STUDENT` // Changed from message
    }
  });

  return { success: true };
}

// 3. THE APPROVE FUNCTION (Used by Admin)
export async function approveCR(targetUserId: string, adminId: string) {
  const updatedUser = await prisma.user.update({
    where: { id: targetUserId },
    data: { role: 'CR', crRequested: false },
    select: { name: true } 
  });

  await prisma.auditLog.create({
    data: {
      userId: adminId, // Changed from adminId
      action: 'CR_APPROVED',
      details: `Approved ${updatedUser.name} to CR status` // Changed from message
    }
  });

  return { success: true };
}