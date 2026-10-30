export default async function ShowcasePreviewPage({ searchParams }) {
  const sp = await searchParams;
  const view = sp?.view || "dashboard";

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f4f7f4", display: "flex", fontFamily: "var(--font-geist-sans), -apple-system, BlinkMacSystemFont, sans-serif", color: "#1e293b" }}>
      {/* Sidebar Mockup */}
      <aside style={{ width: "240px", backgroundColor: "#ffffff", borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column", padding: "1.5rem 1.25rem", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "2rem" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "linear-gradient(135deg, #27522d, #4e8253)", display: "flex", alignItems: "center", justifyContent: "center", color: "#ffffff", fontWeight: 800, fontSize: "1.1rem" }}>
            iF
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: "1.15rem", color: "#1b4324", letterSpacing: "-0.02em" }}>iFocus</div>
            <div style={{ fontSize: "0.72rem", color: "#64748b" }}>Smart Study Hub</div>
          </div>
        </div>

        <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.65rem", paddingLeft: "8px" }}>
          Menu
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {[
            { id: "dashboard", label: "Home", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
            { id: "flashcards", label: "Flashcards", icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" },
            { id: "analytics", label: "Analytics", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
            { id: "coach", label: "AI Coach", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
            { id: "settings", label: "Settings", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" }
          ].map(item => {
            const isActive = item.id === view;
            return (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "0.65rem 0.9rem",
                  borderRadius: "10px",
                  backgroundColor: isActive ? "#eaf2eb" : "transparent",
                  color: isActive ? "#1b4324" : "#475569",
                  fontWeight: isActive ? 700 : 500,
                  fontSize: "0.9rem"
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={item.icon}></path>
                </svg>
                <span>{item.label}</span>
                {isActive && <div style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#27522d", marginLeft: "auto" }}></div>}
              </div>
            );
          })}
        </nav>

        {/* User Card */}
        <div style={{ marginTop: "auto", paddingTop: "1rem", borderTop: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "38px", height: "38px", borderRadius: "50%", backgroundColor: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#1b4324", overflow: "hidden", border: "2px solid #27522d" }}>
            <span style={{ fontSize: "0.85rem" }}>RC</span>
          </div>
          <div style={{ overflow: "hidden" }}>
            <div style={{ fontWeight: 700, fontSize: "0.86rem", color: "#0f172a", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>Richard Cunanan</div>
            <div style={{ fontSize: "0.72rem", color: "#64748b" }}>Student / Scholar</div>
          </div>
        </div>
      </aside>

      {/* Main Showcase Panel */}
      <main style={{ flex: 1, padding: "1.75rem 2rem", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {/* VIEW 1: DASHBOARD COMMAND CENTER */}
        {view === "dashboard" && (
          <div style={{ display: "grid", gridTemplateColumns: "310px 1fr 340px", gap: "1.35rem", height: "100%", maxHeight: "850px" }}>
            {/* Column 1: Tasks */}
            <div style={{ backgroundColor: "#ffffff", borderRadius: "20px", padding: "1.35rem", boxShadow: "0 4px 20px -2px rgba(0,0,0,0.05)", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.18rem", fontWeight: 800, color: "#0f172a" }}>Tasks List</h3>
                  <div style={{ fontSize: "0.76rem", color: "#64748b" }}>1/4 Done</div>
                </div>
                <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "#166534", backgroundColor: "#eaf5ea", padding: "3px 8px", borderRadius: "6px" }}>Cloud Synced</span>
              </div>

              {/* Add Input */}
              <div style={{ display: "flex", gap: "6px", marginBottom: "1rem" }}>
                <input
                  readOnly
                  value="Review pharmacology dosage calculations..."
                  style={{ flex: 1, padding: "0.55rem 0.75rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.78rem", backgroundColor: "#f8fafc", color: "#64748b" }}
                />
                <button style={{ padding: "0.55rem 0.85rem", backgroundColor: "#27522d", color: "#ffffff", borderRadius: "8px", border: "none", fontWeight: 600, fontSize: "0.78rem" }}>+ Add</button>
              </div>

              {/* Filter tabs */}
              <div style={{ display: "flex", gap: "6px", marginBottom: "0.85rem" }}>
                <span style={{ padding: "3px 8px", backgroundColor: "#f1f5f9", borderRadius: "6px", fontSize: "0.74rem", fontWeight: 700, color: "#1e293b" }}>All (4)</span>
                <span style={{ padding: "3px 8px", backgroundColor: "transparent", borderRadius: "6px", fontSize: "0.74rem", color: "#64748b" }}>Active (3)</span>
                <span style={{ padding: "3px 8px", backgroundColor: "transparent", borderRadius: "6px", fontSize: "0.74rem", color: "#64748b" }}>Done (1)</span>
              </div>

              {/* Tasks List */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {[
                  { text: "Drug Dosage Calculations Practice", priority: "High", done: true, pColor: "#dc2626", pBg: "#fee2e2" },
                  { text: "Cardiovascular Anatomy & Physiology", priority: "High", done: false, pColor: "#dc2626", pBg: "#fee2e2" },
                  { text: "Post-Op Surgical Interventions", priority: "Med", done: false, pColor: "#d97706", pBg: "#fef3c7" },
                  { text: "Pediatric Charting & Milestones", priority: "Low", done: false, pColor: "#2563eb", pBg: "#dbeafe" }
                ].map((t, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.65rem 0.75rem", backgroundColor: t.done ? "#f8fafc" : "#ffffff", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ width: "16px", height: "16px", borderRadius: "4px", border: t.done ? "none" : "1.5px solid #cbd5e1", backgroundColor: t.done ? "#27522d" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#ffffff", fontSize: "10px" }}>
                        {t.done && "✓"}
                      </div>
                      <span style={{ fontSize: "0.8rem", fontWeight: 500, color: t.done ? "#94a3b8" : "#1e293b", textDecoration: t.done ? "line-through" : "none" }}>{t.text}</span>
                    </div>
                    <span style={{ fontSize: "0.68rem", fontWeight: 700, color: t.pColor, backgroundColor: t.pBg, padding: "2px 6px", borderRadius: "4px" }}>{t.priority}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Column 2: Focus Timer Centerpiece */}
            <div style={{ backgroundColor: "#ffffff", borderRadius: "20px", padding: "1.5rem", boxShadow: "0 4px 20px -2px rgba(0,0,0,0.05)", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between" }}>
              {/* Soundscape pill */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "0.45rem 1.1rem", borderRadius: "9999px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "0.9rem" }}>♫</span>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#1e293b" }}>Chill Lofi</div>
                  <div style={{ fontSize: "0.68rem", color: "#64748b" }}>Audio • Soundscapes</div>
                </div>
                <div style={{ width: "22px", height: "22px", borderRadius: "50%", backgroundColor: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px" }}>▶</div>
              </div>

              {/* Mode switch */}
              <div style={{ display: "flex", gap: "6px", backgroundColor: "#f1f5f9", padding: "4px", borderRadius: "9999px" }}>
                <span style={{ padding: "4px 14px", borderRadius: "9999px", backgroundColor: "#ffffff", color: "#1b4324", fontWeight: 700, fontSize: "0.78rem", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>Ongoing</span>
                <span style={{ padding: "4px 14px", borderRadius: "9999px", color: "#64748b", fontWeight: 500, fontSize: "0.78rem" }}>Break</span>
              </div>

              {/* BreakGate active badge */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", color: "#166534", backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", padding: "3px 10px", borderRadius: "9999px" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#16a34a" }}></span>
                <span>BreakGate: Active (Card Recall Armed)</span>
              </div>

              {/* Circular Timer Centerpiece */}
              <div style={{ position: "relative", width: "220px", height: "220px", borderRadius: "50%", background: "conic-gradient(#27522d 0%, #eaf1ea 0deg)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 32px -6px rgba(39, 82, 45, 0.2)" }}>
                <div style={{ width: "196px", height: "196px", borderRadius: "50%", backgroundColor: "#ffffff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", boxShadow: "inset 0 2px 8px rgba(0,0,0,0.04)" }}>
                  <div style={{ fontSize: "3.2rem", fontWeight: 800, color: "#1e293b", letterSpacing: "-0.04em", lineHeight: 1 }}>25:00</div>
                  <div style={{ fontSize: "0.74rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: "6px" }}>Focus Time</div>
                </div>
              </div>

              {/* Start Button */}
              <button style={{ padding: "0.75rem 2.8rem", borderRadius: "9999px", backgroundColor: "#27522d", color: "#ffffff", border: "none", fontWeight: 700, fontSize: "1rem", cursor: "pointer", boxShadow: "0 4px 14px rgba(39, 82, 45, 0.35)", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>▶ Start</span>
              </button>

              {/* Presets */}
              <div style={{ display: "flex", gap: "8px" }}>
                {["25/5", "50/10", "15/3", "90/20"].map(p => (
                  <span key={p} style={{ padding: "4px 12px", borderRadius: "9999px", backgroundColor: p === "25/5" ? "#27522d" : "#f1f5f9", color: p === "25/5" ? "#ffffff" : "#475569", fontWeight: 700, fontSize: "0.76rem" }}>
                    {p}
                  </span>
                ))}
              </div>

              <div style={{ fontSize: "0.74rem", color: "#64748b" }}>Session 1 of 4</div>
            </div>

            {/* Column 3: Daily Progress & Quick Reflection */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
              {/* Daily Progress */}
              <div style={{ backgroundColor: "#ffffff", borderRadius: "20px", padding: "1.25rem", boxShadow: "0 4px 20px -2px rgba(0,0,0,0.05)", border: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.85rem" }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#0f172a" }}>Daily Progress</h3>
                    <div style={{ fontSize: "0.76rem", color: "#64748b" }}>1/4 Tasks was done</div>
                  </div>
                  <div style={{ width: "48px", height: "48px", borderRadius: "50%", border: "4px solid #e2e8f0", borderTopColor: "#27522d", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "0.82rem", color: "#1b4324" }}>
                    25%
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px", backgroundColor: "#f8fafc", padding: "8px", borderRadius: "12px", textAlign: "center" }}>
                  <div>
                    <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Focus</div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#27522d" }}>45m</div>
                  </div>
                  <div style={{ borderLeft: "1px solid #e2e8f0", borderRight: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Sessions</div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#2563eb" }}>3</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Streak</div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#d97706" }}>4 Days</div>
                  </div>
                </div>

                <div style={{ marginTop: "0.85rem", padding: "0.65rem 0.8rem", backgroundColor: "#f0fdf4", borderRadius: "10px", border: "1px solid #bbf7d0" }}>
                  <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#166534", textTransform: "uppercase" }}>Daily Mindset</div>
                  <div style={{ fontSize: "0.78rem", color: "#1b4324", fontStyle: "italic", marginTop: "2px" }}>&quot;Focus is saying no to 1,000 other good ideas.&quot; — Steve Jobs</div>
                </div>
              </div>

              {/* Quick Reflection */}
              <div style={{ backgroundColor: "#ffffff", borderRadius: "20px", padding: "1.25rem", boxShadow: "0 4px 20px -2px rgba(0,0,0,0.05)", border: "1px solid #e2e8f0", flex: 1, display: "flex", flexDirection: "column" }}>
                <h3 style={{ margin: "0 0 4px 0", fontSize: "1.1rem", fontWeight: 800, color: "#0f172a" }}>Quick Reflection</h3>
                <div style={{ fontSize: "0.74rem", color: "#64748b", marginBottom: "0.65rem" }}>Clear your mind. AI will adapt your pacing.</div>

                <div style={{ display: "flex", gap: "4px", fontSize: "0.68rem", color: "#166534", backgroundColor: "#f0fdf4", padding: "4px 8px", borderRadius: "6px", marginBottom: "0.65rem" }}>
                  <span>Flight: 118ms</span> &bull; <span>Dwell: 142ms</span> &bull; <span>BS: 0 (0%)</span> &bull; <strong style={{ color: "#27522d" }}>Ready</strong>
                </div>

                <textarea
                  readOnly
                  value="Feeling energetic and ready to conquer pharmacology drug calculations."
                  style={{ flex: 1, minHeight: "75px", padding: "0.65rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.78rem", backgroundColor: "#f8fafc", color: "#1e293b", resize: "none", marginBottom: "0.65rem" }}
                />

                <button style={{ padding: "0.65rem", backgroundColor: "#27522d", color: "#ffffff", borderRadius: "10px", border: "none", fontWeight: 700, fontSize: "0.82rem" }}>
                  Submit &amp; Analyze
                </button>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: FLASHCARDS STUDIO */}
        {view === "flashcards" && (
          <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: "1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 style={{ fontSize: "1.55rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>My Flashcard Collections</h2>
                <div style={{ fontSize: "0.84rem", color: "#64748b" }}>Review your generated study decks or create a new one from notes or PDF.</div>
              </div>
              <button style={{ padding: "0.65rem 1.35rem", backgroundColor: "#27522d", color: "#ffffff", borderRadius: "10px", border: "none", fontWeight: 700, fontSize: "0.88rem", display: "flex", alignItems: "center", gap: "6px" }}>
                <span>+ Create New Deck</span>
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1.25rem", flex: 1 }}>
              {[
                { title: "Pharmacology & Drug Calculations", count: "42 Cards", date: "Oct 28, 2026", activeGate: true, mastered: "28/42 (67%)", desc: "Covers IV flow rates, pediatric dosages, beta-blockers, and opioid protocols." },
                { title: "Medical-Surgical Nursing Care", count: "38 Cards", date: "Oct 25, 2026", activeGate: false, mastered: "18/38 (47%)", desc: "Post-op wound management, cardiac arrhythmias, and fluid electrolyte balance." },
                { title: "Fundamentals of Nursing & Vitals", count: "24 Cards", date: "Oct 22, 2026", activeGate: false, mastered: "20/24 (83%)", desc: "Normal vital signs ranges, sterile field techniques, and PPE sequencing." },
                { title: "Maternal & Child Health Nursing", count: "30 Cards", date: "Oct 19, 2026", activeGate: false, mastered: "12/30 (40%)", desc: "Stages of labor, APGAR score criteria, and newborn physical reflexes." }
              ].map((deck, i) => (
                <div key={i} style={{ backgroundColor: "#ffffff", borderRadius: "18px", padding: "1.4rem", boxShadow: "0 4px 20px -2px rgba(0,0,0,0.05)", border: deck.activeGate ? "2px solid #27522d" : "1px solid #e2e8f0", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                      <div style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: deck.activeGate ? "#eaf5ea" : "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", color: deck.activeGate ? "#27522d" : "#64748b", fontWeight: 800 }}>
                        🗂
                      </div>
                      {deck.activeGate && (
                        <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#166534", backgroundColor: "#eaf5ea", border: "1px solid #bbf7d0", padding: "3px 9px", borderRadius: "9999px" }}>
                          Active BreakGate
                        </span>
                      )}
                    </div>
                    <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#0f172a", margin: "0 0 4px 0" }}>{deck.title}</h3>
                    <div style={{ fontSize: "0.76rem", color: "#64748b", marginBottom: "0.65rem" }}>{deck.count} &bull; {deck.date}</div>
                    <p style={{ fontSize: "0.82rem", color: "#475569", lineHeight: 1.4, margin: "0 0 1rem 0" }}>{deck.desc}</p>
                  </div>

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.76rem", color: "#64748b", marginBottom: "4px" }}>
                      <span>Mastery Progress</span>
                      <strong style={{ color: "#27522d" }}>{deck.mastered}</strong>
                    </div>
                    <div style={{ width: "100%", height: "6px", backgroundColor: "#f1f5f9", borderRadius: "9999px", overflow: "hidden", marginBottom: "1rem" }}>
                      <div style={{ width: deck.mastered.split("(")[1].replace(")", ""), height: "100%", backgroundColor: "#27522d" }}></div>
                    </div>

                    <div style={{ display: "flex", gap: "8px" }}>
                      <button style={{ flex: 1, padding: "0.55rem", backgroundColor: "#27522d", color: "#ffffff", border: "none", borderRadius: "8px", fontWeight: 700, fontSize: "0.82rem" }}>📖 Study Deck</button>
                      <button style={{ flex: 1, padding: "0.55rem", backgroundColor: "#f8fafc", color: "#1e293b", border: "1px solid #cbd5e1", borderRadius: "8px", fontWeight: 700, fontSize: "0.82rem" }}>✍ Practice Exam</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VIEW 3: STUDY ANALYTICS */}
        {view === "analytics" && (
          <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: "1.1rem" }}>
            <div>
              <h2 style={{ fontSize: "1.55rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>Study Analytics</h2>
              <div style={{ fontSize: "0.84rem", color: "#64748b" }}>Your real-time Pomodoro focus metrics, BreakGate compliance, and retention health.</div>
            </div>

            {/* Top 4 Stat Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1.1rem" }}>
              {[
                { title: "Today's Focus", value: "45m", sub: "Total completed today", color: "#27522d" },
                { title: "This Week", value: "3.8h", sub: "Across 8 sessions", color: "#2563eb" },
                { title: "Study Streak", value: "4 Days", sub: "Consecutive active study", color: "#d97706" },
                { title: "Mastered Concepts", value: "28 Cards", sub: "67% of 42 total cards", color: "#16a34a" }
              ].map((s, i) => (
                <div key={i} style={{ backgroundColor: "#ffffff", borderRadius: "16px", padding: "1.1rem 1.25rem", boxShadow: "0 4px 18px -2px rgba(0,0,0,0.04)", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>{s.title}</div>
                  <div style={{ fontSize: "1.75rem", fontWeight: 800, color: s.color, margin: "4px 0" }}>{s.value}</div>
                  <div style={{ fontSize: "0.74rem", color: "#94a3b8" }}>{s.sub}</div>
                </div>
              ))}
            </div>

            {/* 2-Column Split: Activity Chart & Compliance */}
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "1.1rem" }}>
              {/* Chart */}
              <div style={{ backgroundColor: "#ffffff", borderRadius: "18px", padding: "1.35rem", boxShadow: "0 4px 18px -2px rgba(0,0,0,0.04)", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#0f172a" }}>Weekly Focus Activity</h3>
                    <div style={{ fontSize: "0.74rem", color: "#64748b" }}>Measured in completed daily focus intervals (Green indicates today).</div>
                  </div>
                  <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "#27522d", backgroundColor: "#eaf5ea", padding: "3px 9px", borderRadius: "6px" }}>3.8h Total</span>
                </div>

                {/* Simulated CSS Bar Chart */}
                <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", height: "155px", padding: "0.5rem 1rem", borderBottom: "1px solid #e2e8f0", gap: "12px" }}>
                  {[
                    { day: "Mon", px: "80px", val: "40m", today: false },
                    { day: "Tue", px: "100px", val: "50m", today: false },
                    { day: "Wed", px: "125px", val: "60m", today: false },
                    { day: "Thu", px: "60px", val: "30m", today: false },
                    { day: "Fri", px: "90px", val: "45m", today: true },
                    { day: "Sat", px: "15px", val: "0m", today: false },
                    { day: "Sun", px: "15px", val: "0m", today: false }
                  ].map((b, i) => (
                    <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: "6px", flex: 1, height: "100%" }}>
                      <span style={{ fontSize: "0.68rem", fontWeight: 700, color: b.today ? "#27522d" : "#94a3b8" }}>{b.val}</span>
                      <div style={{ width: "100%", maxWidth: "34px", height: b.px, backgroundColor: b.today ? "#27522d" : "#86efac", borderRadius: "6px 6px 0 0" }}></div>
                      <span style={{ fontSize: "0.72rem", fontWeight: b.today ? 800 : 600, color: b.today ? "#27522d" : "#64748b" }}>{b.day}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Compliance & Cognitive Fatigue */}
              <div style={{ backgroundColor: "#ffffff", borderRadius: "18px", padding: "1.35rem", boxShadow: "0 4px 18px -2px rgba(0,0,0,0.04)", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#0f172a" }}>BreakGate Compliance</h3>
                  <div style={{ fontSize: "0.74rem", color: "#64748b" }}>Cognitive pacing and recovery telemetry.</div>
                </div>

                <div style={{ padding: "0.75rem", backgroundColor: "#f0fdf4", borderRadius: "12px", border: "1px solid #bbf7d0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#166534" }}>Gate Compliance</span>
                    <span style={{ fontSize: "0.76rem", fontWeight: 800, color: "#15803d", backgroundColor: "#dcfce7", padding: "2px 8px", borderRadius: "4px" }}>100% On-Track</span>
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "#166534", marginTop: "3px" }}>3 of 3 recall challenges completed today</div>
                </div>

                <div style={{ padding: "0.75rem", backgroundColor: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#1e293b" }}>Focus-to-Rest Ratio</span>
                    <span style={{ fontSize: "0.76rem", fontWeight: 800, color: "#27522d" }}>5:1 (Optimal)</span>
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "3px" }}>Active micro-rest pacing (25m / 5m)</div>
                </div>

                <div style={{ padding: "0.75rem", backgroundColor: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#1e293b" }}>Cognitive Fatigue Status</span>
                    <span style={{ fontSize: "0.76rem", fontWeight: 800, color: "#059669" }}>Low (Resilient)</span>
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "3px" }}>Keystroke cadence &amp; stability optimal</div>
                </div>
              </div>
            </div>

            {/* Bottom Row: Recent Sessions & Recall Retention */}
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "1.1rem" }}>
              <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", padding: "1.1rem 1.25rem", boxShadow: "0 4px 18px -2px rgba(0,0,0,0.04)", border: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <span style={{ fontSize: "0.84rem", fontWeight: 700, color: "#0f172a" }}>Recent Study Sessions</span>
                  <span style={{ fontSize: "0.72rem", color: "#27522d", fontWeight: 600 }}>Open Timer →</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {[
                    { label: "25 min Pomodoro Focus Session", time: "Today, 4:30 PM" },
                    { label: "25 min Pomodoro Focus Session", time: "Today, 2:15 PM" }
                  ].map((rec, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0.65rem", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                      <div>
                        <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#1e293b" }}>{rec.label}</div>
                        <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>{rec.time}</div>
                      </div>
                      <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#15803d", backgroundColor: "#dcfce7", padding: "2px 6px", borderRadius: "4px" }}>COMPLETED</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", padding: "1.1rem 1.25rem", boxShadow: "0 4px 18px -2px rgba(0,0,0,0.04)", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <span style={{ fontSize: "0.84rem", fontWeight: 700, color: "#0f172a" }}>Active Recall Retention</span>
                  <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "2px" }}>Mastery distribution across study decks.</div>
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.74rem", marginBottom: "4px" }}>
                    <span style={{ color: "#64748b" }}>Mastered Concepts</span>
                    <strong style={{ color: "#27522d" }}>67%</strong>
                  </div>
                  <div style={{ width: "100%", height: "8px", backgroundColor: "#f1f5f9", borderRadius: "9999px", overflow: "hidden", marginBottom: "0.65rem" }}>
                    <div style={{ width: "67%", height: "100%", backgroundColor: "#27522d" }}></div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "#64748b" }}>
                    <span>Total Cards: <strong>42</strong></span>
                    <span>Mastered: <strong>28</strong></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 4: AI STUDY COACH */}
        {view === "coach" && (
          <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: "1.25rem" }}>
            <div>
              <h2 style={{ fontSize: "1.55rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>Your AI Study Coach</h2>
              <div style={{ fontSize: "0.84rem", color: "#64748b" }}>Adaptive cognitive telemetry, attention diagnostics, and personalized study strategies.</div>
            </div>

            {/* Top 3 Diagnostics */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.1rem" }}>
              <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", padding: "1.1rem", boxShadow: "0 4px 18px -2px rgba(0,0,0,0.04)", border: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Cognitive State</span>
                  <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#166534", backgroundColor: "#eaf5ea", padding: "2px 6px", borderRadius: "4px" }}>Optimal</span>
                </div>
                <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#27522d", margin: "4px 0" }}>In the Zone</div>
                <div style={{ fontSize: "0.72rem", color: "#64748b" }}>Silent observation: Attention levels optimal</div>
              </div>

              <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", padding: "1.1rem", boxShadow: "0 4px 18px -2px rgba(0,0,0,0.04)", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Study Resilience</span>
                <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#2563eb", margin: "4px 0" }}>92% Resilience</div>
                <div style={{ fontSize: "0.72rem", color: "#64748b" }}>BreakGate cycle compliance on track</div>
              </div>

              <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", padding: "1.1rem", boxShadow: "0 4px 18px -2px rgba(0,0,0,0.04)", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Recommended Rhythm</span>
                <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#d97706", margin: "4px 0" }}>25m Work / 5m Gate</div>
                <div style={{ fontSize: "0.72rem", color: "#64748b" }}>Prevents cognitive burnout during study</div>
              </div>
            </div>

            {/* Split: Strategy vs Journal */}
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "1.25rem", flex: 1 }}>
              {/* Adaptive Strategy */}
              <div style={{ backgroundColor: "#ffffff", borderRadius: "18px", padding: "1.35rem", boxShadow: "0 4px 18px -2px rgba(0,0,0,0.04)", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.85rem" }}>
                    <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#0f172a" }}>Adaptive Coaching Strategy</h3>
                    <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#27522d", backgroundColor: "#eaf5ea", padding: "3px 8px", borderRadius: "6px" }}>Active Observation</span>
                  </div>

                  <div style={{ padding: "0.85rem", backgroundColor: "#fef3c7", borderRadius: "12px", border: "1px solid #fde68a", marginBottom: "0.85rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ fontSize: "0.84rem", color: "#92400e" }}>Restorative Pacing Protocol</strong>
                      <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#92400e", backgroundColor: "#fde68a", padding: "2px 6px", borderRadius: "4px" }}>Energy Buffer</span>
                    </div>
                    <div style={{ fontSize: "0.76rem", color: "#78350f", marginTop: "4px", lineHeight: 1.4 }}>
                      Your current study resilience is optimal at 92%. Continue utilizing micro-rest intervals to prevent mental fatigue saturation.
                    </div>
                  </div>

                  <div style={{ padding: "0.85rem", backgroundColor: "#f0fdf4", borderRadius: "12px", border: "1px solid #bbf7d0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ fontSize: "0.84rem", color: "#166534" }}>BreakGate Memory Consolidation</strong>
                      <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#166534", backgroundColor: "#bbf7d0", padding: "2px 6px", borderRadius: "4px" }}>High Recall</span>
                    </div>
                    <div style={{ fontSize: "0.76rem", color: "#1b4324", marginTop: "4px", lineHeight: 1.4 }}>
                      Active recall performance on Pharmacology cards indicates high concept mastery. Recommended to keep 3-question recall gates active.
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px", marginTop: "1rem" }}>
                  <button style={{ flex: 1, padding: "0.65rem", backgroundColor: "#27522d", color: "#ffffff", border: "none", borderRadius: "10px", fontWeight: 700, fontSize: "0.84rem" }}>
                    Apply Strategy to Dashboard
                  </button>
                  <button style={{ padding: "0.65rem 1.25rem", backgroundColor: "#f8fafc", color: "#64748b", border: "1px solid #cbd5e1", borderRadius: "10px", fontWeight: 600, fontSize: "0.84rem" }}>
                    Dismiss
                  </button>
                </div>
              </div>

              {/* Reflection Journal Log */}
              <div style={{ backgroundColor: "#ffffff", borderRadius: "18px", padding: "1.35rem", boxShadow: "0 4px 18px -2px rgba(0,0,0,0.04)", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.85rem" }}>
                  <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#0f172a" }}>Reflection Journal &amp; Sentiment</h3>
                  <span style={{ fontSize: "0.72rem", color: "#64748b" }}>3 Entries</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px", overflow: "hidden" }}>
                  {[
                    { time: "Today, 4:15 PM", text: "Feeling energetic and ready to conquer pharmacology drug calculations.", tag: "Engaged", reply: "Great cognitive readiness! Keep this focused pace." },
                    { time: "Oct 29, 3:30 PM", text: "Took a quick 5m break and my focus feels fully restored.", tag: "Motivated", reply: "Micro-rest intervals successfully reset your cognitive baseline." },
                    { time: "Oct 28, 5:00 PM", text: "Finished all pediatric developmental milestones cards without friction.", tag: "Flow", reply: "High retention achieved. Ready for the next review cycle." }
                  ].map((j, i) => (
                    <div key={i} style={{ padding: "0.75rem", backgroundColor: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3px" }}>
                        <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>{j.time}</span>
                        <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#166534", backgroundColor: "#eaf5ea", padding: "1px 6px", borderRadius: "4px" }}>{j.tag}</span>
                      </div>
                      <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#1e293b", marginBottom: "4px" }}>{j.text}</div>
                      <div style={{ fontSize: "0.72rem", color: "#475569", fontStyle: "italic", borderLeft: "2px solid #27522d", paddingLeft: "6px" }}>AI: {j.reply}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
