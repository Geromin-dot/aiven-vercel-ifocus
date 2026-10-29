import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { prisma } from "../../../../../lib/prisma";
import bcrypt from "bcryptjs";

export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { message: "Authentication required" },
        { status: 401 }
      );
    }

    const isAdmin = session.user.role === "ADMIN" || session.user.username === "adminUAnursing";
    if (!isAdmin) {
      return NextResponse.json(
        { message: "Unauthorized: Administrator access required" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json();
    const { status, reason, name, newPassword, yearLevel, section, yearSection, verificationStatus } = body;

    const validStatuses = ["ACTIVE", "ON_HOLD", "BANNED"];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { message: "Invalid status. Must be ACTIVE, ON_HOLD, or BANNED." },
        { status: 400 }
      );
    }

    const validVerificationStatuses = ["VERIFIED", "PENDING", "REJECTED"];
    if (verificationStatus && !validVerificationStatuses.includes(verificationStatus)) {
      return NextResponse.json(
        { message: "Invalid verificationStatus. Must be VERIFIED, PENDING, or REJECTED." },
        { status: 400 }
      );
    }

    if (!status && !name && !newPassword && !yearLevel && !section && !yearSection && !verificationStatus) {
      return NextResponse.json(
        { message: "Either status, verificationStatus, name, newPassword, or academic record details are required" },
        { status: 400 }
      );
    }

    if (newPassword) {
      if (typeof newPassword !== "string" || newPassword.length < 6) {
        return NextResponse.json(
          { message: "New password must be at least 6 characters long" },
          { status: 400 }
        );
      }
    }

    // Check target user
    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, username: true, email: true, role: true }
    });

    if (!targetUser) {
      return NextResponse.json({ message: "Student user not found" }, { status: 404 });
    }

    // Prevent modifying super admin
    if (targetUser.username === "adminUAnursing" || targetUser.role === "ADMIN") {
      return NextResponse.json(
        { message: "Cannot modify credentials of system administrator accounts" },
        { status: 400 }
      );
    }

    let hashedPassword = undefined;
    if (newPassword) {
      hashedPassword = await bcrypt.hash(newPassword, 10);
    }

    let computedYearSection = yearSection;
    if (computedYearSection === undefined && (yearLevel !== undefined || section !== undefined)) {
      computedYearSection = [yearLevel, section].filter(Boolean).join(" - ");
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(verificationStatus && { verificationStatus }),
        ...(reason !== undefined && { statusReason: reason ? reason.trim() : null }),
        ...(name !== undefined && { name: name.trim() }),
        ...(yearLevel !== undefined && { yearLevel: yearLevel ? yearLevel.trim() : null }),
        ...(section !== undefined && { section: section ? section.trim() : null }),
        ...(computedYearSection !== undefined && { yearSection: computedYearSection ? computedYearSection.trim() : null }),
        ...(hashedPassword && { password: hashedPassword }),
        statusUpdatedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        status: true,
        statusReason: true,
        statusUpdatedAt: true,
        verificationStatus: true,
        yearLevel: true,
        section: true,
        yearSection: true,
      }
    });

    let successMessage = `Student account status updated to ${status}`;
    if (newPassword) {
      successMessage = "Student password successfully reset";
      console.log(`[ADMIN ACTION] Student password reset for ${updated.username} (${updated.email}) by Dean/Admin (${session.user.username})`);
    } else if (verificationStatus) {
      successMessage = `Student account marked as ${verificationStatus === "VERIFIED" ? "Valid Account (Verified)" : verificationStatus === "REJECTED" ? "Invalid / Unverified Account" : "Pending Verification"}`;
      console.log(`[ADMIN ACTION] User ${updated.username} (${updated.email}) verification set to: ${verificationStatus} by Dean/Admin (${session.user.username})`);
    } else {
      console.log(`[ADMIN ACTION] User ${updated.username} (${updated.email}) status changed to: ${status} by Dean/Admin (${session.user.username}). Reason: ${reason || 'N/A'}`);
    }

    return NextResponse.json({
      success: true,
      message: successMessage,
      user: updated
    });
  } catch (error) {
    console.error("Admin user status update error:", error);
    return NextResponse.json(
      { message: "Failed to update student account status", error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req, { params }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { message: "Authentication required" },
        { status: 401 }
      );
    }

    const isAdmin = session.user.role === "ADMIN" || session.user.username === "adminUAnursing";
    if (!isAdmin) {
      return NextResponse.json(
        { message: "Unauthorized: Administrator access required" },
        { status: 403 }
      );
    }

    const { id } = await params;

    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, username: true, role: true }
    });

    if (!targetUser) {
      return NextResponse.json({ message: "Student user not found" }, { status: 404 });
    }

    if (targetUser.username === "adminUAnursing" || targetUser.role === "ADMIN") {
      return NextResponse.json(
        { message: "Cannot delete system administrator accounts" },
        { status: 400 }
      );
    }

    // Cascade delete user and dependencies
    await prisma.$transaction([
      prisma.todo.deleteMany({ where: { userId: id } }),
      prisma.studySession.deleteMany({ where: { userId: id } }),
      prisma.card.deleteMany({ where: { deck: { userId: id } } }),
      prisma.deck.deleteMany({ where: { userId: id } }),
      prisma.account.deleteMany({ where: { userId: id } }),
      prisma.session.deleteMany({ where: { userId: id } }),
      prisma.user.delete({ where: { id } })
    ]);

    console.log(`[ADMIN ACTION] User ${targetUser.username} was permanently purged by Dean/Admin (${session.user.username})`);

    return NextResponse.json({
      success: true,
      message: "Student account and all associated data permanently deleted."
    });
  } catch (error) {
    console.error("Admin user delete error:", error);
    return NextResponse.json(
      { message: "Failed to delete student account", error: error.message },
      { status: 500 }
    );
  }
}

