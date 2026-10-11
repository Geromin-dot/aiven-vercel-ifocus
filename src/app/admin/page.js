"use client";

import { useState, useEffect, useMemo } from "react";
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
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.username === "adminUAnursing";

  // Strict Protection: Normal students cannot access or view Admin Portal
  useEffect(() => {
    if (status === "authenticated" && !isAdmin) {
      router.replace("/dashboard");
    }
  }, [status, isAdmin, router]);

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
  const filteredStudents = useMemo(() => {
    if (!data?.students) return [];

    let list = [...data.students];

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
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sortBy === "name") {
      list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    } else if (sortBy === "study_time") {
      list.sort((a, b) => b.totalStudySeconds - a.totalStudySeconds);
    } else if (sortBy === "decks") {
      list.sort((a, b) => b.decksCount - a.decksCount);
    }

    return list;
  }, [data, searchQuery, sortBy]);

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
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
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
    <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "32px 24px 60px" }}>
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

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            onClick={fetchAdminData}
            disabled={isRefreshing}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 18px",
              background: "var(--bg-surface)",
              border: "1px solid var(--glass-border)",
              borderRadius: "var(--radius-md)",
              color: "var(--text-primary)",
              fontSize: "0.88rem",
              fontWeight: 600,
              cursor: isRefreshing ? "not-allowed" : "pointer",
              transition: "all 0.2s"
            }}
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

          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 18px",
              background: "rgba(224, 62, 62, 0.08)",
              border: "1px solid rgba(224, 62, 62, 0.2)",
              borderRadius: "var(--radius-md)",
              color: "var(--error)",
              fontSize: "0.88rem",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign Out
          </button>
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: "18px",
        marginBottom: "36px"
      }}>
        {/* Card 1: Registered Students */}
        <div style={{
          background: "var(--bg-surface)",
          padding: "22px",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--glass-border)",
          boxShadow: "0 2px 10px rgba(0, 0, 0, 0.02)"
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)" }}>
              Registered Students
            </span>
            <div style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: "rgba(95, 143, 94, 0.12)",
              color: "var(--primary-accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.03em" }}>
            {metrics.totalStudents}
          </div>
          <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: "4px" }}>
            Active student profiles enrolled
          </p>
        </div>

        {/* Card 2: Platform Focus Time */}
        <div style={{
          background: "var(--bg-surface)",
          padding: "22px",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--glass-border)",
          boxShadow: "0 2px 10px rgba(0, 0, 0, 0.02)"
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)" }}>
              Total Study Hours Logged
            </span>
            <div style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: "rgba(15, 123, 108, 0.12)",
              color: "var(--success)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.03em" }}>
            {metrics.formattedTotalTime}
          </div>
          <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: "4px" }}>
            Accumulated focus time across sessions
          </p>
        </div>

        {/* Card 3: Decks & Cards */}
        <div style={{
          background: "var(--bg-surface)",
          padding: "22px",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--glass-border)",
          boxShadow: "0 2px 10px rgba(0, 0, 0, 0.02)"
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)" }}>
              Decks & Flashcards
            </span>
            <div style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: "rgba(217, 119, 6, 0.12)",
              color: "var(--warning)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
            </div>
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.03em" }}>
            {metrics.totalDecks} <span style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-secondary)" }}>/ {metrics.totalCards} cards</span>
          </div>
          <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: "4px" }}>
            Study decks created by nursing students
          </p>
        </div>

        {/* Card 4: Study Sessions */}
        <div style={{
          background: "var(--bg-surface)",
          padding: "22px",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--glass-border)",
          boxShadow: "0 2px 10px rgba(0, 0, 0, 0.02)"
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)" }}>
              Study Sessions Completed
            </span>
            <div style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: "rgba(78, 122, 77, 0.12)",
              color: "var(--primary-hover)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.03em" }}>
            {metrics.totalSessions}
          </div>
          <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: "4px" }}>
            Completed timer blocks with BreakGate
          </p>
        </div>
      </div>

      {/* Student Directory Table Section */}
      <div style={{
        background: "var(--bg-surface)",
        borderRadius: "var(--radius-xl)",
        border: "1px solid var(--glass-border)",
        padding: "28px",
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.02)"
      }}>
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
                style={{
                  width: "100%",
                  padding: "9px 14px 9px 38px",
                  fontSize: "0.88rem",
                  background: "var(--bg-color)",
                  border: "1px solid var(--glass-border)",
                  borderRadius: "var(--radius-md)",
                  outline: "none"
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  style={{
                    position: "absolute",
                    right: "10px",
                    background: "none",
                    border: "none",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    fontSize: "0.8rem"
                  }}
                >
                  Clear
                </button>
              )}
            </div>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                padding: "9px 14px",
                fontSize: "0.88rem",
                background: "var(--bg-color)",
                border: "1px solid var(--glass-border)",
                borderRadius: "var(--radius-md)",
                color: "var(--text-primary)",
                outline: "none",
                cursor: "pointer"
              }}
            >
              <option value="recent">Sort: Most Recently Registered</option>
              <option value="study_time">Sort: Highest Study Time</option>
              <option value="decks">Sort: Most Decks Created</option>
              <option value="name">Sort: Student Name (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Directory Table */}
        <div style={{ overflowX: "auto", width: "100%" }}>
          <table style={{ width: "100%", minWidth: "780px", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{
                borderBottom: "2px solid var(--glass-border)",
                color: "var(--text-secondary)",
                fontSize: "0.78rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em"
              }}>
                <th style={{ padding: "12px 16px" }}>Student</th>
                <th style={{ padding: "12px 16px" }}>Email</th>
                <th style={{ padding: "12px 16px" }}>Date Joined</th>
                <th style={{ padding: "12px 16px" }}>Decks</th>
                <th style={{ padding: "12px 16px" }}>Focus Time</th>
                <th style={{ padding: "12px 16px" }}>Tasks Done</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length > 0 ? (
                filteredStudents.map((student) => (
                  <tr
                    key={student.id}
                    style={{
                      borderBottom: "1px solid var(--glass-border)",
                      transition: "background 0.15s"
                    }}
                  >
                    {/* Student Name & Username */}
                    <td style={{ padding: "16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "50%",
                          background: "rgba(95, 143, 94, 0.18)",
                          color: "var(--primary-accent)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          fontSize: "0.95rem"
                        }}>
                          {(student.name || student.username || "S")[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.92rem" }}>
                            {student.name}
                          </div>
                          <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                            @{student.username}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td style={{ padding: "16px", fontSize: "0.88rem", color: "var(--text-secondary)" }}>
                      {student.email}
                    </td>

                    {/* Date Joined */}
                    <td style={{ padding: "16px", fontSize: "0.86rem", color: "var(--text-secondary)" }}>
                      {new Date(student.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric"
                      })}
                    </td>

                    {/* Decks */}
                    <td style={{ padding: "16px" }}>
                      <span style={{
                        padding: "4px 10px",
                        background: "rgba(95, 143, 94, 0.1)",
                        color: "var(--primary-accent)",
                        borderRadius: "12px",
                        fontSize: "0.82rem",
                        fontWeight: 600
                      }}>
                        {student.decksCount} {student.decksCount === 1 ? "Deck" : "Decks"}
                      </span>
                    </td>

                    {/* Focus Time */}
                    <td style={{ padding: "16px", fontWeight: 600, fontSize: "0.88rem", color: "var(--text-primary)" }}>
                      {student.formattedStudyTime}
                    </td>

                    {/* Tasks Completed */}
                    <td style={{ padding: "16px", fontSize: "0.86rem", color: "var(--text-secondary)" }}>
                      {student.completedTodos} / {student.totalTodos}
                    </td>

                    {/* Action Button */}
                    <td style={{ padding: "16px", textAlign: "right" }}>
                      <button
                        onClick={() => setSelectedStudent(student)}
                        style={{
                          padding: "6px 14px",
                          background: "var(--bg-color)",
                          border: "1px solid var(--glass-border)",
                          borderRadius: "var(--radius-sm)",
                          fontSize: "0.82rem",
                          fontWeight: 600,
                          color: "var(--text-primary)",
                          cursor: "pointer",
                          transition: "all 0.15s"
                        }}
                      >
                        Inspect Decks
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" style={{ padding: "48px 16px", textAlign: "center", color: "var(--text-secondary)" }}>
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

      {/* Inspect Student Modal */}
      {selectedStudent && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.5)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
          zIndex: 9999
        }}>
          <div style={{
            background: "var(--bg-surface)",
            borderRadius: "var(--radius-xl)",
            width: "100%",
            maxWidth: "640px",
            maxHeight: "85vh",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: "0 20px 40px rgba(0, 0, 0, 0.15)",
            border: "1px solid var(--glass-border)"
          }}>
            {/* Modal Header */}
            <div style={{
              padding: "20px 24px",
              borderBottom: "1px solid var(--glass-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}>
              <div>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-primary)" }}>
                  {selectedStudent.name}
                </h3>
                <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                  @{selectedStudent.username} • {selectedStudent.email}
                </p>
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
              {/* Quick Summary Strip */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "12px",
                marginBottom: "24px"
              }}>
                <div style={{ padding: "12px", background: "var(--bg-color)", borderRadius: "var(--radius-md)", textAlign: "center" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600 }}>Total Study Time</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", marginTop: "2px" }}>
                    {selectedStudent.formattedStudyTime}
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
                style={{
                  padding: "8px 20px",
                  background: "var(--primary-accent)",
                  color: "#ffffff",
                  borderRadius: "var(--radius-md)",
                  border: "none",
                  fontSize: "0.88rem",
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                Close Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
