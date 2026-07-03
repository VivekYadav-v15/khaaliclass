"use client";

import { useRouter } from "next/navigation";
import React, { useState } from 'react';

// A simple reusable accordion component for the "Room Utilities" section
const UtilityAccordion = ({ title, badgeCount }: { title: string, badgeCount: number }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border border-zinc-800 rounded-lg mb-3 overflow-hidden bg-[#18181b]">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-zinc-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-sm text-zinc-200">{title}</span>
          <span className="bg-amber-900/50 text-amber-500 text-xs px-2 py-0.5 rounded-full border border-amber-700/50">
            {badgeCount}
          </span>
        </div>
        <svg 
          className={`w-5 h-5 text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="p-4 border-t border-zinc-800 text-zinc-400 text-sm bg-zinc-900/50">
          <p>Data pending... (Waiting for TT feed)</p>
        </div>
      )}
    </div>
  );
};

export default function RoomSchedule({ 
  roomName, 
  buildingName 
}: { 
  roomName: string; 
  buildingName: string; 
}) {
  const router = useRouter();
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const hours = ['8 AM', '9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM', '6 PM'];

  return (
    <div className="fixed inset-0 z-[5000] bg-[#09090b] overflow-y-auto text-zinc-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        
        {/* --- HEADER --- */}
        <div className="flex items-start justify-between">
          <div>
            <button 
              onClick={() => router.push('/')}
              className="flex items-center gap-2 text-amber-500 hover:text-amber-400 text-sm font-bold tracking-widest uppercase mb-4 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              Back to Map
            </button>
            <p className="text-zinc-400 text-sm font-medium mb-1">{buildingName} / Lecture Hall</p>
            <h1 className="text-4xl font-extrabold text-white mb-2">{roomName}</h1>
            <div className="flex flex-wrap gap-4 text-sm font-mono text-zinc-400">
              <span>ID: PENDING</span>
              <span>Capacity: --</span>
              <span>Abbreviation: {roomName.substring(0, 4).toUpperCase()}</span>
            </div>
          </div>
          <button className="bg-zinc-800 hover:bg-zinc-700 text-white px-6 py-2.5 rounded-lg font-semibold transition-colors border border-zinc-700">
            Make a Booking
          </button>
        </div>

        {/* --- HERO IMAGE --- */}
        <div className="w-full h-64 md:h-80 bg-zinc-800 rounded-xl overflow-hidden border border-zinc-800 relative">
          <div className="absolute inset-0 bg-zinc-900/50 flex items-center justify-center text-zinc-500">
            [Room Image Placeholder]
          </div>
        </div>

        {/* --- TIMETABLE GRID (SKELETON) --- */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Room Bookings</h2>
            <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-700 rounded-lg p-1">
              <button className="px-3 py-1 text-sm bg-zinc-700 text-white rounded">Week</button>
              <button className="px-3 py-1 text-sm text-zinc-400 hover:text-white transition-colors">Day</button>
            </div>
          </div>

          <div className="bg-[#18181b] border border-zinc-800 rounded-xl overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Grid Header */}
              <div className="grid grid-cols-8 border-b border-zinc-800">
                <div className="p-3 border-r border-zinc-800"></div>
                {days.map((day, i) => (
                  <div key={day} className="p-3 text-center border-r border-zinc-800 last:border-0 text-sm font-semibold text-zinc-300">
                    {day}
                  </div>
                ))}
              </div>
              
              {/* Grid Body */}
              <div className="grid grid-cols-8">
                {/* Time Column */}
                <div className="border-r border-zinc-800 flex flex-col">
                  {hours.map(hour => (
                    <div key={hour} className="h-16 border-b border-zinc-800 flex items-start justify-end p-2 text-xs font-mono text-zinc-500">
                      {hour}
                    </div>
                  ))}
                </div>
                
                {/* Days Columns (Empty for now) */}
                {days.map(day => (
                  <div key={`col-${day}`} className="border-r border-zinc-800 last:border-0 flex flex-col relative">
                    {hours.map(hour => (
                      <div key={`cell-${day}-${hour}`} className="h-16 border-b border-zinc-800/50" />
                    ))}
                    {/* Placeholder for future TT blocks */}
                    <div className="absolute top-1/4 left-1 right-1 h-32 bg-amber-600/20 border border-amber-600/50 rounded flex items-center justify-center text-amber-500/50 text-xs text-center p-2 backdrop-blur-sm">
                      Future TT Block
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* --- ROOM UTILITIES --- */}
        <section>
          <h2 className="text-2xl font-bold mb-4">Room Utilities</h2>
          <UtilityAccordion title="Floor Type" badgeCount={1} />
          <UtilityAccordion title="Seating" badgeCount={1} />
          <UtilityAccordion title="Audio Equipment" badgeCount={10} />
          <UtilityAccordion title="Accessibility Features" badgeCount={4} />
          <UtilityAccordion title="Visual & Display" badgeCount={1} />
        </section>

        {/* --- ROOM RATINGS --- */}
        <section className="mb-20">
          <h2 className="text-2xl font-bold mb-6">Room Ratings</h2>
          <div className="flex flex-wrap items-center gap-12">
            <div className="text-center">
              <span className="text-6xl font-light">0</span>
              <div className="flex items-center gap-1 mt-2 text-zinc-600">
                ★★★★★
              </div>
            </div>
            
            <div className="flex gap-6">
              {[
                { label: 'Cleanliness', score: '0.0' },
                { label: 'Location', score: '0.0' },
                { label: 'Quietness', score: '0.0' }
              ].map(stat => (
                <div key={stat.label} className="flex flex-col items-center gap-2">
                  <span className="text-sm font-semibold text-zinc-400">{stat.label}</span>
                  <div className="w-20 h-20 rounded-full border-4 border-zinc-800 flex items-center justify-center text-xl font-bold">
                    {stat.score}
                  </div>
                </div>
              ))}
            </div>

            <div className="ml-auto flex flex-col gap-3">
              <span className="text-zinc-400 text-sm">Share your thoughts on this room!</span>
              <button className="px-6 py-2 border border-zinc-600 text-zinc-300 rounded hover:bg-zinc-800 transition-colors uppercase text-xs font-bold tracking-wider">
                Leave a Rating
              </button>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}