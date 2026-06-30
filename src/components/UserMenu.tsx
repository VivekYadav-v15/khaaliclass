"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation"; // <-- Add this!

export default function UserMenu() {
  const { data: session, status } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter(); // <-- 1. Initialize the router here

  // ... (Keep your useEffect and loading/logged out states exactly the same)

  // Down in the LOGGED IN return block, update the Admin button:

  // Close the dropdown if you click outside of it
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Show a loading skeleton circle while NextAuth checks the session
  if (status === "loading") {
    return <div className="w-10 h-10 bg-zinc-200 dark:bg-zinc-800 rounded-full animate-pulse shadow-md"></div>;
  }

  // LOGGED OUT: Show a circular user icon button
  if (!session) {
    return (
      <button
        onClick={() => signIn("google")}
        className="w-10 h-10 bg-white rounded-full shadow-md flex items-center justify-center hover:bg-zinc-50 transition-colors text-zinc-600"
        title="Log in with NSUT ID"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      </button>
    );
  }

  // LOGGED IN: Show Google Profile Picture and Dropdown
  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 rounded-full shadow-md overflow-hidden border-2 border-white focus:outline-none hover:ring-2 hover:ring-emerald-500 transition-all"
      >
        <img 
          src={session.user?.image || "https://ui-avatars.com/api/?name=User"} 
          alt="Profile" 
          className="w-full h-full object-cover" 
        />
      </button>

      {/* The Dropdown Menu */}
            {/* The Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-56 bg-white rounded-xl shadow-lg border border-zinc-100 overflow-hidden z-50 text-left">
          
          {/* User Info & Badge Section */}
          <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-100">
            <p className="text-sm font-semibold text-zinc-800 truncate">{session.user?.name}</p>
            <p className="text-xs text-zinc-500 truncate mt-0.5">{session.user?.email}</p>
            
            <div className="mt-2">
              <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wide
                ${(session.user as any)?.role === 'ADMIN' ? 'bg-red-100 text-red-600' : 
                  (session.user as any)?.role === 'CR' ? 'bg-blue-100 text-blue-600' : 
                  'bg-emerald-100 text-emerald-600'}`}>
                {(session.user as any)?.role || 'STUDENT'}
              </span>
            </div>
          </div>
          
          {/* Action Buttons Section */}
          <div className="p-2 flex flex-col gap-1">
            
            {/* Admin-only tools automatically reveal themselves! */}
            {(session.user as any)?.role === 'ADMIN' && (
              <Link 
                href="/admin"
                onClick={() => setIsOpen(false)} 
                className="w-full bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 font-medium py-1.5 px-3 rounded-lg text-xs transition-all block text-center"
              >
                Admin Control Panel
              </Link>
            )}

            <button
              onClick={() => signOut()}
              className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2 mt-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}