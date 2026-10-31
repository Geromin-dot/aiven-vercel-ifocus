import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "../../../../lib/prisma";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    CredentialsProvider({
      name: "Email and Password",
      credentials: {
        email: { label: "Email or Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid credentials");
        }

        const cleanIdentifier = credentials.email.trim();
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: { equals: cleanIdentifier, mode: "insensitive" } },
              { username: { equals: cleanIdentifier, mode: "insensitive" } },
              { name: cleanIdentifier }
            ]
          }
        });

        if (!user || !user.password) {
          throw new Error("Invalid credentials");
        }

        const isCorrectPassword = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isCorrectPassword) {
          throw new Error("Invalid credentials");
        }

        // Academic Integrity / On-Hold or Ban check by Dean
        if (user.status === "ON_HOLD" || user.status === "BANNED") {
          const reason = user.statusReason || "Academic Integrity Review - In-person clearance with College Dean required";
          throw new Error(`ACCOUNT_ON_HOLD:${reason}`);
        }

        console.log(`[AUTH EVENT] User logged in successfully: ${user.username || user.name} (${user.email}) - Role: ${user.role || 'STUDENT'} - Status: ${user.status || 'ACTIVE'}`);

        return user;
      }
    })
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google" && user?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email },
          select: { status: true, statusReason: true }
        });
        if (dbUser && (dbUser.status === "ON_HOLD" || dbUser.status === "BANNED")) {
          const reason = encodeURIComponent(dbUser.statusReason || "Academic Integrity Review - In-person clearance with College Dean required");
          return `/login?error=ACCOUNT_ON_HOLD&reason=${reason}`;
        }
      }
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        const newSessionId = randomUUID();
        token.sub = user.id;
        token.sessionId = newSessionId;
        token.name = user.name || user.username;
        token.username = user.username;
        token.picture = user.image;
        token.email = user.email;
        token.role = user.role || "STUDENT";
        token.status = user.status || "ACTIVE";
        token.statusReason = user.statusReason || null;

        // Record active session ID to PostgreSQL to enforce Option A (Single-device active session)
        try {
          await prisma.user.update({
            where: { id: user.id },
            data: { currentSessionId: newSessionId }
          });
          console.log(`[AUTH SESSION] New active session created for user ${user.id} (${newSessionId})`);
        } catch (err) {
          console.error("Failed saving currentSessionId to user:", err);
        }
      }
      if (trigger === "update" && session?.user) {
        if (session.user.name !== undefined) token.name = session.user.name;
        if (session.user.username !== undefined) token.username = session.user.username;
        if (session.user.image !== undefined) token.picture = session.user.image;
        if (session.user.email !== undefined) token.email = session.user.email;
        if (session.user.role !== undefined) token.role = session.user.role;
        if (session.user.status !== undefined) token.status = session.user.status;
        if (session.user.statusReason !== undefined) token.statusReason = session.user.statusReason;
      }

      // Live verification: Ensure user exists in PostgreSQL and check for concurrent login (Option A)
      if (token?.sub) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.sub },
            select: { id: true, status: true, statusReason: true, role: true, currentSessionId: true }
          });
          if (!dbUser) {
            // User account was permanently purged by Admin! Invalidate JWT token immediately.
            return null;
          }

          // If session token exists in JWT and does not match the database active session, kick out!
          if (token.sessionId && dbUser.currentSessionId && token.sessionId !== dbUser.currentSessionId) {
            console.log(`[AUTH CONCURRENT] Older session invalidated for user ${token.sub}. DB session: ${dbUser.currentSessionId}, Token session: ${token.sessionId}`);
            return {
              ...token,
              error: 'CONCURRENT_LOGIN'
            };
          }

          // Bootstrap existing sessions if token had no sessionId yet
          if (!token.sessionId) {
            if (dbUser.currentSessionId) {
              token.sessionId = dbUser.currentSessionId;
            } else {
              const newSessionId = randomUUID();
              token.sessionId = newSessionId;
              await prisma.user.update({
                where: { id: token.sub },
                data: { currentSessionId: newSessionId }
              }).catch(() => {});
            }
          }

          token.status = dbUser.status;
          token.statusReason = dbUser.statusReason;
          token.role = dbUser.role;
        } catch (e) {
          // If DB is temporarily unreachable, maintain cached token
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (!token || !token.sub) {
        return null;
      }
      if (token.error === 'CONCURRENT_LOGIN') {
        return {
          ...session,
          error: 'CONCURRENT_LOGIN'
        };
      }
      if (session.user) {
        session.user.id = token.sub;
        session.user.sessionId = token.sessionId;
        if (token.name) session.user.name = token.name;
        if (token.username) session.user.username = token.username;
        if (token.picture) session.user.image = token.picture;
        if (token.email) session.user.email = token.email;
        session.user.role = token.role || "STUDENT";
        session.user.status = token.status || "ACTIVE";
        session.user.statusReason = token.statusReason || null;
      }
      return session;
    },
  },
};

// Invalidate queued notifications for this login, without invalidating a newer login.
authOptions.events = {
  async signOut({ token }) {
    if (token?.sub && token?.sessionId) {
      await prisma.user.updateMany({ where: { id: token.sub, currentSessionId: token.sessionId }, data: { currentSessionId: null } });
    }
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
