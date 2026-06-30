"use client";

import { useState, useEffect } from 'react';

export default function LiveStudentLogs() {
  const [studentLogs, setStudentLogs] = useState<any[]>([]);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await fetch('/api/suggestions');
        const data = await res.json();
        
        if (Array.isArray(data)) {
          setStudentLogs(data);
        } else if (data && Array.isArray(data.data)) {
          setStudentLogs(data.data);
        } else {
          setStudentLogs([]);
        }
      } catch (error) {
        console.error("❌ Failed to load logs", error);
        setStudentLogs([]);
      }
    };
    
    fetchLogs();
    const interval = setInterval(fetchLogs, 10000);
    return () => clearInterval(interval);
  }, []);

  const safeLogs = Array.isArray(studentLogs) ? studentLogs : [];

  return (
    <section className="bg-gray-800 border border-gray-700/50 rounded-xl overflow-hidden shadow-md h-fit max-h-[400px] flex flex-col">
      <div className="px-5 py-4 bg-gray-800/50 border-b border-gray-700 flex justify-between items-center">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="text-amber-500">🕵️</span> Student Reports
        </h2>
        <span className="text-[10px] text-gray-400 font-mono tracking-wider">SHADOW FILTER</span>
      </div>
      
      <div className="p-5 overflow-y-auto space-y-4 divide-y divide-gray-700/40">
        {safeLogs.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No student reports yet.</p>
        ) : (
          safeLogs.map((log: any) => (
            <div key={log.id} className="pt-3 first:pt-0 text-xs">
              {/* Updated Header with Name Rendering */}
              <div className="flex justify-between items-start gap-2 mb-2">
                <div>
                  <span className="font-semibold text-gray-200 truncate max-w-[150px] block">
                    {log.roomName?.replace('Block 5 - ', 'Room ') || 'Unknown Room'}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    By: <span className="text-gray-300 font-medium">{log.userName || "Anonymous Student"}</span>
                  </span>
                </div>
                <span className="text-[10px] text-gray-500 shrink-0 font-mono mt-0.5">
                  {log.timestamp ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
              </div>
              
              <div className="mb-2 text-gray-400">
                Suggested: <span className={`font-bold ${log.reportedStatus === 'AVAILABLE' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {log.reportedStatus === 'AVAILABLE' ? '🟢 FREE' : '🔴 OCCUPIED'}
                </span>
              </div>

              <div className={`p-1.5 rounded text-[10px] font-mono flex justify-between items-center ${
                log.isValidated ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}>
                <span>
                  {log.isValidated ? '✅ ACCEPTED' : '🚫 REJECTED'}
                </span>
                <span>
                  {log.distanceMeters > 9000 ? 'No GPS' : `${log.distanceMeters}m away`}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}