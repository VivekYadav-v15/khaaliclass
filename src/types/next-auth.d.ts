import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "STUDENT" | "CR" | "ADMIN";
      crRequested: boolean;
      trustScore: number;
    } & DefaultSession["user"];
  }

  interface User {
    role: "STUDENT" | "CR" | "ADMIN";
    crRequested: boolean;
    trustScore: number;
  }
}