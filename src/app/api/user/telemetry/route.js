import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        telemetryState: true,
        timerPreferences: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let parsedTelemetry = null;
    let parsedTimerPrefs = null;

    if (user.telemetryState) {
      try {
        parsedTelemetry = JSON.parse(user.telemetryState);
      } catch (e) {}
    }

    if (user.timerPreferences) {
      try {
        parsedTimerPrefs = JSON.parse(user.timerPreferences);
      } catch (e) {}
    }

    return NextResponse.json({
      success: true,
      telemetryState: parsedTelemetry,
      timerPreferences: parsedTimerPrefs,
    });
  } catch (error) {
    console.error("GET /api/user/telemetry error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const updateData = {};

    if (body.telemetryState !== undefined) {
      updateData.telemetryState = typeof body.telemetryState === 'string'
        ? body.telemetryState
        : JSON.stringify(body.telemetryState);
    }

    if (body.timerPreferences !== undefined) {
      updateData.timerPreferences = typeof body.timerPreferences === 'string'
        ? body.timerPreferences
        : JSON.stringify(body.timerPreferences);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields provided to update" }, { status: 400 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: {
        id: true,
        telemetryState: true,
        timerPreferences: true,
      },
    });

    return NextResponse.json({
      success: true,
      updated: true,
    });
  } catch (error) {
    console.error("POST /api/user/telemetry error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
