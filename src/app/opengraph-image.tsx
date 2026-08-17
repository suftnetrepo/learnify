import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt     = "Learnify — Premium Learning Platform";
export const size    = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: "linear-gradient(135deg, #0d0d1a 0%, #111126 50%, #1a1050 100%)",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
        }}
      >
        {/* Grid dots */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "radial-gradient(circle, rgba(99,102,241,0.15) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }} />

        {/* Glow */}
        <div style={{
          position: "absolute", width: 600, height: 600,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 70%)",
          top: -200, left: -100,
        }} />

        {/* Logo area */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 40 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: "#6366f1",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ color: "white", fontSize: 32 }}>✦</span>
          </div>
          <span style={{ color: "white", fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>
            Learnify
          </span>
        </div>

        {/* Headline */}
        <div style={{
          color: "white",
          fontSize: 64,
          fontWeight: 800,
          textAlign: "center",
          lineHeight: 1.1,
          letterSpacing: -2,
          maxWidth: 900,
        }}>
          Premium Learning Platform
        </div>

        {/* Subtext */}
        <div style={{
          color: "#9ca3af",
          fontSize: 28,
          marginTop: 20,
          textAlign: "center",
        }}>
          Expert-led courses · Learn at your pace · Advance your career
        </div>

        {/* Stats row */}
        <div style={{
          display: "flex", gap: 60, marginTop: 60,
          borderTop: "1px solid rgba(255,255,255,0.1)",
          paddingTop: 40,
        }}>
          {[["50k+", "Students"], ["500+", "Courses"], ["4.9/5", "Rating"]].map(([v, l]) => (
            <div key={l} style={{ textAlign: "center", display: "flex", flexDirection: "column" }}>
              <span style={{ color: "white", fontSize: 32, fontWeight: 700 }}>{v}</span>
              <span style={{ color: "#6b7280", fontSize: 16, marginTop: 4 }}>{l}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
