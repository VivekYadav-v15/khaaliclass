"use server";

import { prisma } from "@/lib/prisma";

export async function applyForCR(userEmail: string) {
  if (!userEmail) throw new Error("No email provided");
  
  // Updates the student's profile to flag them as a CR applicant
  await prisma.user.update({
    where: { email: userEmail },
    data: { crRequested: true }
  });
  
  return { success: true };
}