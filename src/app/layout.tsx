import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider"; // 1. Import the provider

const inter = Inter({ subsets: ["latin"] });

// 🚀 UPGRADED SEO METADATA
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* 2. Wrap the children inside AuthProvider */}
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}