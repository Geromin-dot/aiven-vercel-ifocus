import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "../../../../lib/prisma";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { deletedAccountDigest } from "@/lib/deletedAccount";

async function wasDeleted(identifier) {
  return Boolean(await prisma.deletedLoginIdentifier.findUnique({
    where: { digest: deletedAccountDigest(identifier) },
  }));
}

async function isGoogleRegistration() {
  const store = await cookies();
  const callback = store.get('__Secure-next-auth.callback-url')?.value || store.get('next-auth.callback-url')?.value;
  if (!callback) return false;
  const target = URL.parse(callback, 'http://localhost');
  return target?.pathname === '/dashboard' && target.searchParams.get('register') === 'google';
}

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
          },
          // Study history and synchronized telemetry are large and not needed to sign in.
          select: {
            id: true, name: true, username: true, email: true, image: true,
            password: true, role: true, status: true, statusReason: true, verificationStatus: true,
          }
        });

        if (!user && await wasDeleted(cleanIdentifier)) {
          throw new Error("ACCOUNT_DELETED");
        }
        if (!user?.password) {
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
        if (!dbUser && await wasDeleted(user.email) && !await isGoogleRegistration()) {
          return '/login?error=ACCOUNT_DELETED';
        }
      }
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        delete token.error;
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
        token.verificationStatus = user.verificationStatus ?? 'PENDING';

        // Each device keeps its own signed login identity. A new login does not
        // replace another device or require a write to the shared user record.
        return token;
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

      // Keep account existence and restrictions current without enforcing one device.
      if (token?.error === 'CONCURRENT_LOGIN') delete token.error;
      if (token?.sub) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.sub },
            select: { id: true, status: true, statusReason: true, role: true, verificationStatus: true }
          });
          if (!dbUser) {
            // User account was permanently purged by Admin! Invalidate JWT token immediately.
            return { error: 'ACCOUNT_DELETED' };
          }

          // Legacy tokens receive their own identity, never another device's ID.
          if (!token.sessionId) token.sessionId = randomUUID();

          token.status = dbUser.status;
          token.statusReason = dbUser.statusReason;
          token.role = dbUser.role;
          token.verificationStatus = dbUser.verificationStatus ?? 'PENDING';
          // A previously observed conflict must not stick after live verification succeeds.
          delete token.error;
        } catch (e) {
          // Keep the login during a temporary outage, but require a fresh verification check for AI.
          delete token.verificationStatus;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token?.error === 'ACCOUNT_DELETED') return { expires: session.expires, error: token.error };
      if (!token || !token.sub) {
        return null;
      }
      if (token.status === 'ON_HOLD' || token.status === 'BANNED') return null;
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
        session.user.verificationStatus = token.verificationStatus ?? null;
      }
      return session;
    },
  },
};

// Cancel only notification jobs belonging to this device login.
authOptions.events = {
  async signOut({ token }) {
    if (token?.sub && token?.sessionId) {
      await prisma.presencePushJob.updateMany({ where: { authSessionId: token.sessionId, subscription: { userId: token.sub } }, data: { status: 'CANCELLED' } });
    }
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
