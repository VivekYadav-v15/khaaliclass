// "use client";

// import { useSession } from "next-auth/react";
// import { useState } from "react";

// export default function AdminPanel() {
//   const { data: session, status, update } = useSession();
//   const [message, setMessage] = useState("");

//   //  DEBUGGING: This will print your session to the browser console so we can see your exact role
//   console.log("Current Session Data:", session);

//   const handleAdminAction = async () => {
//     setMessage("Processing...");

//     const res = await fetch("/api/admin-action", {
//       method: "POST",
//     });

//     const data = await res.json();

//     if (res.status === 403 && data.roleChanged) {
//       setMessage("Permissions changed. Refreshing...");
//       await update({ role: "STUDENT" }); 
//       return; 
//     }

//     if (res.ok) {
//       setMessage("Success! VIP Action done.");
//     } else {
//       setMessage(data.error || "Something went wrong");
//     }
//   };

//   // 1. Wait for NextAuth to fetch the session
//   if (status === "loading") {
//     return <div className="bg-zinc-800 text-white p-4 rounded-md shadow-lg">Checking permissions...</div>;
//   }

//   // 2. The Kick-Out UI (Now with white text and a dark background so you can actually see it!)
//   if (session?.user?.role !== "CR" && session?.user?.role!=="ADMIN") {
//     return (
//       <div className="bg-zinc-800 text-white p-4 rounded-md shadow-lg border border-red-500/50">
//         <p className="text-sm font-semibold text-red-400">Access Denied</p>
//         <p className="text-xs text-zinc-400 mt-1">Your current role: {session?.user?.role || "NONE"}</p>
//       </div>
//     );
//   }

//   // 3. The VIP UI
//   return (
//     <div className="bg-zinc-800 text-white p-4 rounded-md shadow-lg border border-zinc-600">
//       <h2 className="font-bold text-lg mb-2">CR Control Panel</h2>
//       <button 
//         onClick={handleAdminAction} 
//         className="bg-blue-600 hover:bg-blue-500 transition-colors py-2 px-4 rounded text-sm font-semibold"
//       >
//         Perform VIP Action
//       </button>
//       {message && <p className="mt-2 text-sm text-yellow-400">{message}</p>}
//     </div>
//   );
// }