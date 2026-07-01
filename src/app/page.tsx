"use client";

import CampusMap from '@/components/CampusMap'; 

export default function KhaliClassDashboard() {
  return (
    <main className="w-full h-screen overflow-hidden bg-zinc-950">
      <CampusMap onSelectBlock={(block) => console.log("Block selected:", block)} />
    </main>
  );
} 