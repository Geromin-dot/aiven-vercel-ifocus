import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "../../../../lib/prisma";
import bcrypt from "bcryptjs";

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
        token.sub = user.id;
        token.name = user.name || user.username;
        token.username = user.username;
        token.picture = user.image;
        token.email = user.email;
        token.role = user.role || "STUDENT";
        token.status = user.status || "ACTIVE";
        token.statusReason = user.statusReason || null;
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
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub;
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

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
