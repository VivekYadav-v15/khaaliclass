"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    // This tells the Next.js router to quietly fetch fresh Server Component data every 15 seconds
    const interval = setInterval(() => {
      router.refresh();
    }, 15000);

    return () => clearInterval(interval);
  }, [router]);

  return null; // This component is completely invisible! It just works in the shadows.
}