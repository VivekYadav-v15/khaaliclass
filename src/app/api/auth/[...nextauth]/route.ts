import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma"; 

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any, 
  
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  
  session: {
    strategy: "jwt", // We use JWTs for fast edge compatibility
  },
  
  pages: {
    error: '/access-denied', // The polite kick-out page
  },

  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        const email = user.email || "";
        
        // The Domain Lock: Only allow NSUT emails
        if (email.endsWith("@nsut.ac.in")) {
          return true; 
        } else {
          return "/access-denied"; 
        }
      }
      return false;
    },
    
    async jwt({ token, user }) {
      // Step 1: Pass the user role from the database into the secure token
      if (user) {
        // Hardcode your master admin access
        if (user.email === 'vivek.yadav.ug24@nsut.ac.in') {
          token.role = 'ADMIN';
        } else {
          // Default everyone else to whatever is in the DB
          token.role = (user as any).role || 'STUDENT'; 
        }
      }
      return token;
    },

    async session({ session, token }) {
      // Step 2: Pass the role from the token into the active session for the frontend UI
      if (session.user) {
        (session.user as any).role = token.role;
      }
      return session;
    }
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };