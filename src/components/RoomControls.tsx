"use client";

import { useState, useEffect } from "react";

export default function RoomControls({ roomId }: { roomId: string }) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedCohort, setSelectedCohort] = useState("CSE (3rd Year) - Sec 1");
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Sync dark mode from local storage to match your map
  useEffect(() => {
    const savedTheme = localStorage.getItem('khaaliclass-theme');
    if (savedTheme !== null) {
      setIsDarkMode(savedTheme === 'dark');
    }
  }, []);

  const availableCohorts = [
    "CSE (3rd Year) - Sec 1",
    "CSE (3rd Year) - Sec 2",
    "MAC (3rd Year) - Sec 1",
    "ECE (2nd Year) - Sec 3",
    "IT (1st Year) - Sec 2"
  ];

    const handleShareTimetable = () => {
    // Updated to use the correct Vercel deployment URL
    const message = `📚 Check out the ${selectedCohort} weekly timetable for Room ${roomId} on KhaaliClass! \n\nSee full schedule: https://khaaliclass.vercel.app/room/${roomId}`;
    
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };
  
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 relative">
      {/* CUSTOM DROPDOWN BUTTON */}
      <div className="relative w-full sm:w-72">
        <button 
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-bold transition-all ${
            isDarkMode 
              ? 'bg-zinc-900 border-zinc-700 text-white hover:border-zinc-500' 
              : 'bg-white border-zinc-300 text-zinc-900 hover:border-zinc-400'
          }`}
        >
            <div className="flex items-center gap-2">
            <span>🎓</span>
            <span className="text-zinc-500 font-medium mr-1">Branch:</span> 
            <span>{selectedCohort}</span>
          </div>
          <svg className={`w-4 h-4 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
        </button>

        {/* SCROLLABLE DROPDOWN MENU */}
        {isDropdownOpen && (
          <div className={`absolute top-full left-0 mt-2 w-full max-h-48 overflow-y-auto rounded-xl border shadow-2xl z-[5000] ${
            isDarkMode ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-zinc-200'
          }`}>
            {availableCohorts.map((cohort) => (
              <button
                key={cohort}
                onClick={() => {
                  setSelectedCohort(cohort);
                  setIsDropdownOpen(false);
                }}
                className={`w-full text-left px-4 py-3 text-sm font-semibold transition-colors ${
                  selectedCohort === cohort 
                    ? isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600'
                    : isDarkMode ? 'text-zinc-300 hover:bg-zinc-800' : 'text-zinc-700 hover:bg-zinc-100'
                }`}
              >
                {cohort}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* WHATSAPP SHARE BUTTON */}
      <button 
        onClick={handleShareTimetable}
        className="w-full sm:w-auto bg-[#25D366] hover:bg-[#20bd5a] text-white px-5 py-3 rounded-xl font-bold shadow-lg shadow-green-500/20 transition-all flex items-center justify-center gap-2 flex-shrink-0"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
        Share Schedule
      </button>
    </div>
  );
}