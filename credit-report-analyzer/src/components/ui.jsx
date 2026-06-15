import { useEffect, useState } from "react";
import { ACCENT, BORDER, CARD, BG, MONO, scoreColor, scoreBand } from "../theme";

export function Card({ children, style }) {
  return (
    <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, background: CARD, ...style }}>
      {children}
    </div>
  );
}

export function SectionTitle({ kicker, title, sub }) {
  return (
    <div style={{ marginBottom: "1.25rem" }}>
      {kicker && (
        <div style={{ fontSize: "0.65rem", color: ACCENT, letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 600, marginBottom: "0.4rem" }}>
          {kicker}
        </div>
      )}
      <h2 style={{ fontSize: "1.3rem", fontWeight: 700, margin: 0, color: "#fff" }}>{title}</h2>
      {sub && <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.88rem", margin: "0.5rem 0 0", lineHeight: 1.6 }}>{sub}</p>}
    </div>
  );
}

export function Button({ children, onClick, variant = "primary", style, ...rest }) {
  const variants = {
    primary: { background: ACCENT, border: "none", color: "#0a0a0a", fontWeight: 700 },
    ghost: { background: "transparent", border: `1px solid rgba(201,169,110,0.35)`, color: ACCENT },
    muted: { background: "transparent", border: `1px solid ${BORDER}`, color: "rgba(255,255,255,0.45)" },
  };
  return (
    <button
      onClick={onClick}
      style={{ padding: "0.7rem 1.4rem", borderRadius: 5, cursor: "pointer", fontSize: "0.85rem", fontFamily: "inherit", letterSpacing: "0.04em", transition: "all 0.15s ease", ...variants[variant], ...style }}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Pill({ children, color = ACCENT }) {
  return (
    <span style={{ display: "inline-block", padding: "0.18rem 0.6rem", borderRadius: 3, background: `${color}18`, border: `1px solid ${color}44`, color, fontSize: "0.68rem", fontWeight: 600, letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

// Horizontal health/strength bar.
export function Bar({ value, color = ACCENT, height = 6 }) {
  return (
    <div style={{ height, background: "rgba(255,255,255,0.06)", borderRadius: height, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.max(0, Math.min(100, value * 100))}%`, background: color, borderRadius: height, transition: "width 0.6s ease" }} />
    </div>
  );
}

// Animated 300–850 score dial.
export function ScoreDial({ score, size = 150, label = "Estimated Score", note }) {
  const [shown, setShown] = useState(300);
  useEffect(() => {
    const start = performance.now();
    const from = 300;
    const dur = 1300;
    let raf;
    const tick = (now) => {
      const p = Math.min((now - start) / dur, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(from + (score - from) * e));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score]);

  const color = scoreColor(shown);
  const r = size / 2 - 10;
  const circ = 2 * Math.PI * r;
  // Map 300–850 onto the dial.
  const frac = (shown - 300) / 550;
  const dash = frac * circ;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "1.75rem", flexWrap: "wrap" }}>
      <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="9" />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="9" strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 7px ${color}88)`, transition: "stroke-dasharray 0.05s linear" }} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: "2.6rem", fontWeight: 700, color, fontFamily: MONO, lineHeight: 1 }}>{shown}</span>
          <span style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.3)", letterSpacing: "0.12em", textTransform: "uppercase" }}>300–850</span>
        </div>
      </div>
      <div>
        <div style={{ fontSize: "0.65rem", letterSpacing: "0.2em", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", marginBottom: "0.35rem" }}>{label}</div>
        <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#fff", lineHeight: 1.1, marginBottom: "0.6rem" }}>{scoreBand(shown)}</div>
        {note && <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.82rem", maxWidth: 240, lineHeight: 1.5 }}>{note}</div>}
      </div>
    </div>
  );
}
