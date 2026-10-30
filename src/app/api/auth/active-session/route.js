import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      if (session?.error === 'CONCURRENT_LOGIN') {
        return NextResponse.json({
          active: false,
          conflict: true,
          reason: 'CONCURRENT_LOGIN'
        }, { status: 401 });
      }
      return NextResponse.json({ active: false }, { status: 200 });
    }

    if (session.error === 'CONCURRENT_LOGIN') {
      return NextResponse.json({
        active: false,
        conflict: true,
        reason: 'CONCURRENT_LOGIN'
      }, { status: 401 });
    }

    // Direct database validation to immediately catch new logins on other devices
    if (session.user.id) {
      const dbUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, currentSessionId: true, status: true, statusReason: true }
      });

      if (!dbUser) {
        return NextResponse.json({ active: false, purged: true }, { status: 401 });
      }

      if (dbUser.status === "ON_HOLD" || dbUser.status === "BANNED") {
        return NextResponse.json({
          active: false,
          onHold: true,
          reason: dbUser.statusReason || "Academic Integrity Review"
        }, { status: 403 });
      }

      if (session.user.sessionId && dbUser.currentSessionId && session.user.sessionId !== dbUser.currentSessionId) {
        return NextResponse.json({
          active: false,
          conflict: true,
          reason: 'CONCURRENT_LOGIN'
        }, { status: 401 });
      }
    }

    return NextResponse.json({
      active: true,
      sessionId: session.user.sessionId || null,
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: session.user.role
      }
    });
  } catch (err) {
    console.error("Active session check error:", err);
    return NextResponse.json({ active: true, error: "Transient failure" }, { status: 200 });
  }
}

