import { useState } from "react";
import { ACCENT, BORDER } from "../theme";
import { Button } from "./ui";
import {
  ScoreFactors, PaydownOptimizer, Simulator, Negatives,
  LetterGenerator, Roadmap, Education, Progress,
} from "./sections";
import Coach from "./Coach";
import BookCall from "./BookCall";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "paydown", label: "Paydown Plan" },
  { id: "simulator", label: "Simulator" },
  { id: "negatives", label: "Negatives" },
  { id: "letters", label: "Letters" },
  { id: "roadmap", label: "Roadmap" },
  { id: "coach", label: "AI Coach" },
  { id: "learn", label: "Learn" },
  { id: "progress", label: "Progress" },
];

export default function Dashboard({ report, analysis, history, onRestart }) {
  const [tab, setTab] = useState("overview");

  return (
    <div style={{ width: "100%", maxWidth: 760, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: "0.5rem", overflowX: "auto", padding: "0 0 0.75rem", marginBottom: "1.5rem", borderBottom: `1px solid ${BORDER}` }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              padding: "0.5rem 0.9rem", borderRadius: 5, cursor: "pointer", whiteSpace: "nowrap",
              fontSize: "0.8rem", fontFamily: "inherit", fontWeight: tab === t.id ? 600 : 400,
              background: tab === t.id ? "rgba(201,169,110,0.1)" : "transparent",
              border: tab === t.id ? `1px solid rgba(201,169,110,0.4)` : `1px solid transparent`,
              color: tab === t.id ? ACCENT : "rgba(255,255,255,0.5)", transition: "all 0.15s ease",
            }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ minHeight: 360 }}>
        {tab === "overview" && <ScoreFactors analysis={analysis} />}
        {tab === "paydown" && <PaydownOptimizer report={report} />}
        {tab === "simulator" && <Simulator report={report} />}
        {tab === "negatives" && <Negatives analysis={analysis} />}
        {tab === "letters" && <LetterGenerator report={report} analysis={analysis} />}
        {tab === "roadmap" && <Roadmap analysis={analysis} />}
        {tab === "coach" && <Coach report={report} analysis={analysis} />}
        {tab === "learn" && <Education />}
        {tab === "progress" && <Progress history={history} />}
      </div>

      {(tab === "overview" || tab === "roadmap") && (
        <div style={{ marginTop: "1.5rem" }}>
          <BookCall analysis={analysis} />
        </div>
      )}

      <div style={{ marginTop: "2rem", textAlign: "center" }}>
        <Button variant="muted" onClick={onRestart}>↻ Analyze a different report</Button>
      </div>
    </div>
  );
}
