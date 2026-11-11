import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import bcrypt from 'bcryptjs';
import { authOptions } from '../[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { ENROLLMENT_YEAR_LEVELS, updatedYearSection } from '@/lib/studentYearLevels';

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.error) {
    return NextResponse.json({ error: 'Sign in with Google to complete your account.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const username = typeof body?.username === 'string' ? body.username.trim().toLowerCase() : '';
  const { password, yearLevel } = body ?? {};

  if (!name || name.length > 120) {
    return NextResponse.json({ error: 'Enter your full name using up to 120 characters.' }, { status: 400 });
  }
  if (!ENROLLMENT_YEAR_LEVELS.includes(yearLevel)) {
    return NextResponse.json({ error: 'Select your year level.' }, { status: 400 });
  }
  if (!/^[a-z0-9_.-]{3,30}$/.test(username) || username.includes('admin')) {
    return NextResponse.json({ error: 'Choose a username with 3–30 letters, numbers, periods, underscores, or hyphens. Usernames containing “admin” are reserved.' }, { status: 400 });
  }
  if (typeof password !== 'string' || password.length < 6 || Buffer.byteLength(password, 'utf8') > 72) {
    return NextResponse.json({ error: 'Choose a password with at least 6 characters and no more than 72 bytes.' }, { status: 400 });
  }

  const eligibleAccount = {
    id: session.user.id,
    role: 'STUDENT',
    status: 'ACTIVE',
    password: null,
    accounts: { some: { provider: 'google' } },
  };
  const ineligible = () => NextResponse.json({ error: 'This account is no longer eligible for setup. Refresh to continue.' }, { status: 409 });
  const usernameTaken = () => NextResponse.json({ error: 'This username is already taken.' }, { status: 409 });
  try {
    const user = await prisma.user.findFirst({ where: eligibleAccount, select: { section: true, yearSection: true } });
    if (!user) return ineligible();

    const existing = await prisma.user.findFirst({
      where: { id: { not: session.user.id }, username: { equals: username, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existing) return usernameTaken();

    const hash = await bcrypt.hash(password, 10);
    const updated = await prisma.user.updateMany({
      where: eligibleAccount,
      data: { name, username, password: hash, yearLevel, yearSection: updatedYearSection(user, yearLevel) },
    });
    if (updated.count === 0) return ineligible();
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error.code === 'P2002') return usernameTaken();
    console.error('Account setup failed:', error);
    return NextResponse.json({ error: 'Could not save your account. Please try again.' }, { status: 500 });
  }
}
