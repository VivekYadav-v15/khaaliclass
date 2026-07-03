import RoomSchedule from "@/components/RoomSchedule";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

// Notice how params is now typed as a Promise!
export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  // 1. Unwrap the params promise first!
  const resolvedParams = await params;

  // 2. NOW you can safely use the ID to fetch the room
  const room = await prisma.room.findUnique({
    where: { id: resolvedParams.id }
  });

  if (!room) {
    redirect("/"); // Send them back to the map if they type a fake room URL
  }

  return (
    <RoomSchedule 
      roomName={room.name} 
      buildingName={room.building} 
    />
  );
}