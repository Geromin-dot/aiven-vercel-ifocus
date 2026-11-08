import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { STUDENT_YEAR_LEVELS, studentYearLevel, updatedYearSection } from '@/lib/studentYearLevels';

async function isAdmin() {
  const session = await getServerSession(authOptions);
  return !session?.error && (session?.user?.role === 'ADMIN' || session?.user?.username === 'adminUAnursing');
}

async function promotionPreview(db) {
  const students = await db.user.findMany({
    where: { role: 'STUDENT', username: { not: 'adminUAnursing' } },
    select: { id: true, yearLevel: true, section: true, yearSection: true },
    orderBy: { id: 'asc' },
  });
  const changes = students.flatMap(student => {
    const index = STUDENT_YEAR_LEVELS.indexOf(studentYearLevel(student));
    if (index < 0 || index >= STUDENT_YEAR_LEVELS.length - 1) return [];
    const yearLevel = STUDENT_YEAR_LEVELS[index + 1];
    return [{ id: student.id, yearLevel, yearSection: updatedYearSection(student, yearLevel) }];
  });
  return {
    changes,
    token: createHash('sha256').update(JSON.stringify(changes)).digest('hex'),
  };
}

export async function GET() {
  if (!await isAdmin()) return NextResponse.json({ message: 'Administrator access required.' }, { status: 403 });
  const { changes, token } = await promotionPreview(prisma);
  return NextResponse.json({
    token,
    count: changes.length,
    graduates: changes.filter(student => student.yearLevel === 'Graduated').length,
  });
}

export async function POST(request) {
  if (!await isAdmin()) return NextResponse.json({ message: 'Administrator access required.' }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (typeof body?.token !== 'string') return NextResponse.json({ message: 'Preview the promotion first.' }, { status: 400 });

  try {
    const count = await prisma.$transaction(async tx => {
      const { changes, token } = await promotionPreview(tx);
      if (token !== body.token || !changes.length) return null;

      // Group identical academic records so large cohorts can be updated together.
      const groups = new Map();
      for (const { id, yearLevel, yearSection } of changes) {
        const key = JSON.stringify([yearLevel, yearSection]);
        if (!groups.has(key)) groups.set(key, { ids: [], yearLevel, yearSection });
        groups.get(key).ids.push(id);
      }
      for (const { ids, yearLevel, yearSection } of groups.values()) {
        await tx.user.updateMany({ where: { id: { in: ids } }, data: { yearLevel, yearSection } });
      }
      return changes.length;
    }, { isolationLevel: 'Serializable' });

    if (count !== null) return NextResponse.json({ count });
  } catch (error) {
    if (error.code !== 'P2034') {
      console.error('Year-level promotion failed:', error);
      return NextResponse.json({ message: 'Could not promote year levels.' }, { status: 500 });
    }
  }

  return NextResponse.json({ message: 'The student list changed. Preview the promotion again.' }, { status: 409 });
}
