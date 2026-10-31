import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { mergeResolvedSessions } from '../../../../lib/recoveryState';
import { advanceFocusClock, resolveFocusClock } from '../../../../lib/focusClock';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id || session.error) {
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
    // Internal time evidence is maintained by the server, not synchronized as UI state.
    if (parsedTelemetry) delete parsedTelemetry.focusClock;

    if (user.timerPreferences) {
      try {
        parsedTimerPrefs = JSON.parse(user.timerPreferences);
      } catch (e) {}
    }

    return NextResponse.json({
      success: true,
      userId: session.user.id,
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
    if (!session || !session.user?.id || session.error) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    if (body.telemetryState === undefined && body.timerPreferences === undefined) {
      return NextResponse.json({ error: "No fields provided to update" }, { status: 400 });
    }
    // Keep read/merge/write atomic so another device cannot overwrite a Discard.
    const applyUpdate = async (tx) => {
      const updateData = {};

      if (body.telemetryState !== undefined || body.timerPreferences !== undefined) {
        const currentUser = await tx.user.findUnique({
          where: { id: session.user.id },
          select: { telemetryState: true, timerPreferences: true }
        });

        if (body.telemetryState !== undefined) {
          let existingTelemetry = {};
          if (currentUser?.telemetryState) {
            try {
              existingTelemetry = JSON.parse(currentUser.telemetryState);
            } catch (e) {}
          }
          const incoming = typeof body.telemetryState === 'string'
            ? JSON.parse(body.telemetryState)
            : body.telemetryState;

          const merged = { ...existingTelemetry, ...incoming };
          // Ignore delayed checkpoint requests that arrive after a newer pause/reset.
          if (incoming.activeTimerState && existingTelemetry.activeTimerState &&
              Number(incoming.activeTimerState.updatedAt || 0) < Number(existingTelemetry.activeTimerState.updatedAt || 0)) {
            merged.activeTimerState = existingTelemetry.activeTimerState;
          }
          merged.resolvedTimerSessions = mergeResolvedSessions(existingTelemetry.resolvedTimerSessions, incoming.resolvedTimerSessions);
          const savedPrefs = JSON.parse(currentUser?.timerPreferences || '{}');
          merged.focusClock = advanceFocusClock(existingTelemetry.focusClock, incoming.activeTimerState,
            savedPrefs, session.user.sessionId, Date.now());
          merged.focusClock = resolveFocusClock(merged.focusClock, merged.resolvedTimerSessions);

          // Deep merge breakGateEvents array so no events are dropped between devices
          if (Array.isArray(incoming.breakGateEvents)) {
            const existingEvents = Array.isArray(existingTelemetry.breakGateEvents) ? existingTelemetry.breakGateEvents : [];
            const eventMap = new Map();
            [...existingEvents, ...incoming.breakGateEvents].forEach(evt => {
              if (!evt) return;
              const key = evt.id || evt.timestamp || evt.date || (evt.time ? String(evt.time) : null);
              if (key) eventMap.set(key, evt);
            });
            merged.breakGateEvents = Array.from(eventMap.values())
              .sort((a, b) => new Date(a.date || a.timestamp || 0).getTime() - new Date(b.date || b.timestamp || 0).getTime())
              .slice(-50);
          }

          // Deep merge journalHistory array so reflection entries are never lost between devices
          if (Array.isArray(incoming.journalHistory)) {
            const existingJournal = Array.isArray(existingTelemetry.journalHistory) ? existingTelemetry.journalHistory : [];
            const journalMap = new Map();
            [...existingJournal, ...incoming.journalHistory].forEach(entry => {
              if (!entry) return;
              const key = entry.id || entry.date || entry.timestamp || (entry.text ? entry.text.slice(0, 40) : null);
              if (key) journalMap.set(key, entry);
            });
            merged.journalHistory = Array.from(journalMap.values())
              .sort((a, b) => new Date(b.date || b.timestamp || 0).getTime() - new Date(a.date || a.timestamp || 0).getTime())
              .slice(0, 50);
          }

          // Deep merge or replace masteredCards array so flashcard mastery is synchronized across all devices
          if (Array.isArray(incoming.masteredCards)) {
            if (incoming.replaceMasteredCards === true) {
              merged.masteredCards = incoming.masteredCards;
            } else {
              const existingMastered = Array.isArray(existingTelemetry.masteredCards) ? existingTelemetry.masteredCards : [];
              merged.masteredCards = Array.from(new Set([...existingMastered, ...incoming.masteredCards]));
            }
            merged.masteredCardsUpdatedAt = incoming.masteredCardsUpdatedAt || Date.now();
          }

          // Preserve highest recoveryCompleted and cognitiveReset timestamps
          if (incoming.recoveryCompleted) {
            const ex = Number(existingTelemetry.recoveryCompleted || 0);
            const inc = Number(incoming.recoveryCompleted || 0);
            merged.recoveryCompleted = Math.max(ex, inc);
          }
          if (incoming.cognitiveReset) {
            const ex = Number(existingTelemetry.cognitiveReset || 0);
            const inc = Number(incoming.cognitiveReset || 0);
            merged.cognitiveReset = Math.max(ex, inc);
          }

          updateData.telemetryState = JSON.stringify(merged);
        }

        if (body.timerPreferences !== undefined) {
          let existingPrefs = {};
          if (currentUser?.timerPreferences) {
            try {
              existingPrefs = JSON.parse(currentUser.timerPreferences);
            } catch (e) {}
          }
          const incoming = typeof body.timerPreferences === 'string'
            ? JSON.parse(body.timerPreferences)
            : body.timerPreferences;

          const merged = { ...existingPrefs, ...incoming };
          updateData.timerPreferences = JSON.stringify(merged);
        }
      }

      await tx.user.update({
        where: { id: session.user.id },
        data: updateData,
        select: {
          id: true,
          telemetryState: true,
          timerPreferences: true,
        },
      });

    };
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await prisma.$transaction(applyUpdate, { isolationLevel: 'Serializable' });
        break;
      } catch (error) {
        if (error.code !== 'P2034' || attempt === 2) throw error;
      }
    }

    return NextResponse.json({
      success: true,
      updated: true,
    });
  } catch (error) {
    console.error("POST /api/user/telemetry error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

