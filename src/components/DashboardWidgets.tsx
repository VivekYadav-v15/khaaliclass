"use client";

import { useState } from "react";

// ==========================================
// 1. THE ACTIVE CRs DROPDOWN WIDGET
// ==========================================
export function ActiveCRsWidget({ activeCRs }: { activeCRs: any[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const sortedCRs = [...activeCRs].sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  return (
    <div className="relative bg-gray-800 border border-gray-700/60 rounded-xl p-5 shadow-sm flex flex-col justify-between">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Active CRs Upgraded</p>
          <p className="text-3xl font-bold text-emerald-400 mt-1">{activeCRs.length}</p>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 bg-gray-700/50 hover:bg-gray-600 rounded-lg transition-colors text-gray-400 hover:text-white"
        >
          <svg className={`w-5 h-5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
        </button>
      </div>

      {isOpen && (
        <div className="absolute top-[105%] left-0 w-full max-h-64 overflow-y-auto rounded-xl border border-gray-700 bg-gray-800 shadow-2xl z-50 p-2">
          {sortedCRs.length > 0 ? sortedCRs.map(cr => (
            <div key={cr.id} className="p-3 border-b border-gray-700/50 last:border-0 hover:bg-gray-700/50 rounded-lg transition-colors">
              <p className="text-sm font-bold text-gray-100">{cr.name || "Anonymous"}</p>
              <p className="text-xs text-gray-400">{cr.email}</p>
            </div>
          )) : (
            <p className="p-3 text-sm text-gray-500 text-center">No active CRs found.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ==========================================
// 2. THE CAMPUS REGISTRY SEARCH TABLE
// ==========================================
export function UserRegistryClient({ allUsers, manageUserRole }: { allUsers: any[], manageUserRole: (formData: FormData) => void }) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredUsers = allUsers.filter(u =>
    (u.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.email || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <section className="bg-gray-800 border border-gray-700/50 rounded-xl overflow-hidden shadow-md mt-8">
      {/* Search Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-5 py-4 bg-gray-800/50 border-b border-gray-700 gap-4">
        <h2 className="text-lg font-bold text-white">Campus User Registry</h2>
        <div className="relative w-full sm:w-72">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          </div>
          <input 
            type="text" 
            placeholder="Search by name or email..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 text-white text-sm rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
          />
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-700 text-xs text-gray-400 uppercase tracking-wider bg-gray-800/30">
              <th className="px-5 py-3 font-semibold">Name / Email</th>
              <th className="px-5 py-3 font-semibold">Assigned Badge</th>
              <th className="px-5 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/60 text-sm">
            {filteredUsers.length > 0 ? filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-gray-700/20 transition-colors">
                <td className="px-5 py-3">
                  <div className="font-medium text-white">{user.name || "System User"}</div>
                  <div className="text-xs text-gray-400">{user.email}</div>
                </td>
                <td className="px-5 py-3">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold tracking-wide border uppercase ${
                    user.role === "ADMIN" ? "bg-purple-500/10 text-purple-400 border-purple-500/20" :
                    user.role === "CR" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                    "bg-blue-500/10 text-blue-400 border-blue-500/20"
                  }`}>
                    {user.role || 'STUDENT'}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  {user.role === "CR" && (
                    <form action={manageUserRole}>
                      <input type="hidden" name="userId" value={user.id} />
                      <button 
                        type="submit" 
                        name="action" 
                        value="DEMOTE_CR" 
                        className="px-3 py-1.5 text-xs font-medium bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg transition-colors"
                      >
                        Demote
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={3} className="px-5 py-8 text-center text-gray-500 italic">
                  No users found matching "{searchQuery}"
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}