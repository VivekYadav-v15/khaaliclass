import RoomSchedule from "@/components/RoomSchedule";
import RoomControls from "@/components/RoomControls"; 
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

// 1. Notice the type of params changed to a Promise
export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  
  // 2. We MUST await the params before extracting the ID!
  const resolvedParams = await params;
  const currentRoomId = resolvedParams.id;

  // 3. Now we safely pass the loaded ID to Prisma
  const room = await prisma.room.findUnique({
    where: { id: currentRoomId }
  });

  if (!room) {
    redirect("/");
  }

  return (
    <div className="max-w-7xl mx-auto p-4">
      {/* Your Controls Component */}
      <RoomControls roomId={currentRoomId} /> 
      
      {/* Your Schedule Grid Component */}
      <RoomSchedule roomName={room.name} buildingName={room.building} />
    </div>
  );
}