import { useMemo, useState } from "react";

const palette = {
  page: "#0b1020",
  panel: "#11182d",
  panelSoft: "#18223f",
  line: "rgba(255, 255, 255, 0.08)",
  text: "#f6f8ff",
  muted: "#95a2c9",
  blue: "#6aa5ff",
  cyan: "#69e3ff",
  green: "#5dd39e",
  amber: "#ffbf69",
  pink: "#ff7ab6",
};

const initialHabits = [
  { id: 1, label: "Morning walk", done: true, streak: 8 },
  { id: 2, label: "Water goal", done: true, streak: 12 },
  { id: 3, label: "Deep work block", done: false, streak: 5 },
  { id: 4, label: "Read 20 minutes", done: false, streak: 3 },
];

const week = [
  { day: "Mon", value: 82 },
  { day: "Tue", value: 64 },
  { day: "Wed", value: 88 },
  { day: "Thu", value: 54 },
  { day: "Fri", value: 91 },
  { day: "Sat", value: 70 },
  { day: "Sun", value: 76 },
];

const tasks = [
  { title: "Finish Q2 roadmap", time: "09:00", tone: palette.blue },
  { title: "1:1 with design", time: "13:30", tone: palette.cyan },
  { title: "Review weekly targets", time: "16:00", tone: palette.pink },
];

function Card({ title, eyebrow, children, style }) {
  return (
    <section
      style={{
        background: `linear-gradient(180deg, ${palette.panelSoft}, ${palette.panel})`,
        border: `1px solid ${palette.line}`,
        borderRadius: 24,
        padding: 20,
        boxShadow: "0 24px 60px rgba(0, 0, 0, 0.28)",
        ...style,
      }}
    >
      {(eyebrow || title) && (
        <div style={{ marginBottom: 16 }}>
          {eyebrow && (
            <div
              style={{
                color: palette.muted,
                fontSize: 11,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              {eyebrow}
            </div>
          )}
          {title && (
            <h2
              style={{
                margin: 0,
                color: palette.text,
                fontSize: 20,
                fontWeight: 700,
              }}
            >
              {title}
            </h2>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

function Metric({ label, value, tone }) {
  return (
    <div
      style={{
        background: "rgba(255, 255, 255, 0.04)",
        border: `1px solid ${palette.line}`,
        borderRadius: 18,
        padding: 16,
      }}
    >
      <div style={{ color: palette.muted, fontSize: 12 }}>{label}</div>
      <div style={{ color: tone || palette.text, fontSize: 28, fontWeight: 700, marginTop: 8 }}>
        {value}
      </div>
    </div>
  );
}

export default function TrackerDashboard() {
  const [habits, setHabits] = useState(initialHabits);

  const completed = useMemo(
    () => habits.filter((habit) => habit.done).length,
    [habits]
  );

  const progress = Math.round((completed / habits.length) * 100);

  const toggleHabit = (id) => {
    setHabits((current) =>
      current.map((habit) =>
        habit.id === id ? { ...habit, done: !habit.done } : habit
      )
    );
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(105, 227, 255, 0.16), transparent 28%), radial-gradient(circle at top right, rgba(255, 122, 182, 0.16), transparent 30%), linear-gradient(180deg, #09101f 0%, #0b1020 100%)",
        color: palette.text,
        padding: 24,
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <Card style={{ marginBottom: 24, padding: 24 }}>
          <div
            style={{
              display: "grid",
              gap: 20,
              gridTemplateColumns: "minmax(0, 1.4fr) minmax(260px, 0.6fr)",
              alignItems: "center",
            }}
          >
            <div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 12px",
                  borderRadius: 999,
                  background: "rgba(255, 255, 255, 0.05)",
                  border: `1px solid ${palette.line}`,
                  color: palette.muted,
                  fontSize: 12,
                  marginBottom: 18,
                }}
              >
                <img
                  src="/icon-192.png"
                  alt="Tracker app icon"
                  style={{ width: 24, height: 24, borderRadius: 6 }}
                />
                Personal tracker workspace
              </div>

              <h1
                style={{
                  margin: 0,
                  fontSize: "clamp(2.2rem, 4vw, 3.8rem)",
                  lineHeight: 1,
                }}
              >
                Track your day
                <br />
                without losing the signal.
              </h1>

              <p
                style={{
                  color: palette.muted,
                  fontSize: 16,
                  lineHeight: 1.6,
                  maxWidth: 620,
                  margin: "16px 0 0",
                }}
              >
                A focused dashboard for habits, targets, and daily momentum.
                The two images in your Vite public folder are used here as the
                dashboard brand mark and the hero card artwork.
              </p>
            </div>

            <div
              style={{
                background: "rgba(255, 255, 255, 0.04)",
                border: `1px solid ${palette.line}`,
                borderRadius: 24,
                padding: 18,
              }}
            >
              <img
                src="/icon-512.png"
                alt="Tracker dashboard artwork"
                style={{
                  width: "100%",
                  aspectRatio: "1 / 1",
                  objectFit: "cover",
                  borderRadius: 20,
                  display: "block",
                  marginBottom: 16,
                }}
              />
              <div style={{ color: palette.muted, fontSize: 12, marginBottom: 8 }}>
                Today&apos;s completion
              </div>
              <div style={{ fontSize: 34, fontWeight: 700 }}>{progress}%</div>
            </div>
          </div>
        </Card>

        <div
          style={{
            display: "grid",
            gap: 24,
            gridTemplateColumns: "1.15fr 0.85fr",
          }}
        >
          <div style={{ display: "grid", gap: 24 }}>
            <Card title="Overview" eyebrow="Daily stats">
              <div
                style={{
                  display: "grid",
                  gap: 16,
                  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                }}
              >
                <Metric label="Habits done" value={`${completed}/${habits.length}`} tone={palette.green} />
                <Metric label="Focus score" value="84%" tone={palette.blue} />
                <Metric label="Streak" value="12 days" tone={palette.amber} />
                <Metric label="Tasks left" value="3" tone={palette.pink} />
              </div>
            </Card>

            <Card title="Habit tracker" eyebrow="Interactive list">
              <div style={{ display: "grid", gap: 12 }}>
                {habits.map((habit) => (
                  <button
                    key={habit.id}
                    onClick={() => toggleHabit(habit.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 16,
                      width: "100%",
                      textAlign: "left",
                      padding: 16,
                      borderRadius: 18,
                      border: `1px solid ${palette.line}`,
                      background: habit.done
                        ? "rgba(93, 211, 158, 0.12)"
                        : "rgba(255, 255, 255, 0.04)",
                      color: palette.text,
                      cursor: "pointer",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 600 }}>{habit.label}</div>
                      <div style={{ color: palette.muted, fontSize: 12, marginTop: 6 }}>
                        Current streak: {habit.streak} days
                      </div>
                    </div>
                    <div
                      style={{
                        minWidth: 86,
                        textAlign: "center",
                        padding: "8px 12px",
                        borderRadius: 999,
                        background: habit.done ? palette.green : "rgba(255, 255, 255, 0.06)",
                        color: habit.done ? "#08120d" : palette.muted,
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {habit.done ? "Done" : "Pending"}
                    </div>
                  </button>
                ))}
              </div>
            </Card>

            <Card title="Weekly activity" eyebrow="Trend">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                  gap: 12,
                  alignItems: "end",
                  minHeight: 220,
                }}
              >
                {week.map((item) => (
                  <div key={item.day} style={{ textAlign: "center" }}>
                    <div
                      style={{
                        height: `${item.value * 1.6}px`,
                        minHeight: 24,
                        borderRadius: 18,
                        background: `linear-gradient(180deg, ${palette.cyan}, ${palette.blue})`,
                        border: `1px solid rgba(255, 255, 255, 0.08)`,
                      }}
                    />
                    <div style={{ color: palette.muted, fontSize: 12, marginTop: 10 }}>
                      {item.day}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div style={{ display: "grid", gap: 24 }}>
            <Card title="Schedule" eyebrow="Today">
              <div style={{ display: "grid", gap: 14 }}>
                {tasks.map((task) => (
                  <div
                    key={task.title}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "76px 1fr",
                      gap: 14,
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        padding: "10px 12px",
                        borderRadius: 14,
                        background: "rgba(255, 255, 255, 0.05)",
                        color: palette.text,
                        fontWeight: 700,
                        textAlign: "center",
                      }}
                    >
                      {task.time}
                    </div>
                    <div
                      style={{
                        padding: "14px 16px",
                        borderRadius: 16,
                        border: `1px solid ${palette.line}`,
                        background: "rgba(255, 255, 255, 0.03)",
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{task.title}</div>
                      <div style={{ color: task.tone, fontSize: 12, marginTop: 6 }}>
                        Priority slot
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Goals" eyebrow="This week">
              <div style={{ display: "grid", gap: 16 }}>
                {[
                  ["Launch update", 72, palette.blue],
                  ["Sleep target", 58, palette.green],
                  ["Workout plan", 91, palette.pink],
                ].map(([label, value, tone]) => (
                  <div key={label}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 8,
                        color: palette.text,
                        fontSize: 14,
                      }}
                    >
                      <span>{label}</span>
                      <span style={{ color: palette.muted }}>{value}%</span>
                    </div>
                    <div
                      style={{
                        height: 10,
                        borderRadius: 999,
                        background: "rgba(255, 255, 255, 0.06)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${value}%`,
                          height: "100%",
                          borderRadius: 999,
                          background: tone,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Notes" eyebrow="Quick capture">
              <textarea
                rows={8}
                placeholder="Write the one thing that matters today..."
                style={{
                  width: "100%",
                  resize: "vertical",
                  background: "rgba(255, 255, 255, 0.04)",
                  color: palette.text,
                  border: `1px solid ${palette.line}`,
                  borderRadius: 18,
                  padding: 16,
                  outline: "none",
                  font: "inherit",
                }}
              />
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
