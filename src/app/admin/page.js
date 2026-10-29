"use client";

// High-clarity synthesized institutional audio chime
const playAdminSuccessChime = () => {
  try {
    if (typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => { });
    }
    const now = ctx.currentTime;
    const notes = [
      { freq: 587.33, offset: 0, dur: 0.25, gain: 0.055 },    // D5
      { freq: 739.99, offset: 0.07, dur: 0.30, gain: 0.065 },  // F#5
      { freq: 880.00, offset: 0.14, dur: 0.40, gain: 0.085 },  // A5
      { freq: 1174.66, offset: 0.22, dur: 0.55, gain: 0.080 }  // D6
    ];
    notes.forEach(({ freq, offset, dur, gain: peak }) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + offset);
      g.gain.setValueAtTime(0.0001, now + offset);
      g.gain.linearRampToValueAtTime(peak, now + offset + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + offset + dur);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + dur + 0.02);
    });
  } catch (e) {
    console.warn('Audio chime blocked:', e);
  }
};

import { useState, useEffect, useMemo, useRef } from "react";
import { useSession, signOut, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function AdminPortalPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const [timeScope, setTimeScope] = useState("all"); // "all" | "today"
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusModalStudent, setStatusModalStudent] = useState(null);
  const [targetStatus, setTargetStatus] = useState("ON_HOLD");
  const [statusReason, setStatusReason] = useState("Academic Integrity Review - In-person clearance with College Dean required");
  const [deleteModalStudent, setDeleteModalStudent] = useState(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState("");
  const [nameConfirmModal, setNameConfirmModal] = useState(null);
  const [accountFilter, setAccountFilter] = useState("all"); // "all" | "this_week" | "pending" | "verified"
  const [isUpdatingVerification, setIsUpdatingVerification] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortRef = useRef(null);
  const [isPresetOpen, setIsPresetOpen] = useState(false);
  const presetRef = useRef(null);
  const [passwordConfirmModal, setPasswordConfirmModal] = useState(null);
  const [resetPasswordInput, setResetPasswordInput] = useState("");
  const [showResetPasswordText, setShowResetPasswordText] = useState(false);
  const [toastPopup, setToastPopup] = useState(null);


  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.username === "adminUAnursing";

  // Strict Protection: Normal students cannot access or view Admin Portal
  useEffect(() => {
    if (status === "authenticated" && !isAdmin) {
      router.replace("/dashboard");
    }
  }, [status, isAdmin, router]);

  const handleUpdateUserStatus = async (studentId, newStatus, reason) => {
    setIsUpdatingStatus(true);
    try {
      const res = await fetch(`/api/admin/users/${studentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, reason })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to update account status");

      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          students: prev.students.map(s => s.id === studentId ? { ...s, status: newStatus, statusReason: reason, statusUpdatedAt: new Date().toISOString() } : s)
        };
      });

      setStatusModalStudent(null);
      playAdminSuccessChime();
      setToastPopup({
        title: newStatus === "ACTIVE" ? "Account Reactivated" : "Account Placed On Hold",
        message: newStatus === "ACTIVE"
          ? "Student account is now fully active with normal system access."
          : "Student account placed on hold. In-person clearance required with the Dean."
      });
      setTimeout(() => setToastPopup(null), 4500);
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleUpdateVerification = async (studentId, newVerificationStatus) => {
    setIsUpdatingVerification(true);
    try {
      const res = await fetch(`/api/admin/users/${studentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verificationStatus: newVerificationStatus })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to update verification status");

      setData(prev => {
        if (!prev || !prev.students) return prev;
        return {
          ...prev,
          students: prev.students.map(s => s.id === studentId ? { ...s, verificationStatus: newVerificationStatus } : s)
        };
      });

      setSelectedStudent(prev => {
        if (!prev || prev.id !== studentId) return prev;
        return { ...prev, verificationStatus: newVerificationStatus };
      });

      playAdminSuccessChime();
      setToastPopup({
        title: newVerificationStatus === "VERIFIED"
          ? "Account Validated"
          : newVerificationStatus === "REJECTED"
          ? "Account Marked Invalid"
          : "Verification Reset",
        message: newVerificationStatus === "VERIFIED"
          ? "Student account is now officially verified as a valid UA Nursing student."
          : newVerificationStatus === "REJECTED"
          ? "Account marked as unverified / not recognized."
          : "Student account verification reset to pending."
      });
      setTimeout(() => setToastPopup(null), 4500);
    } catch (err) {
      alert("Error updating account validation: " + err.message);
    } finally {
      setIsUpdatingVerification(false);
    }
  };

  const handleConfirmNameChange = async () => {
    if (!nameConfirmModal) return;
    const { student, newName } = nameConfirmModal;
    setIsUpdatingStatus(true);
    try {
      const res = await fetch(`/api/admin/users/${student.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to update full name");

      setSelectedStudent(prev => prev ? ({ ...prev, name: newName }) : null);
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          students: prev.students.map(s => s.id === student.id ? { ...s, name: newName } : s)
        };
      });

      playAdminSuccessChime();
      setNameConfirmModal(null);

      setToastPopup({
        title: "Academic Record Updated",
        message: `Official full name updated to "${newName}".`
      });
      setTimeout(() => setToastPopup(null), 4500);
    } catch (err) {
      alert("Error updating name: " + err.message);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleConfirmPasswordReset = async () => {
    if (!passwordConfirmModal) return;
    const { student, newPassword } = passwordConfirmModal;
    setIsUpdatingStatus(true);
    try {
      const res = await fetch(`/api/admin/users/${student.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to reset student password");

      setPasswordConfirmModal(null);
      setResetPasswordInput("");
      playAdminSuccessChime();
      setToastPopup({
        title: "Student Password Updated",
        message: `Account password for @${student.username} has been successfully reset.`
      });
      setTimeout(() => setToastPopup(null), 4500);
    } catch (err) {
      alert("Error resetting password: " + err.message);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleDeleteUser = async (studentId) => {
    setIsUpdatingStatus(true);
    try {
      const res = await fetch(`/api/admin/users/${studentId}`, {
        method: "DELETE"
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to delete student account");

      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          students: prev.students.filter(s => s.id !== studentId),
          metrics: {
            ...prev.metrics,
            totalStudents: Math.max(0, prev.metrics.totalStudents - 1)
          }
        };
      });

      setDeleteModalStudent(null);
      playAdminSuccessChime();
      setToastPopup({
        title: "Account Permanently Removed",
        message: "Student account and learning records have been deleted."
      });
      setTimeout(() => setToastPopup(null), 4500);
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const fetchAdminData = async () => {
    try {
      setIsRefreshing(true);
      setError(null);
      const res = await fetch("/api/admin/overview");
      if (!res.ok) {
        if (res.status === 403) {
          throw new Error("Access restricted: Administrator role required");
        }
        throw new Error("Failed to load administration data");
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated" && isAdmin) {
      fetchAdminData();
    } else if (status === "unauthenticated") {
      setLoading(false);
    }
  }, [status, isAdmin]);

  // Filtered and sorted students
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (sortRef.current && !sortRef.current.contains(e.target)) {
        setIsSortOpen(false);
      }
      if (presetRef.current && !presetRef.current.contains(e.target)) {
        setIsPresetOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setIsSortOpen(false);
        setIsPresetOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const sortOptions = [
    { value: "recent", label: "Sort: Most Recently Registered" },
    { value: "study_time", label: `Sort: Highest Study Time (${timeScope === "today" ? "Today" : "Total"})` },
    { value: "decks", label: "Sort: Most Decks Created" },
    { value: "name", label: "Sort: Student Name (A-Z)" },
  ];

  const presetOptions = [
    { value: "Academic Integrity Review - In-person clearance with College Dean required", label: "Academic Integrity Review - In-person clearance required" },
    { value: "Suspicious Activity / System Tampering Detected - Dean Office consultation required", label: "Suspicious Activity / System Tampering Detected" },
    { value: "Standard Evaluation Cohort Completed - Administrative debrief required", label: "Standard Evaluation Cohort Completed" },
    { value: "Administrative Consultation Required - Schedule in-person appointment", label: "Administrative Consultation Required" },
    { value: "CUSTOM", label: "Write custom note..." },
  ];

  const createdThisWeekCount = useMemo(() => {
    if (!data?.students) return 0;
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return data.students.filter((s) => new Date(s.createdAt) >= oneWeekAgo).length;
  }, [data]);

  const pendingVerificationCount = useMemo(() => {
    if (!data?.students) return 0;
    return data.students.filter((s) => s.verificationStatus === "PENDING" || !s.verificationStatus).length;
  }, [data]);

  const verifiedCount = useMemo(() => {
    if (!data?.students) return 0;
    return data.students.filter((s) => s.verificationStatus === "VERIFIED").length;
  }, [data]);

  const filteredStudents = useMemo(() => {
    if (!data?.students) return [];

    let list = [...data.students];

    // Filter by account recency / verification
    if (accountFilter === "this_week") {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      list = list.filter((s) => new Date(s.createdAt) >= oneWeekAgo);
    } else if (accountFilter === "pending") {
      list = list.filter((s) => s.verificationStatus === "PENDING" || !s.verificationStatus);
    } else if (accountFilter === "verified") {
      list = list.filter((s) => s.verificationStatus === "VERIFIED");
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (s) =>
          (s.name && s.name.toLowerCase().includes(q)) ||
          (s.username && s.username.toLowerCase().includes(q)) ||
          (s.email && s.email.toLowerCase().includes(q))
      );
    }

    if (sortBy === "recent") {
      list.sort((a, b) => {
        const isATest = a.username === "student_tester" || a.username?.includes("test");
        const isBTest = b.username === "student_tester" || b.username?.includes("test");
        if (isATest && !isBTest) return -1;
        if (!isATest && isBTest) return 1;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
    } else if (sortBy === "name") {
      list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    } else if (sortBy === "study_time") {
      list.sort((a, b) => {
        if (timeScope === "today") {
          return (b.todayStudySeconds || 0) - (a.todayStudySeconds || 0);
        }
        return (b.totalStudySeconds || 0) - (a.totalStudySeconds || 0);
      });
    } else if (sortBy === "decks") {
      list.sort((a, b) => b.decksCount - a.decksCount);
    }

    return list;
  }, [data, searchQuery, sortBy, timeScope, accountFilter]);

  // Loading Screen
  if (status === "loading" || (loading && isAdmin)) {
    return (
      <div style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "40px 24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh"
      }}>
        <div style={{
          width: "48px",
          height: "48px",
          border: "4px solid rgba(95, 143, 94, 0.2)",
          borderTopColor: "var(--primary-accent)",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite"
        }} />
        <p style={{ marginTop: "16px", color: "var(--text-secondary)", fontSize: "0.95rem" }}>
          Loading institutional overview...
        </p>
      </div>
    );
  }

  // Not Logged In
  if (status === "unauthenticated") {
    return (
      <div style={{
        maxWidth: "600px",
        margin: "80px auto",
        padding: "36px",
        background: "var(--bg-surface)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--glass-border)",
        textAlign: "center",
        boxShadow: "0 10px 30px rgba(0, 0, 0, 0.05)"
      }}>
        <div style={{
          width: "56px",
          height: "56px",
          borderRadius: "16px",
          background: "rgba(95, 143, 94, 0.12)",
          color: "var(--primary-accent)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 20px"
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <h2 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px" }}>
          Institutional Administrator Portal
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.92rem", marginBottom: "24px", lineHeight: 1.6 }}>
          This portal is reserved for College of Nursing administration and faculty members to monitor student learning activity and focus metrics.
        </p>
        <button
          onClick={() => signIn()}
          style={{
            padding: "12px 28px",
            background: "var(--primary-accent)",
            color: "#ffffff",
            borderRadius: "var(--radius-md)",
            border: "none",
            fontWeight: 600,
            cursor: "pointer",
            fontSize: "0.95rem"
          }}
        >
          Sign In as Administrator
        </button>
      </div>
    );
  }

  // If student attempted direct URL access, redirection triggers
  if (!isAdmin) {
    return null;
  }

  const { metrics } = data || {
    metrics: {
      totalStudents: 0,
      totalDecks: 0,
      totalCards: 0,
      totalSessions: 0,
      formattedTotalTime: "0 mins"
    }
  };

  return (
    <div className="admin-portal-root">
      <style>{`
        /* Full-bleed unlock: remove parent <main> padding for admin page so background stretches edge-to-edge with no outer card border/margin */
        .app-container:has(.admin-portal-root) main {
          padding: 0 !important;
          height: 100vh !important;
          overflow-y: auto !important;
          background: transparent !important;
        }

        /* Ambient Admin Theme & Fluid Spring Physics (Scoped to Admin Portal) */
        @keyframes adminModalSpring {
          0% {
            opacity: 0;
            transform: scale(0.93) translateY(20px);
          }
          65% {
            opacity: 1;
            transform: scale(1.015) translateY(-3px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        @keyframes adminBackdropFade {
          from {
            opacity: 0;
            backdrop-filter: blur(0px);
          }
          to {
            opacity: 1;
            backdrop-filter: blur(16px);
          }
        }

        @keyframes adminFadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .admin-portal-root {
          position: relative;
          min-height: 100vh;
          width: 100%;
          background: 
            radial-gradient(1200px 600px at 50% -30px, rgba(39, 82, 45, 0.08) 0%, rgba(187, 247, 208, 0.15) 35%, rgba(240, 253, 244, 0.05) 65%, transparent 85%),
            radial-gradient(800px 450px at 10% 120px, rgba(95, 143, 94, 0.05) 0%, transparent 60%),
            radial-gradient(800px 450px at 90% 150px, rgba(39, 82, 45, 0.05) 0%, transparent 60%),
            #ffffff;
          box-sizing: border-box;
          overflow-x: hidden;
          animation: adminFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        /* Hero Dot-Grid Mesh Background (matches landing page & user theme) */
        .admin-grid-mesh {
          position: absolute;
          inset: 0;
          background-image: radial-gradient(rgba(100, 116, 139, 0.16) 1.1px, transparent 1.1px);
          background-size: 26px 26px;
          mask-image: radial-gradient(ellipse 85% 75% at 50% 15%, #000000 35%, transparent 85%);
          -webkit-mask-image: radial-gradient(ellipse 85% 75% at 50% 15%, #000000 35%, transparent 85%);
          pointer-events: none;
          z-index: 0;
        }

        /* Metric Cards: Tactile Elevation & Smooth Spring Hover */
        .admin-metric-card {
          background: #ffffff;
          padding: 24px;
          border-radius: 22px;
          border: 1px solid rgba(0, 0, 0, 0.06);
          box-shadow: 
            0 2px 4px rgba(0, 0, 0, 0.02),
            0 10px 24px -4px rgba(0, 0, 0, 0.04),
            0 0 0 1px rgba(255, 255, 255, 0.8) inset;
          transition: all 0.28s cubic-bezier(0.16, 1, 0.3, 1);
          cursor: default;
        }
        .admin-metric-card:hover {
          transform: translateY(-3px);
          border-color: rgba(39, 82, 45, 0.16);
          box-shadow: 
            0 4px 8px rgba(0, 0, 0, 0.02),
            0 16px 36px -6px rgba(39, 82, 45, 0.1),
            0 0 0 1px rgba(39, 82, 45, 0.1);
        }

        /* Directory Section Panel: Luxurious Glass Card */
        .admin-directory-panel {
          background: #ffffff;
          border-radius: 26px;
          border: 1px solid rgba(0, 0, 0, 0.06);
          padding: 30px;
          box-shadow: 
            0 2px 4px rgba(0, 0, 0, 0.02),
            0 12px 36px -6px rgba(0, 0, 0, 0.05),
            0 0 0 1px rgba(255, 255, 255, 0.8) inset;
        }

        /* Table Row Soft Hover Glow */
        .admin-table-row {
          border-bottom: 1px solid rgba(0, 0, 0, 0.05);
          transition: background-color 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .admin-table-row:hover {
          background-color: rgba(39, 82, 45, 0.028);
        }

        /* Filter Controls */
        .admin-filter-input {
          width: 100%;
          padding: 10px 14px 10px 38px;
          font-size: 0.88rem;
          background: #ffffff;
          border: 1px solid rgba(0, 0, 0, 0.09);
          border-radius: 12px;
          outline: none;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .admin-filter-input:focus {
          border-color: #27522d;
          box-shadow: 0 0 0 3px rgba(39, 82, 45, 0.12);
        }

        .admin-filter-select {
          padding: 10px 16px;
          font-size: 0.88rem;
          background: #ffffff;
          border: 1px solid rgba(0, 0, 0, 0.09);
          border-radius: 12px;
          color: #0f172a;
          outline: none;
          cursor: pointer;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .admin-filter-select:hover {
          border-color: rgba(39, 82, 45, 0.3);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }
        @keyframes filterFadeIn {
          from {
            opacity: 0;
            transform: translateY(-4px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .admin-filter-select:focus {
          border-color: #27522d;
          box-shadow: 0 0 0 3px rgba(39, 82, 45, 0.12);
        }

        /* Tactile Interactive Buttons: Soft Lifts & Tactile Spring Press */
        .admin-btn-sync {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 9px 18px;
          background: #ffffff;
          border: 1px solid #d1d5db;
          border-radius: 9999px;
          color: #1e293b;
          font-size: 0.86rem;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
          transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .admin-btn-sync:hover {
          background: #f8fafc;
          border-color: #27522d;
          color: #27522d;
          transform: translateY(-1.5px);
          box-shadow: 0 4px 12px rgba(39, 82, 45, 0.12);
        }
        .admin-btn-sync:active {
          transform: scale(0.95) translateY(0);
        }

        .admin-btn-inspect {
          padding: 7px 15px;
          background: #ffffff;
          border: 1px solid #d1d5db;
          border-radius: 9999px;
          font-size: 0.8rem;
          font-weight: 600;
          color: #334155;
          cursor: pointer;
          white-space: nowrap;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .admin-btn-inspect:hover {
          background: #f8fafc;
          border-color: #94a3b8;
          color: #0f172a;
          transform: translateY(-1.5px);
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.06);
        }
        .admin-btn-inspect:active {
          transform: scale(0.93) translateY(0);
        }

        .admin-btn-hold {
          padding: 7px 15px;
          background: #fffbeb;
          border: 1px solid #fde68a;
          border-radius: 9999px;
          font-size: 0.8rem;
          font-weight: 600;
          color: #92400e;
          cursor: pointer;
          white-space: nowrap;
          box-shadow: 0 1px 2px rgba(245, 158, 11, 0.06);
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .admin-btn-hold:hover {
          background: #fef3c7;
          border-color: #f59e0b;
          color: #78350f;
          transform: translateY(-1.5px);
          box-shadow: 0 4px 12px rgba(245, 158, 11, 0.2);
        }
        .admin-btn-hold:active {
          transform: scale(0.93) translateY(0);
        }

        .admin-btn-reactivate {
          padding: 7px 15px;
          background: #27522d;
          border: 1px solid #27522d;
          border-radius: 9999px;
          font-size: 0.8rem;
          font-weight: 600;
          color: #ffffff;
          cursor: pointer;
          white-space: nowrap;
          box-shadow: 0 2px 6px rgba(39, 82, 45, 0.25);
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .admin-btn-reactivate:hover {
          background: #1e3e23;
          border-color: #1e3e23;
          transform: translateY(-1.5px);
          box-shadow: 0 6px 16px rgba(39, 82, 45, 0.35);
        }
        .admin-btn-reactivate:active {
          transform: scale(0.93) translateY(0);
        }

        .admin-btn-delete {
          padding: 7px 11px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 9999px;
          color: #94a3b8;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .admin-btn-delete:hover {
          color: #dc2626;
          border-color: #fca5a5;
          background: #fef2f2;
          transform: translateY(-1.5px);
          box-shadow: 0 4px 12px rgba(220, 38, 38, 0.15);
        }
        .admin-btn-delete:active {
          transform: scale(0.90) translateY(0);
        }

        /* Modal Elements: Spring Popups & Frosted Blur */
        .admin-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.5);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 9999;
          animation: adminBackdropFade 0.24s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .admin-modal-window {
          background: #ffffff;
          border-radius: 24px;
          box-shadow: 
            0 25px 60px -15px rgba(0, 0, 0, 0.25),
            0 0 0 1px rgba(255, 255, 255, 0.9) inset;
          border: 1px solid rgba(0, 0, 0, 0.08);
          overflow: hidden;
          animation: adminModalSpring 0.36s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .admin-modal-btn-cancel {
          padding: 10px 20px;
          background: #ffffff;
          border: 1px solid #d1d5db;
          border-radius: 12px;
          font-size: 0.86rem;
          font-weight: 600;
          color: #475569;
          cursor: pointer;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .admin-modal-btn-cancel:hover {
          background: #f8fafc;
          border-color: #94a3b8;
          color: #0f172a;
          transform: translateY(-1.5px);
        }
        .admin-modal-btn-cancel:active {
          transform: scale(0.95);
        }

        .admin-modal-btn-confirm-hold {
          padding: 10px 22px;
          background: #d97706;
          border: none;
          border-radius: 12px;
          font-size: 0.86rem;
          font-weight: 700;
          color: #ffffff;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 4px 14px rgba(217, 119, 6, 0.3);
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .admin-modal-btn-confirm-hold:hover {
          background: #b45309;
          transform: translateY(-1.5px);
          box-shadow: 0 6px 18px rgba(217, 119, 6, 0.4);
        }
        .admin-modal-btn-confirm-hold:active {
          transform: scale(0.95);
        }

        .admin-modal-btn-confirm-delete {
          padding: 10px 22px;
          background: #dc2626;
          border: none;
          border-radius: 12px;
          font-size: 0.86rem;
          font-weight: 700;
          color: #ffffff;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 4px 14px rgba(220, 38, 38, 0.3);
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .admin-modal-btn-confirm-delete:hover {
          background: #b91c1c;
          transform: translateY(-1.5px);
          box-shadow: 0 6px 18px rgba(220, 38, 38, 0.4);
        }
        .admin-modal-btn-confirm-delete:active {
          transform: scale(0.95);
        }

        .admin-modal-btn-primary {
          padding: 10px 24px;
          background: #27522d;
          border: none;
          border-radius: 12px;
          font-size: 0.86rem;
          font-weight: 700;
          color: #ffffff;
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(39, 82, 45, 0.25);
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .admin-modal-btn-primary:hover {
          background: #1e3e23;
          transform: translateY(-1.5px);
          box-shadow: 0 6px 18px rgba(39, 82, 45, 0.35);
        }
        .admin-modal-btn-primary:active {
          transform: scale(0.95);
        }

        /* Responsive Mobile Styles */
        @media (max-width: 768px) {
          .admin-portal-wrapper {
            padding: 20px 14px 60px !important;
          }
          .admin-directory-panel {
            padding: 20px 14px !important;
            border-radius: 14px !important;
          }
          .admin-metric-card {
            padding: 18px 16px !important;
            border-radius: 14px !important;
          }
          .admin-modal-window {
            max-width: 95vw !important;
            margin: 10px !important;
            border-radius: 16px !important;
          }
          .admin-modal-backdrop {
            padding: 10px !important;
          }
          .admin-header-row {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 16px !important;
          }
        }
      `}</style>
      <div className="admin-grid-mesh" />
      <div className="admin-portal-wrapper" style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: "100%", margin: "0 auto", padding: "34px 44px 80px", boxSizing: "border-box" }}>
        {/* Top Academic Header */}
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "20px",
          marginBottom: "32px",
          paddingBottom: "24px",
          borderBottom: "1px solid var(--glass-border)"
        }}>
          <div>
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "4px 12px",
              background: "rgba(95, 143, 94, 0.1)",
              borderRadius: "20px",
              color: "var(--primary-accent)",
              fontSize: "0.78rem",
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              marginBottom: "10px"
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
              University of the Assumption • College of Nursing
            </div>
            <h1 style={{ fontSize: "1.85rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              Academic Monitoring Portal
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", marginTop: "4px" }}>
              Institutional viewing panel for student participation, focus time, and flashcard usage.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            {/* Scope Selector: Total (All-Time) vs Today */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                background: "#ffffff",
                padding: "4px",
                borderRadius: "12px",
                border: "1px solid rgba(0, 0, 0, 0.08)",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.03)",
                gap: "4px"
              }}
            >
              <button
                type="button"
                onClick={() => setTimeScope("all")}
                style={{
                  padding: "6px 14px",
                  fontSize: "0.82rem",
                  fontWeight: timeScope === "all" ? 700 : 500,
                  color: timeScope === "all" ? "#ffffff" : "#64748b",
                  background: timeScope === "all" ? "#1e4620" : "transparent",
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.18s ease"
                }}
              >
                Total (All-Time)
              </button>
              <button
                type="button"
                onClick={() => setTimeScope("today")}
                style={{
                  padding: "6px 14px",
                  fontSize: "0.82rem",
                  fontWeight: timeScope === "today" ? 700 : 500,
                  color: timeScope === "today" ? "#ffffff" : "#64748b",
                  background: timeScope === "today" ? "#1e4620" : "transparent",
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.18s ease"
                }}
              >
                Today
              </button>
            </div>

            <button
              onClick={fetchAdminData}
              disabled={isRefreshing}
              className="admin-btn-sync"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ animation: isRefreshing ? "spin 0.8s linear infinite" : "none" }}
              >
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              {isRefreshing ? "Syncing..." : "Sync Live Data"}
            </button>
          </div>
        </div>

        {/* 4 Fluid Metric Cards */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "20px",
          marginBottom: "36px"
        }}>
          {/* Card 1: Registered Students */}
          <div className="admin-metric-card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#64748b" }}>
                Registered Students
              </span>
              <div style={{
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                background: "rgba(39, 82, 45, 0.1)",
                color: "#27522d",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
            </div>
            <div style={{ fontSize: "2.1rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.03em" }}>
              {metrics.totalStudents}
            </div>
            <p style={{ fontSize: "0.78rem", color: "#64748b", marginTop: "4px" }}>
              Active student profiles enrolled
            </p>
          </div>

          {/* Card 2: Platform Focus Time */}
          <div className="admin-metric-card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#64748b" }}>
                {timeScope === "today" ? "Today's Study Hours" : "Total Study Hours Logged"}
              </span>
              <div style={{
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                background: "rgba(15, 123, 108, 0.1)",
                color: "#0f7b6c",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
            </div>
            <div style={{ fontSize: "2.1rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.03em" }}>
              {timeScope === "today" ? (metrics.formattedTodayTime || "0m") : metrics.formattedTotalTime}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "6px", flexWrap: "wrap", gap: "4px" }}>
              <p style={{ fontSize: "0.78rem", color: "#64748b", margin: 0 }}>
                {timeScope === "today" ? "Focus time logged today" : "Accumulated focus time across sessions"}
              </p>
              <span style={{
                fontSize: "0.74rem",
                fontWeight: 700,
                color: "#0f7b6c",
                background: "rgba(15, 123, 108, 0.08)",
                padding: "2px 7px",
                borderRadius: "6px"
              }}>
                {timeScope === "today" ? `All-Time: ${metrics.formattedTotalTime}` : `Today: ${metrics.formattedTodayTime || "0m"}`}
              </span>
            </div>
          </div>

          {/* Card 3: Decks & Cards */}
          <div className="admin-metric-card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#64748b" }}>
                Decks & Flashcards
              </span>
              <div style={{
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                background: "rgba(217, 119, 6, 0.1)",
                color: "#d97706",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
              </div>
            </div>
            <div style={{ fontSize: "2.1rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.03em" }}>
              {metrics.totalDecks} <span style={{ fontSize: "1.05rem", fontWeight: 600, color: "#64748b" }}>/ {metrics.totalCards} cards</span>
            </div>
            <p style={{ fontSize: "0.78rem", color: "#64748b", marginTop: "4px" }}>
              Study decks created by nursing students
            </p>
          </div>

          {/* Card 4: Study Sessions */}
          <div className="admin-metric-card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#64748b" }}>
                {timeScope === "today" ? "Today's Study Sessions" : "Study Sessions Completed"}
              </span>
              <div style={{
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                background: "rgba(39, 82, 45, 0.1)",
                color: "#27522d",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
            </div>
            <div style={{ fontSize: "2.1rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.03em" }}>
              {timeScope === "today" ? (metrics.todaySessions ?? 0) : metrics.totalSessions}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "6px", flexWrap: "wrap", gap: "4px" }}>
              <p style={{ fontSize: "0.78rem", color: "#64748b", margin: 0 }}>
                {timeScope === "today" ? "Completed timer blocks today" : "Completed timer blocks with BreakGate"}
              </p>
              <span style={{
                fontSize: "0.74rem",
                fontWeight: 700,
                color: "#27522d",
                background: "rgba(39, 82, 45, 0.08)",
                padding: "2px 7px",
                borderRadius: "6px"
              }}>
                {timeScope === "today" ? `All-Time: ${metrics.totalSessions}` : `Today: ${metrics.todaySessions ?? 0}`}
              </span>
            </div>
          </div>
        </div>

        {/* Replaced with elegant floating toast popup */}
        {/* Student Directory Table Section (Expanded & Spacious) */}
        <div className="admin-directory-panel" style={{ padding: "34px 38px" }}>
          {/* Table Header and Search Bar */}
          <div style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            marginBottom: "24px"
          }}>
            <div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)" }}>
                Student Progress Directory
              </h2>
              <p style={{ fontSize: "0.84rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                Viewing individual student study records, active decks, and task completions.
              </p>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px" }}>
              {/* Search Input */}
              <div style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                minWidth: "260px"
              }}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ position: "absolute", left: "14px", color: "var(--text-secondary)" }}
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name, username, email..."
                  className="admin-filter-input"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    style={{
                      position: "absolute",
                      right: "12px",
                      background: "none",
                      border: "none",
                      color: "#94a3b8",
                      cursor: "pointer",
                      fontSize: "0.8rem",
                      fontWeight: 600
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Account Recency & Verification Filter Segment */}
              <div style={{
                display: "inline-flex",
                alignItems: "center",
                background: "#f1f5f9",
                padding: "3.5px",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                gap: "3px",
                flexWrap: "wrap"
              }}>
                <button
                  type="button"
                  onClick={() => setAccountFilter("all")}
                  style={{
                    padding: "7px 13px",
                    borderRadius: "9px",
                    fontSize: "0.82rem",
                    fontWeight: accountFilter === "all" ? 700 : 500,
                    color: accountFilter === "all" ? "#0f172a" : "#64748b",
                    background: accountFilter === "all" ? "#ffffff" : "transparent",
                    boxShadow: accountFilter === "all" ? "0 1px 4px rgba(0,0,0,0.06)" : "none",
                    border: "none",
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                >
                  All ({data?.students?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setAccountFilter("this_week")}
                  style={{
                    padding: "7px 13px",
                    borderRadius: "9px",
                    fontSize: "0.82rem",
                    fontWeight: accountFilter === "this_week" ? 700 : 500,
                    color: accountFilter === "this_week" ? "#1e3f23" : "#64748b",
                    background: accountFilter === "this_week" ? "#ffffff" : "transparent",
                    boxShadow: accountFilter === "this_week" ? "0 1px 4px rgba(0,0,0,0.06)" : "none",
                    border: "none",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                >
                  <span>Created This Week</span>
                  {createdThisWeekCount > 0 && (
                    <span style={{
                      padding: "1px 6px",
                      borderRadius: "10px",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      background: accountFilter === "this_week" ? "#dcfce7" : "#e2e8f0",
                      color: accountFilter === "this_week" ? "#15803d" : "#475569"
                    }}>
                      {createdThisWeekCount}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setAccountFilter("pending")}
                  style={{
                    padding: "7px 13px",
                    borderRadius: "9px",
                    fontSize: "0.82rem",
                    fontWeight: accountFilter === "pending" ? 700 : 500,
                    color: accountFilter === "pending" ? "#854d0e" : "#64748b",
                    background: accountFilter === "pending" ? "#ffffff" : "transparent",
                    boxShadow: accountFilter === "pending" ? "0 1px 4px rgba(0,0,0,0.06)" : "none",
                    border: "none",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                >
                  <span>Pending Review</span>
                  {pendingVerificationCount > 0 && (
                    <span style={{
                      padding: "1px 6px",
                      borderRadius: "10px",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      background: accountFilter === "pending" ? "#fef3c7" : "#e2e8f0",
                      color: accountFilter === "pending" ? "#b45309" : "#475569"
                    }}>
                      {pendingVerificationCount}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setAccountFilter("verified")}
                  style={{
                    padding: "7px 13px",
                    borderRadius: "9px",
                    fontSize: "0.82rem",
                    fontWeight: accountFilter === "verified" ? 700 : 500,
                    color: accountFilter === "verified" ? "#166534" : "#64748b",
                    background: accountFilter === "verified" ? "#ffffff" : "transparent",
                    boxShadow: accountFilter === "verified" ? "0 1px 4px rgba(0,0,0,0.06)" : "none",
                    border: "none",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                >
                  <span>Verified Only</span>
                  {verifiedCount > 0 && (
                    <span style={{
                      padding: "1px 6px",
                      borderRadius: "10px",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      background: accountFilter === "verified" ? "#dcfce7" : "#e2e8f0",
                      color: accountFilter === "verified" ? "#15803d" : "#475569"
                    }}>
                      {verifiedCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Custom Sort Dropdown */}
              <div ref={sortRef} style={{ position: "relative" }}>
                <button
                  type="button"
                  id="admin-sort-trigger"
                  aria-haspopup="listbox"
                  aria-expanded={isSortOpen}
                  onClick={() => setIsSortOpen((prev) => !prev)}
                  className="admin-filter-select"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "10px",
                    cursor: "pointer",
                    userSelect: "none",
                    fontWeight: 600,
                    color: "#1e293b",
                    background: "#ffffff",
                    border: isSortOpen ? "1px solid #27522d" : "1px solid rgba(0, 0, 0, 0.09)",
                    boxShadow: isSortOpen ? "0 0 0 3px rgba(39, 82, 45, 0.12)" : "0 1px 3px rgba(0, 0, 0, 0.02)",
                    borderRadius: "12px",
                    padding: "9px 14px",
                    transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)"
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#27522d" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <line x1="4" y1="6" x2="16" y2="6"/>
                    <line x1="4" y1="12" x2="11" y2="12"/>
                    <line x1="4" y1="18" x2="8" y2="18"/>
                    <polyline points="15 15 18 18 21 15"/>
                    <line x1="18" y1="9" x2="18" y2="18"/>
                  </svg>
                  <span>
                    {sortOptions.find((opt) => opt.value === sortBy)?.label || "Sort Records"}
                  </span>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#64748b"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      transform: isSortOpen ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                      flexShrink: 0
                    }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {isSortOpen && (
                  <div
                    role="listbox"
                    style={{
                      position: "absolute",
                      top: "calc(100% + 6px)",
                      right: 0,
                      minWidth: "260px",
                      background: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "14px",
                      boxShadow: "0 14px 32px -4px rgba(0, 0, 0, 0.12), 0 4px 12px rgba(0, 0, 0, 0.05)",
                      padding: "6px",
                      zIndex: 100,
                      animation: "filterFadeIn 0.16s cubic-bezier(0.16, 1, 0.3, 1)"
                    }}
                  >
                    {sortOptions.map((opt) => {
                      const isSelected = sortBy === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            setSortBy(opt.value);
                            setIsSortOpen(false);
                          }}
                          style={{
                            width: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "8px",
                            padding: "9px 12px",
                            borderRadius: "9px",
                            fontSize: "0.84rem",
                            fontWeight: isSelected ? 700 : 500,
                            color: isSelected ? "#15803d" : "#334155",
                            background: isSelected ? "#f0fdf4" : "transparent",
                            border: "none",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                            textAlign: "left"
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.background = "#f8fafc";
                              e.currentTarget.style.color = "#0f172a";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.background = "transparent";
                              e.currentTarget.style.color = "#334155";
                            }
                          }}
                        >
                          <span>{opt.label}</span>
                          {isSelected && (
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Directory Table */}
          <div style={{ overflowX: "auto", width: "100%" }}>
            <table style={{ width: "100%", minWidth: "1120px", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{
                  borderBottom: "2px solid var(--glass-border)",
                  color: "var(--text-secondary)",
                  fontSize: "0.78rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em"
                }}>
                  <th style={{ padding: "16px 20px", minWidth: "300px", textAlign: "left" }}>Student Profile</th>
                  <th style={{ padding: "16px 20px", minWidth: "135px", textAlign: "center" }}>Year Level</th>
                  <th style={{ padding: "16px 20px", minWidth: "95px", textAlign: "center" }}>Decks</th>
                  <th style={{ padding: "16px 20px", minWidth: "130px", textAlign: "center" }}>Focus Time ({timeScope === "today" ? "Today" : "Total"})</th>
                  <th style={{ padding: "16px 20px", minWidth: "90px", textAlign: "center" }}>Tasks</th>

                  <th style={{ padding: "16px 20px", minWidth: "250px", textAlign: "right", whiteSpace: "nowrap" }}>Dean Controls</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.length > 0 ? (
                  filteredStudents.map((student) => (
                    <tr
                      key={student.id}
                      className="admin-table-row"
                    >
                      {/* Student Profile: Avatar + Full Name + Username Handle + Email */}
                      <td style={{ padding: "16px 20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={student.image || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(student.username || student.name || 'Student')}&backgroundColor=c0aede`}
                            alt={student.name || student.username}
                            style={{
                              width: "42px",
                              height: "42px",
                              borderRadius: "50%",
                              objectFit: "cover",
                              border: "2px solid rgba(39, 82, 45, 0.2)",
                              flexShrink: 0,
                              background: "#f8fafc"
                            }}
                          />
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                              <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "0.94rem" }}>
                                {student.name || student.username}
                              </span>
                              <span style={{
                                fontSize: "0.74rem",
                                color: "#27522d",
                                background: "#f0fdf4",
                                border: "1px solid #dcfce7",
                                padding: "1px 7px",
                                borderRadius: "12px",
                                fontWeight: 600,
                                whiteSpace: "nowrap"
                              }}>
                                @{student.username}
                              </span>
                              {student.status === "ON_HOLD" && (
                                <span style={{
                                  fontSize: "0.72rem",
                                  color: "#92400e",
                                  background: "#fffbeb",
                                  border: "1px solid #fde68a",
                                  padding: "1px 7px",
                                  borderRadius: "12px",
                                  fontWeight: 700,
                                  whiteSpace: "nowrap"
                                }}>
                                  On Hold
                                </span>
                              )}
                              {student.verificationStatus === "VERIFIED" ? (
                                <span style={{
                                  fontSize: "0.7rem",
                                  color: "#166534",
                                  background: "#f0fdf4",
                                  border: "1px solid #bbf7d0",
                                  padding: "1px 7px",
                                  borderRadius: "12px",
                                  fontWeight: 700,
                                  whiteSpace: "nowrap"
                                }}>
                                  Valid Student
                                </span>
                              ) : student.verificationStatus === "REJECTED" ? (
                                <span style={{
                                  fontSize: "0.7rem",
                                  color: "#991b1b",
                                  background: "#fef2f2",
                                  border: "1px solid #fecaca",
                                  padding: "1px 7px",
                                  borderRadius: "12px",
                                  fontWeight: 700,
                                  whiteSpace: "nowrap"
                                }}>
                                  Unverified Acc
                                </span>
                              ) : (
                                <span style={{
                                  fontSize: "0.7rem",
                                  color: "#854d0e",
                                  background: "#fefce8",
                                  border: "1px solid #fef08a",
                                  padding: "1px 7px",
                                  borderRadius: "12px",
                                  fontWeight: 700,
                                  whiteSpace: "nowrap"
                                }}>
                                  Pending Review
                                </span>
                              )}
                              {new Date(student.createdAt) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) && (
                                <span style={{
                                  fontSize: "0.68rem",
                                  color: "#1e40af",
                                  background: "#eff6ff",
                                  border: "1px solid #bfdbfe",
                                  padding: "1px 6px",
                                  borderRadius: "10px",
                                  fontWeight: 700,
                                  whiteSpace: "nowrap"
                                }}>
                                  New This Week
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: "3px" }}>
                              {student.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Year & Section (Centered Badge) */}
                      <td style={{ padding: "14px 18px", textAlign: "center", whiteSpace: "nowrap" }}>
                        <span style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "4px 10px",
                          background: "#f1f5f9",
                          color: "#334155",
                          border: "1px solid #cbd5e1",
                          borderRadius: "8px",
                          fontSize: "0.78rem",
                          fontWeight: 600,
                          whiteSpace: "nowrap"
                        }}>
                          {student.yearSection || (student.yearLevel && student.section ? `${student.yearLevel} - ${student.section}` : student.yearLevel || student.section || "Not Assigned")}
                        </span>
                      </td>

                      {/* Decks (Centered, Uniform 78px Fixed Width Pill - Perfectly Aligned) */}
                      <td style={{ padding: "14px 18px", textAlign: "center" }}>
                        <span style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "78px",
                          height: "26px",
                          background: "#f1f5f9",
                          color: "#475569",
                          border: "1px solid #e2e8f0",
                          borderRadius: "8px",
                          fontSize: "0.78rem",
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                          boxSizing: "border-box"
                        }}>
                          {student.decksCount} {student.decksCount === 1 ? "Deck" : "Decks"}
                        </span>
                      </td>

                      {/* Focus Time (Centered) */}
                      <td style={{ padding: "14px 18px", textAlign: "center", whiteSpace: "nowrap" }}>
                        <div style={{ fontWeight: 700, fontSize: "0.92rem", color: "#0f172a" }}>
                          {timeScope === "today" ? (student.formattedTodayStudyTime || "0m") : student.formattedStudyTime}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "2px", fontWeight: 500 }}>
                          {timeScope === "today"
                            ? `Total: ${student.formattedStudyTime}`
                            : `Today: ${student.formattedTodayStudyTime || "0m"}`}
                        </div>
                      </td>

                      {/* Tasks Completed (Centered) */}
                      <td style={{ padding: "14px 18px", textAlign: "center", fontSize: "0.85rem", color: "#64748b", whiteSpace: "nowrap" }}>
                        {student.completedTodos} / {student.totalTodos}
                      </td>

                      {/* Dean Controls: Fluid Pill Buttons with Tactile Spring Press */}
                      <td style={{ padding: "14px 18px", textAlign: "right", whiteSpace: "nowrap" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", justifyContent: "flex-end", whiteSpace: "nowrap" }}>
                          <button
                            onClick={() => setSelectedStudent(student)}
                            className="admin-btn-inspect"
                            title="Inspect student study history and decks"
                          >
                            Inspect
                          </button>

                          {student.status === "ON_HOLD" || student.status === "BANNED" ? (
                            <button
                              onClick={() => handleUpdateUserStatus(student.id, "ACTIVE", null)}
                              disabled={isUpdatingStatus}
                              className="admin-btn-reactivate"
                              title="Restore full student access"
                            >
                              Reactivate
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setStatusModalStudent(student);
                                setTargetStatus("ON_HOLD");
                                setStatusReason("Academic Integrity Review - In-person clearance with College Dean required");
                              }}
                              className="admin-btn-hold"
                              title="Place account on hold (Requires in-person clearance)"
                            >
                              Put On Hold
                            </button>
                          )}

                          <button
                            onClick={() => setDeleteModalStudent(student)}
                            className="admin-btn-delete"
                            title="Permanently Delete Student Account"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" style={{ padding: "48px 16px", textAlign: "center", color: "var(--text-secondary)" }}>
                      <div style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "4px" }}>
                        No students found
                      </div>
                      <div style={{ fontSize: "0.85rem" }}>
                        {searchQuery ? "Try refining your search keyword." : "No registered students in the system yet."}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Confirmation Modal: Place Student Account On Hold */}
        {statusModalStudent && (
          <div className="admin-modal-backdrop">
            <div className="admin-modal-window" style={{ width: "100%", maxWidth: "520px" }}>
              {/* Modal Header */}
              <div style={{
                padding: "20px 24px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "10px",
                    background: "#fef3c7",
                    color: "#b45309",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  </div>
                  <div>
                    <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#0f172a", margin: 0 }}>
                      Place Account On Hold
                    </h3>
                    <p style={{ fontSize: "0.8rem", color: "#64748b", margin: "2px 0 0" }}>
                      Administrative restriction requiring Dean clearance
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setStatusModalStudent(null)}
                  disabled={isUpdatingStatus}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#94a3b8",
                    cursor: "pointer",
                    padding: "4px"
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Modal Body */}
              <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* Student Card Summary */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 16px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "10px"
                }}>
                  <div>
                    <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "0.92rem" }}>
                      {statusModalStudent.name}
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: "2px" }}>
                      @{statusModalStudent.username} • {statusModalStudent.email}
                    </div>
                  </div>
                  <span style={{
                    padding: "3px 9px",
                    background: "#f0fdf4",
                    color: "#166534",
                    border: "1px solid #bbf7d0",
                    borderRadius: "12px",
                    fontSize: "0.74rem",
                    fontWeight: 700
                  }}>
                    Current: Active
                  </span>
                </div>

                {/* Preset Reason Selector */}
                <div>
                  <div ref={presetRef} style={{ position: "relative", marginBottom: "10px" }}>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                    Select Reason Preset
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsPresetOpen((prev) => !prev)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      fontSize: "0.84rem",
                      borderRadius: "8px",
                      border: isPresetOpen ? "1px solid #27522d" : "1px solid #cbd5e1",
                      background: "#ffffff",
                      color: "#0f172a",
                      boxShadow: isPresetOpen ? "0 0 0 3px rgba(39, 82, 45, 0.12)" : "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      cursor: "pointer",
                      textAlign: "left",
                      fontWeight: 500
                    }}
                  >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {presetOptions.find((p) => p.value === statusReason)?.label || "Choose a preset or type custom..."}
                    </span>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#64748b"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{
                        transform: isPresetOpen ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.2s ease",
                        flexShrink: 0,
                        marginLeft: "8px"
                      }}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {isPresetOpen && (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 4px)",
                        left: 0,
                        right: 0,
                        zIndex: 110,
                        background: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: "10px",
                        boxShadow: "0 10px 25px -4px rgba(0, 0, 0, 0.12)",
                        padding: "4px"
                      }}
                    >
                      {presetOptions.map((p) => {
                        const isMatch = statusReason === p.value;
                        return (
                          <button
                            key={p.value}
                            type="button"
                            onClick={() => {
                              if (p.value !== "CUSTOM") {
                                setStatusReason(p.value);
                              }
                              setIsPresetOpen(false);
                            }}
                            style={{
                              width: "100%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "8px 10px",
                              borderRadius: "6px",
                              fontSize: "0.82rem",
                              fontWeight: isMatch ? 600 : 500,
                              color: isMatch ? "#15803d" : "#334155",
                              background: isMatch ? "#f0fdf4" : "transparent",
                              border: "none",
                              cursor: "pointer",
                              textAlign: "left"
                            }}
                            onMouseEnter={(e) => {
                              if (!isMatch) e.currentTarget.style.background = "#f8fafc";
                            }}
                            onMouseLeave={(e) => {
                              if (!isMatch) e.currentTarget.style.background = "transparent";
                            }}
                          >
                            <span>{p.label}</span>
                            {isMatch && (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                    Message Displayed to Student Upon Login
                  </label>
                  <textarea
                    value={statusReason}
                    onChange={(e) => setStatusReason(e.target.value)}
                    rows={3}
                    placeholder="Enter details or office visit instructions..."
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      fontSize: "0.84rem",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      color: "#0f172a",
                      outline: "none",
                      resize: "vertical",
                      boxSizing: "border-box",
                      fontFamily: "inherit"
                    }}
                  />
                </div>

                {/* Informative Alert */}
                <div style={{
                  padding: "12px 14px",
                  background: "#fffbeb",
                  border: "1px solid #fde68a",
                  borderRadius: "10px",
                  display: "flex",
                  gap: "10px",
                  fontSize: "0.8rem",
                  color: "#92400e",
                  lineHeight: 1.5
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: "2px" }}>
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  <div>
                    <strong>Immediate Effect:</strong> The student will be signed out from active study sessions. On subsequent login attempts, access will be blocked and this exact explanation will prompt them to meet with you in person.
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div style={{
                padding: "16px 24px",
                borderTop: "1px solid #e2e8f0",
                background: "#f8fafc",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: "10px"
              }}>
                <button
                  onClick={() => setStatusModalStudent(null)}
                  disabled={isUpdatingStatus}
                  className="admin-modal-btn-cancel"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleUpdateUserStatus(statusModalStudent.id, "ON_HOLD", statusReason)}
                  disabled={isUpdatingStatus}
                  className="admin-modal-btn-confirm-hold"
                >
                  {isUpdatingStatus ? "Updating Status..." : "Confirm Account Hold"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Modal: Delete Student Account */}
        {deleteModalStudent && (
          <div className="admin-modal-backdrop">
            <div className="admin-modal-window" style={{ width: "100%", maxWidth: "480px" }}>
              {/* Modal Header */}
              <div style={{
                padding: "20px 24px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "10px",
                    background: "#fee2e2",
                    color: "#dc2626",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </div>
                  <div>
                    <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#0f172a", margin: 0 }}>
                      Delete Student Account
                    </h3>
                    <p style={{ fontSize: "0.8rem", color: "#64748b", margin: "2px 0 0" }}>
                      Irreversible removal of profile and learning telemetry
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setDeleteModalStudent(null)}
                  disabled={isUpdatingStatus}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#94a3b8",
                    cursor: "pointer",
                    padding: "4px"
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Modal Body */}
              <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{
                  padding: "14px 16px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "10px"
                }}>
                  <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "0.92rem" }}>
                    {deleteModalStudent.name}
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: "2px" }}>
                    @{deleteModalStudent.username} • {deleteModalStudent.email}
                  </div>
                  <div style={{ display: "flex", gap: "16px", marginTop: "10px", fontSize: "0.78rem", color: "#475569" }}>
                    <span><strong>Decks:</strong> {deleteModalStudent.decksCount}</span>
                    <span><strong>Study Time:</strong> {deleteModalStudent.formattedStudyTime}</span>
                    <span><strong>Tasks:</strong> {deleteModalStudent.completedTodos}/{deleteModalStudent.totalTodos}</span>
                  </div>
                </div>

                <div style={{
                  padding: "12px 14px",
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "10px",
                  display: "flex",
                  gap: "10px",
                  fontSize: "0.8rem",
                  color: "#991b1b",
                  lineHeight: 1.5
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: "2px" }}>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <div>
                    <strong>Permanent Action:</strong> Deleting this account will permanently erase their study sessions, flashcards, and BreakGate telemetry from the database. This action cannot be reverted.
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div style={{
                padding: "16px 24px",
                borderTop: "1px solid #e2e8f0",
                background: "#f8fafc",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: "10px"
              }}>
                <button
                  onClick={() => setDeleteModalStudent(null)}
                  disabled={isUpdatingStatus}
                  className="admin-modal-btn-cancel"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteUser(deleteModalStudent.id)}
                  disabled={isUpdatingStatus}
                  className="admin-modal-btn-confirm-delete"
                >
                  {isUpdatingStatus ? "Deleting..." : "Permanently Delete"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Inspect Student Modal */}
        {selectedStudent && (
          <div className="admin-modal-backdrop">
            <div className="admin-modal-window" style={{
              width: "100%",
              maxWidth: "640px",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column"
            }}>
              {/* Modal Header */}
              <div style={{
                padding: "20px 24px",
                borderBottom: "1px solid var(--glass-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedStudent.image || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(selectedStudent.username || selectedStudent.name || 'Student')}&backgroundColor=c0aede`}
                    alt={selectedStudent.name || selectedStudent.username}
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "50%",
                      objectFit: "cover",
                      border: "2px solid rgba(39, 82, 45, 0.25)",
                      background: "#f8fafc",
                      flexShrink: 0
                    }}
                  />
                  <div>
                    <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                      {selectedStudent.name || selectedStudent.username}
                    </h3>
                    <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginTop: "2px", margin: 0 }}>
                      @{selectedStudent.username} • {selectedStudent.email}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedStudent(null)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-secondary)",
                    padding: "4px"
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Modal Body */}
              <div style={{ padding: "24px", overflowY: "auto", flex: 1 }}>
                {/* Official Student Academic Identification & Dean Name Correction */}
                <div style={{
                  padding: "16px 18px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "14px",
                  marginBottom: "20px"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                    <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Official Academic Student Profile
                    </span>
                    <span style={{ fontSize: "0.74rem", color: "#166534", background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "2px 8px", borderRadius: "12px", fontWeight: 700 }}>
                      {selectedStudent.status === "ON_HOLD" ? "On Hold" : selectedStudent.status === "BANNED" ? "Banned" : "Active"}
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 600, display: "block" }}>Full Name (Official Academic Record)</label>
                      <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#0f172a", marginTop: "2px" }}>
                        {selectedStudent.name || selectedStudent.username}
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 600, display: "block" }}>Username (Student Editable)</label>
                      <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#27522d", marginTop: "2px" }}>
                        @{selectedStudent.username}
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 600, display: "block" }}>Year Level</label>
                      <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#0f172a", marginTop: "2px" }}>
                        {selectedStudent.yearSection || (selectedStudent.yearLevel && selectedStudent.section ? `${selectedStudent.yearLevel} - ${selectedStudent.section}` : selectedStudent.yearLevel || selectedStudent.section || "Not Assigned")}
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 600, display: "block" }}>Date Enrolled / Joined</label>
                      <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "#475569", marginTop: "2px" }}>
                        {new Date(selectedStudent.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </div>
                    </div>
                  </div>

                  {/* Dean Student Account Verification Tool (Valid Acc vs Not) */}
                  <div style={{ marginTop: "14px", paddingTop: "12px", borderTop: "1px dashed #cbd5e1" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "8px" }}>
                      <div>
                        <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#334155" }}>
                          Dean Student Account Verification:
                        </span>
                        <div style={{ fontSize: "0.76rem", color: "#64748b", marginTop: "2px" }}>
                          Validation Status:{" "}
                          <strong style={{
                            color: selectedStudent.verificationStatus === "VERIFIED" ? "#166534" : selectedStudent.verificationStatus === "REJECTED" ? "#b91c1c" : "#b45309"
                          }}>
                            {selectedStudent.verificationStatus === "VERIFIED"
                              ? "Valid UA Nursing Student Account"
                              : selectedStudent.verificationStatus === "REJECTED"
                              ? "Invalid / Not Recognized Account"
                              : "Pending Dean Review"}
                          </strong>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "8px" }}>
                        {selectedStudent.verificationStatus !== "VERIFIED" ? (
                          <button
                            type="button"
                            onClick={() => handleUpdateVerification(selectedStudent.id, "VERIFIED")}
                            disabled={isUpdatingVerification}
                            className="admin-btn-sync"
                            style={{
                              padding: "7px 16px",
                              fontSize: "0.82rem",
                              fontWeight: 700,
                              background: "#166534",
                              borderColor: "#166534",
                              color: "#ffffff",
                              cursor: "pointer"
                            }}
                          >
                            Mark as Valid Account
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleUpdateVerification(selectedStudent.id, "REJECTED")}
                            disabled={isUpdatingVerification}
                            className="admin-btn-sync"
                            style={{
                              padding: "7px 16px",
                              fontSize: "0.82rem",
                              fontWeight: 600,
                              background: "#fef2f2",
                              borderColor: "#fecaca",
                              color: "#b91c1c",
                              cursor: "pointer"
                            }}
                          >
                            Revoke (Mark as Invalid)
                          </button>
                        )}

                        {selectedStudent.verificationStatus === "REJECTED" && (
                          <button
                            type="button"
                            onClick={() => handleUpdateVerification(selectedStudent.id, "PENDING")}
                            disabled={isUpdatingVerification}
                            className="admin-btn-sync"
                            style={{
                              padding: "7px 12px",
                              fontSize: "0.78rem",
                              fontWeight: 600,
                              background: "#ffffff",
                              color: "#475569",
                              cursor: "pointer"
                            }}
                          >
                            Reset to Pending
                          </button>
                        )}
                      </div>
                    </div>
                    <span style={{ fontSize: "0.72rem", color: "#64748b", display: "block" }}>
                      Allows the Dean to officially authenticate whether this account belongs to a legitimate enrolled nursing student.
                    </span>
                  </div>

                  {/* Dean In-Person Name Correction Tool */}
                  <div style={{ marginTop: "14px", paddingTop: "12px", borderTop: "1px dashed #cbd5e1" }}>
                    <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                      Dean In-Person Full Name Correction:
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <input
                        type="text"
                        id="dean-name-change-input"
                        defaultValue={selectedStudent.name || ""}
                        placeholder="Enter updated official full name..."
                        style={{
                          flex: 1,
                          padding: "8px 12px",
                          fontSize: "0.84rem",
                          borderRadius: "8px",
                          border: "1px solid #cbd5e1",
                          background: "#ffffff",
                          outline: "none"
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const input = document.getElementById("dean-name-change-input");
                          const newName = input?.value?.trim();
                          if (!newName) {
                            alert("Please enter a valid full name.");
                            return;
                          }
                          if (newName === selectedStudent.name) {
                            alert("The official full name is already set to this value.");
                            return;
                          }
                          setNameConfirmModal({ student: selectedStudent, newName });
                        }}
                        className="admin-btn-sync"
                        style={{ padding: "8px 18px", fontSize: "0.82rem", whiteSpace: "nowrap", cursor: "pointer" }}
                      >
                        Update Name
                      </button>
                    </div>
                    <span style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "4px", display: "block" }}>
                      Students cannot edit their own official full name in their profile; updates must be granted by the College Dean in person.
                    </span>
                  </div>

                  {/* Dean In-Person Password Reset Tool */}
                  <div style={{ marginTop: "14px", paddingTop: "12px", borderTop: "1px dashed #cbd5e1" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#334155" }}>
                        Dean In-Person Student Password Reset:
                      </span>
                      <button
                        type="button"
                        onClick={() => setResetPasswordInput("student123")}
                        style={{
                          background: "rgba(59, 130, 246, 0.08)",
                          border: "1px dashed rgba(59, 130, 246, 0.4)",
                          borderRadius: "6px",
                          padding: "2px 8px",
                          fontSize: "0.72rem",
                          fontWeight: 600,
                          color: "#1d4ed8",
                          cursor: "pointer"
                        }}
                        title="Auto-fill default password student123"
                      >
                        Default: student123
                      </button>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center" }}>
                        <input
                          type={showResetPasswordText ? "text" : "password"}
                          value={resetPasswordInput}
                          onChange={(e) => setResetPasswordInput(e.target.value)}
                          placeholder="Enter new password (min. 6 chars)..."
                          style={{
                            width: "100%",
                            padding: "8px 36px 8px 12px",
                            fontSize: "0.84rem",
                            borderRadius: "8px",
                            border: "1px solid #cbd5e1",
                            background: "#ffffff",
                            outline: "none",
                            boxSizing: "border-box"
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowResetPasswordText(!showResetPasswordText)}
                          style={{
                            position: "absolute",
                            right: "8px",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: "#64748b",
                            padding: "2px",
                            display: "flex",
                            alignItems: "center"
                          }}
                          title={showResetPasswordText ? "Hide password" : "Show password"}
                        >
                          {showResetPasswordText ? (
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                              <line x1="1" y1="1" x2="23" y2="23" />
                            </svg>
                          ) : (
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          )}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const trimmed = resetPasswordInput.trim();
                          if (!trimmed || trimmed.length < 6) {
                            alert("Password must be at least 6 characters long.");
                            return;
                          }
                          setPasswordConfirmModal({ student: selectedStudent, newPassword: trimmed });
                        }}
                        className="admin-btn-sync"
                        style={{ padding: "8px 18px", fontSize: "0.82rem", whiteSpace: "nowrap", cursor: "pointer", background: "#1e3a8a", borderColor: "#1e3a8a" }}
                      >
                        Reset Password
                      </button>
                    </div>
                    <span style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "4px", display: "block" }}>
                      Dean credential override immediately updates the student password in the database.
                    </span>
                  </div>
                </div>

                {/* Quick Summary Strip */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "12px",
                  marginBottom: "24px"
                }}>
                  <div style={{ padding: "12px", background: "var(--bg-color)", borderRadius: "var(--radius-md)", textAlign: "center" }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600 }}>Study Time</div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", marginTop: "2px" }}>
                      {selectedStudent.formattedStudyTime}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "#0f7b6c", marginTop: "3px", fontWeight: 600 }}>
                      Today: {selectedStudent.formattedTodayStudyTime || "0m"}
                    </div>
                  </div>

                  <div style={{ padding: "12px", background: "var(--bg-color)", borderRadius: "var(--radius-md)", textAlign: "center" }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600 }}>Decks Created</div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", marginTop: "2px" }}>
                      {selectedStudent.decksCount}
                    </div>
                  </div>

                  <div style={{ padding: "12px", background: "var(--bg-color)", borderRadius: "var(--radius-md)", textAlign: "center" }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600 }}>Tasks Done</div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", marginTop: "2px" }}>
                      {selectedStudent.completedTodos} / {selectedStudent.totalTodos}
                    </div>
                  </div>
                </div>

                {/* Created Decks List */}
                <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "12px" }}>
                  Created Flashcard Decks ({selectedStudent.decks?.length || 0})
                </h4>

                {selectedStudent.decks && selectedStudent.decks.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {selectedStudent.decks.map((deck) => (
                      <div
                        key={deck.id}
                        style={{
                          padding: "14px 16px",
                          background: "var(--bg-color)",
                          border: "1px solid var(--glass-border)",
                          borderRadius: "var(--radius-md)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between"
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.9rem" }}>
                            {deck.title}
                          </div>
                          <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                            Created on {new Date(deck.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <span style={{
                          padding: "3px 8px",
                          background: "rgba(95, 143, 94, 0.12)",
                          color: "var(--primary-accent)",
                          borderRadius: "8px",
                          fontSize: "0.78rem",
                          fontWeight: 600
                        }}>
                          {deck.cardsCount} cards
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: "20px", background: "var(--bg-color)", borderRadius: "var(--radius-md)", textAlign: "center", color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                    No flashcard decks created by this student yet.
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div style={{
                padding: "16px 24px",
                borderTop: "1px solid var(--glass-border)",
                display: "flex",
                justifyContent: "flex-end"
              }}>
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="admin-modal-btn-primary"
                >
                  Close Record
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Confirmation Modal: Official Student Name Update (Dean In-Person Protocol) */}
      {nameConfirmModal && (
        <div className="admin-modal-backdrop" style={{ zIndex: 10050, background: "rgba(15, 23, 42, 0.65)", backdropFilter: "blur(8px)" }}>
          <div className="admin-modal-window" style={{ width: "100%", maxWidth: "490px" }}>
            {/* Modal Header */}
            <div style={{
              padding: "20px 24px",
              borderBottom: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={nameConfirmModal.student.image || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(nameConfirmModal.student.username || nameConfirmModal.student.name || 'Student')}&backgroundColor=c0aede`}
                  alt={nameConfirmModal.student.name || nameConfirmModal.student.username}
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: "2px solid rgba(39, 82, 45, 0.25)",
                    background: "#f8fafc",
                    flexShrink: 0
                  }}
                />
                <div>
                  <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#0f172a", margin: 0 }}>
                    Confirm Official Name Update
                  </h3>
                  <p style={{ fontSize: "0.8rem", color: "#64748b", margin: "2px 0 0" }}>
                    In-person College Dean's Office Academic Record Modification
                  </p>
                </div>
              </div>

              <button
                onClick={() => setNameConfirmModal(null)}
                disabled={isUpdatingStatus}
                style={{
                  background: "none",
                  border: "none",
                  color: "#94a3b8",
                  cursor: "pointer",
                  padding: "4px"
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{
                padding: "16px 18px",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                display: "flex",
                flexDirection: "column",
                gap: "10px"
              }}>
                <div>
                  <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "#64748b", fontWeight: 700 }}>
                    Current Academic Record
                  </span>
                  <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#64748b", textDecoration: "line-through", marginTop: "2px" }}>
                    {nameConfirmModal.student.name || nameConfirmModal.student.username}
                  </div>
                </div>

                <div style={{ borderTop: "1px dashed #cbd5e1", paddingTop: "10px" }}>
                  <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "#166534", fontWeight: 700 }}>
                    New Official Full Name
                  </span>
                  <div style={{ fontSize: "1.12rem", fontWeight: 800, color: "#166534", marginTop: "2px" }}>
                    {nameConfirmModal.newName}
                  </div>
                </div>

                <div style={{ fontSize: "0.78rem", color: "#64748b", display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
                  <span>Account:</span>
                  <strong style={{ color: "#334155" }}>@{nameConfirmModal.student.username}</strong>
                  <span>•</span>
                  <span>{nameConfirmModal.student.email}</span>
                </div>
              </div>

              {/* Notice */}
              <div style={{
                padding: "12px 14px",
                background: "rgba(39, 82, 45, 0.06)",
                border: "1px solid rgba(39, 82, 45, 0.2)",
                borderRadius: "10px",
                display: "flex",
                gap: "10px",
                fontSize: "0.8rem",
                color: "#1e3e23",
                lineHeight: 1.5
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#27522d" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: "2px" }}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <div>
                  <strong>Dean Verification:</strong> This updates the student's legal academic name across all institutional rosters, telemetry logs, and evaluation reports.
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: "16px 24px",
              borderTop: "1px solid #e2e8f0",
              background: "#f8fafc",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: "10px"
            }}>
              <button
                onClick={() => setNameConfirmModal(null)}
                disabled={isUpdatingStatus}
                className="admin-modal-btn-cancel"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmNameChange}
                disabled={isUpdatingStatus}
                className="admin-modal-btn-primary"
              >
                {isUpdatingStatus ? "Updating Record..." : "Confirm & Update Name"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Student Password Reset (Dean In-Person Protocol) */}
      {passwordConfirmModal && (
        <div className="admin-modal-backdrop" style={{ zIndex: 10050, background: "rgba(15, 23, 42, 0.65)", backdropFilter: "blur(8px)" }}>
          <div className="admin-modal-window" style={{ width: "100%", maxWidth: "490px" }}>
            {/* Modal Header */}
            <div style={{
              padding: "20px 24px",
              borderBottom: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "12px",
                  background: "rgba(30, 58, 138, 0.1)",
                  border: "1px solid rgba(30, 58, 138, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#1e3a8a",
                  flexShrink: 0
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <div>
                  <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#0f172a", margin: 0 }}>
                    Confirm Password Reset
                  </h3>
                  <p style={{ fontSize: "0.8rem", color: "#64748b", margin: "2px 0 0" }}>
                    In-person College Dean Credential Override
                  </p>
                </div>
              </div>

              <button
                onClick={() => setPasswordConfirmModal(null)}
                disabled={isUpdatingStatus}
                style={{
                  background: "none",
                  border: "none",
                  color: "#94a3b8",
                  cursor: "pointer",
                  padding: "4px"
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{
                padding: "16px 18px",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                display: "flex",
                flexDirection: "column",
                gap: "10px"
              }}>
                <div>
                  <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "#64748b", fontWeight: 700 }}>
                    Student Academic Profile
                  </span>
                  <div style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", marginTop: "2px" }}>
                    {passwordConfirmModal.student.name || passwordConfirmModal.student.username}
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: "2px" }}>
                    @{passwordConfirmModal.student.username} • {passwordConfirmModal.student.email}
                  </div>
                </div>

                <div style={{ borderTop: "1px dashed #cbd5e1", paddingTop: "10px" }}>
                  <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "#1e3a8a", fontWeight: 700 }}>
                    New Set Password
                  </span>
                  <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#1e3a8a", marginTop: "2px", letterSpacing: "0.02em", fontFamily: "monospace" }}>
                    {passwordConfirmModal.newPassword}
                  </div>
                </div>
              </div>

              <div style={{
                padding: "12px 14px",
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                borderRadius: "10px",
                fontSize: "0.78rem",
                color: "#1e40af",
                lineHeight: 1.5
              }}>
                <strong>Dean Verification:</strong> This will immediately hash and update the password in the database. The student can log in right away using these new credentials.
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: "16px 24px",
              borderTop: "1px solid #e2e8f0",
              background: "#f8fafc",
              display: "flex",
              justifyContent: "flex-end",
              gap: "12px"
            }}>
              <button
                onClick={() => setPasswordConfirmModal(null)}
                disabled={isUpdatingStatus}
                className="admin-modal-btn-cancel"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPasswordReset}
                disabled={isUpdatingStatus}
                style={{
                  padding: "10px 22px",
                  background: "#1e3a8a",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "10px",
                  fontWeight: 700,
                  fontSize: "0.86rem",
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(30, 58, 138, 0.25)"
                }}
              >
                {isUpdatingStatus ? "Updating..." : "Confirm & Reset Password"}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Floating Institutional Toast Popup */}
      {toastPopup && (
        <div style={{
          position: "fixed",
          bottom: "32px",
          right: "32px",
          zIndex: 11000,
          background: "#ffffff",
          border: "1.5px solid #86efac",
          borderRadius: "16px",
          padding: "16px 20px",
          boxShadow: "0 18px 45px rgba(0, 0, 0, 0.14), 0 4px 14px rgba(34, 197, 94, 0.15)",
          display: "flex",
          alignItems: "center",
          gap: "14px",
          maxWidth: "420px",
          animation: "toastSlideIn 0.28s cubic-bezier(0.16, 1, 0.3, 1)"
        }}>
          <div style={{
            width: "38px",
            height: "38px",
            borderRadius: "10px",
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            color: "#16a34a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "#0f172a" }}>
              {toastPopup.title}
            </div>
            <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "2px", lineHeight: 1.4 }}>
              {toastPopup.message}
            </div>
          </div>
          <button
            onClick={() => setToastPopup(null)}
            style={{
              background: "none",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              padding: "4px"
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
