import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../[...nextauth]/route";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ active: false }, { status: 200 });
    }

    // getServerSession already runs the JWT callback, which verifies the user,
      // status against PostgreSQL. Avoid a second lookup here.
    if (session.user.status === "ON_HOLD" || session.user.status === "BANNED") {
      return NextResponse.json({
        active: false,
        onHold: true,
        reason: session.user.statusReason || "Academic Integrity Review"
      }, { status: 403 });
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

