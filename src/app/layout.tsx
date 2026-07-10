import type { Metadata } from "next";
import "./globals.css"; // (or whatever your css imports are)

// 1. Your named export for metadata
export const metadata: Metadata = {
  title: "KhaaliClass | Real-Time Campus Timetables & Empty Rooms",
  description: "Find empty classrooms, navigate the campus map, and track real-time schedules for NSUT Delhi. Built by students, for students.",
  keywords: ["NSUT", "Netaji Subhas University of Technology", "empty classrooms", "campus map", "KhaaliClass", "college timetable"],
  openGraph: {
    title: "KhaaliClass",
    description: "The ultimate real-time campus navigator and schedule tracker.",
    url: "https://khaaliclass.vercel.app",
    siteName: "KhaaliClass",
    type: "website",
  },
  verification: {
    google: "7B8D6jV02nJTGvqZYpNeZbrmHQb-cdJWfLp-JKC6rdQ",
  },
};

// 2. Your DEFAULT export for the actual layout component
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}