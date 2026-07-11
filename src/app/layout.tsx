import type { Metadata } from "next";
import Providers from "./Providers"; // Adjust the path if you put it in a components folder!
import "./globals.css"; // Assuming you have your CSS imported here

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}