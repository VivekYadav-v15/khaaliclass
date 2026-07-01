import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma"; 
import { revalidatePath } from "next/cache";
import Link from "next/link";
import LiveStudentLogs from "./LiveStudentLogs";

// Server Action to update roles or handle CR requests
async function manageUserRole(formData: FormData) {
  "use server";
  const userId = formData.get("userId") as string;
  const action = formData.get("action") as string;
  const adminSession = await getServerSession(authOptions);

  if (!adminSession || (adminSession.user as any)?.role !== "ADMIN") {
    throw new Error("Unauthorized access.");
  }

  const currentAdmin = await prisma.user.findUnique({
    where: { email: adminSession.user?.email! },
  });

  // 1. FIRST, grab the target user's details so we know their actual name!
  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true }
  });
  
  const targetName = targetUser?.name || "Anonymous User";

  // 2. NOW we run the transactions using their real name in the details
  if (action === "APPROVE_CR") {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { role: "CR", crRequested: false },
      }),
      prisma.auditLog.create({
        data: {
          userId: currentAdmin!.id,
          action: "CR_APPROVED",
          details: `Approved ${targetName} to CR status`,
        },
      }),
    ]);
  } else if (action === "REJECT_CR") {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { crRequested: false },
      }),
      prisma.auditLog.create({
        data: {
          userId: currentAdmin!.id,
          action: "CR_REJECTED",
          details: `Rejected CR request for ${targetName}`,
        },
      }),
    ]);
    } else if (action === "DEMOTE_CR") {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { role: "STUDENT", crRequested: false }, // ✅ Wipes out ghost requests instantly!
      }),
      prisma.auditLog.create({
        data: {
          userId: currentAdmin!.id,
          action: "CR_DEMOTED",
          details: `Demoted ${targetName} back to STUDENT`,
        },
      }),
    ]);
  }
  
  revalidatePath("/admin");
}

export default async function AdminDashboard() {
  const session = await getServerSession(authOptions);

  if (!session || (session.user as any)?.role !== "ADMIN") {
    redirect("/");
  }

  const allUsers = await prisma.user.findMany({
    orderBy: { name: "asc" },
  });

  const auditLogs = await prisma.auditLog.findMany({
    include: { user: true },
    orderBy: { timestamp: "desc" },
    take: 20, 
  });

  const pendingCRs = allUsers.filter((u) => u.crRequested && u.role === "STUDENT");
  const activeCRs = allUsers.filter((u) => u.role === "CR");

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 md:p-10 font-sans relative pb-20">
      
      {/* Floating Back Button (Bottom Left) */}
      <Link 
        href="/"
        className="fixed bottom-6 left-6 z-50 flex items-center gap-2 px-4 py-2.5 bg-gray-800 border border-gray-700 hover:bg-gray-700 hover:border-gray-600 text-gray-200 rounded-xl shadow-2xl transition-all"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
        <span className="font-semibold text-sm">Back to Map</span>
      </Link>

      <header className="mb-8 border-b border-gray-800 pb-5">
        <h1 className="text-3xl font-bold tracking-tight text-white">KhaaliClass Admin Dashboard</h1>
        <p className="text-sm text-gray-400 mt-1">Manage role allocations, review incoming CR applications, and monitor live audit logs.</p>
      </header>

      {/* Overview Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10">
        <div className="bg-gray-800 border border-gray-700/60 rounded-xl p-5 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Signed-In Users</p>
          <p className="text-3xl font-bold text-blue-400 mt-1">{allUsers.length}</p>
        </div>
        <div className="bg-gray-800 border border-gray-700/60 rounded-xl p-5 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Active CRs Upgraded</p>
          <p className="text-3xl font-bold text-emerald-400 mt-1">{activeCRs.length}</p>
        </div>
        <div className="bg-gray-800 border border-gray-700/60 rounded-xl p-5 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Pending CR Applications</p>
          <p className="text-3xl font-bold text-amber-400 mt-1">{pendingCRs.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <div className="lg:col-span-2 space-y-8">
          
          {/* Section A: Pending CR Requests */}
          <section className="bg-gray-800 border border-gray-700/50 rounded-xl overflow-hidden shadow-md">
            <div className="px-5 py-4 bg-gray-800/50 border-b border-gray-700">
              <h2 className="text-lg font-bold text-white">Pending Class Representative Applications</h2>
            </div>
            <div className="p-5">
              {pendingCRs.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No incoming CR upgrade requests currently queueing.</p>
              ) : (
                <ul className="divide-y divide-gray-700/60">
                  {pendingCRs.map((candidate) => (
                    <li key={candidate.id} className="py-3 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-white">{candidate.name || "Anonymous User"}</p>
                        <p className="text-xs text-gray-400">{candidate.email}</p>
                      </div>
                      <form action={manageUserRole} className="flex items-center gap-2">
                        <input type="hidden" name="userId" value={candidate.id} />
                        <button 
                          type="submit" 
                          name="action" 
                          value="APPROVE_CR" 
                          className="px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
                        >
                          Accept
                        </button>
                        <button 
                          type="submit" 
                          name="action" 
                          value="REJECT_CR" 
                          className="px-3 py-1.5 text-xs font-medium bg-rose-600 hover:bg-rose-500 text-gray-100 rounded-lg transition-colors"
                        >
                          Reject
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Section B: All Registered Users Registry */}
          <section className="bg-gray-800 border border-gray-700/50 rounded-xl overflow-hidden shadow-md">
            <div className="px-5 py-4 bg-gray-800/50 border-b border-gray-700">
              <h2 className="text-lg font-bold text-white">Campus User Registry</h2>
            </div>
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
                  {allUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-700/20 transition-colors">
                      <td className="px-5 py-3">
                        <div className="font-medium text-white">{user.name || "System User"}</div>
                        <div className="text-xs text-gray-400">{user.email}</div>
                      </td>
                      <td className="px-5 py-3">
                        {/* DYNAMIC BADGES */}
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
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN: LOGS & AUDITS */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          
          {/* 1. Live CR System Audit Trail */}
          <section className="bg-gray-800 border border-gray-700/50 rounded-xl overflow-hidden shadow-md h-fit max-h-[400px] flex flex-col">
            <div className="px-5 py-4 bg-gray-800/50 border-b border-gray-700">
              <h2 className="text-lg font-bold text-white">Live CR System Audit Trail</h2>
            </div>
            <div className="p-5 overflow-y-auto space-y-4 divide-y divide-gray-700/40">
              {auditLogs.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No structural change logs recorded yet.</p>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="pt-3 first:pt-0 text-xs">
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <span className="font-semibold text-gray-200 truncate max-w-[150px]">
                        {log.user.name || "System Admin"}
                      </span>
                      <span className="text-[10px] text-gray-500 shrink-0 font-mono">
  {new Date(log.timestamp).toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata', // Forces Indian Standard Time
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })}
</span>
                    </div>
                    <div className="mb-1">
                      <span className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-mono uppercase tracking-tight ${
                        log.action.includes("APPROVED") ? "bg-emerald-500/20 text-emerald-300" : 
                        log.action.includes("DEMOTED") ? "bg-red-500/20 text-red-300" :
                        "bg-amber-500/20 text-amber-300"
                      }`}>
                        {log.action}
                      </span>
                    </div>
                    <p className="text-gray-400 font-mono leading-relaxed">{log.details}</p>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* 2. Client Widget for Student Shadow Filters */}
          <LiveStudentLogs />

        </div>
      </div>
    </div>
  );
}