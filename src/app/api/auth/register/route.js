import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req) {
  try {
    const { name, username, email, password, yearLevel, section, yearSection } = await req.json();

    if (!email || !password || !username) {
      return NextResponse.json(
        { message: "Username, email, and password are required" },
        { status: 400 }
      );
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanUsername = username.trim();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return NextResponse.json(
        { message: "Please enter a valid email format (e.g. student@ua.edu.ph or yourname@gmail.com)" },
        { status: 400 }
      );
    }

    // Password length validation
    if (password.length < 6) {
      return NextResponse.json(
        { message: "Password must be at least 6 characters long" },
        { status: 400 }
      );
    }

    // Reserved administrative usernames
    if (cleanUsername.toLowerCase().includes("admin")) {
      return NextResponse.json(
        { message: "This username is reserved for system administrators" },
        { status: 400 }
      );
    }

    // Check if user or username already exists
    const existingEmail = await prisma.user.findFirst({
      where: { email: { equals: cleanEmail, mode: "insensitive" } },
    });

    if (existingEmail) {
      return NextResponse.json(
        { message: "User with this email already exists" },
        { status: 409 }
      );
    }

    const existingUsername = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUsername) {
      return NextResponse.json(
        { message: "This username is already taken" },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const cleanYearLevel = yearLevel ? yearLevel.trim() : null;
    const cleanSection = section ? section.trim() : null;
    let cleanYearSection = yearSection ? yearSection.trim() : null;
    if (!cleanYearSection && (cleanYearLevel || cleanSection)) {
      cleanYearSection = [cleanYearLevel, cleanSection].filter(Boolean).join(" - ");
    }

    // Create user with default STUDENT role
    const newUser = await prisma.user.create({
      data: {
        name: name || cleanUsername,
        username: cleanUsername,
        email: cleanEmail,
        password: hashedPassword,
        role: "STUDENT",
        yearLevel: cleanYearLevel,
        section: cleanSection,
        yearSection: cleanYearSection,
      },
    });

    console.log(`[AUTH EVENT] New user registered: ${cleanUsername} (${cleanEmail}) as STUDENT`);

    // Remove password from response for security
    const { password: _, ...userWithoutPassword } = newUser;

    return NextResponse.json(
      { message: "User created successfully", user: userWithoutPassword },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { message: `An error occurred during registration: ${error.message}` },
      { status: 500 }
    );
  }
}
