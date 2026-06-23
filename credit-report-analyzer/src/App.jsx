import { useState } from "react";
import { ACCENT, BG, BORDER, FONT, SERIF } from "./theme";
import Upload from "./components/Upload";
import Dashboard from "./components/Dashboard";
import Paywall from "./components/Paywall";
import { analyze } from "./lib/credit";
import { recordSnapshot, loadHistory } from "./lib/storage";
import { isUnlocked, paywallEnabled } from "./lib/license";

export default function App() {
  const [report, setReport] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [history, setHistory] = useState([]);
  const [unlocked, setUnlocked] = useState(() => !paywallEnabled() || isUnlocked());
  const gated = paywallEnabled() && !unlocked;

  function handleAnalyzed(rep) {
    const a = analyze(rep);
    setReport(rep);
    setAnalysis(a);
    setHistory(recordSnapshot(a) || loadHistory());
    window.scrollTo({ top: 0 });
  }

  function restart() {
    setReport(null);
    setAnalysis(null);
    window.scrollTo({ top: 0 });
  }

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: FONT, color: "#fff", padding: "2rem 1rem 4rem" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,700&family=Inter:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;}
        @keyframes spin{to{transform:rotate(360deg);}}
        input::placeholder{color:rgba(255,255,255,0.25);}
        ::-webkit-scrollbar{height:6px;width:6px;}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.12);border-radius:3px;}
      `}</style>

      <div style={{ maxWidth: 760, margin: "0 auto 2rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "1rem", borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: "1rem", fontWeight: 700 }}>Dom Maier <em style={{ color: ACCENT, fontStyle: "italic" }}>Finance</em></div>
          <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.3)", letterSpacing: "0.15em", textTransform: "uppercase" }}>Credit Report Analyzer</div>
        </div>

        {!analysis && (
          <div style={{ marginTop: "2.5rem", marginBottom: "2.5rem", textAlign: "center" }}>
            <div style={{ fontSize: "0.7rem", color: ACCENT, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "0.7rem", fontWeight: 600 }}>Upload · Understand · Learn</div>
            <h1 style={{ fontSize: "clamp(1.9rem,5vw,2.8rem)", fontWeight: 700, fontFamily: SERIF, lineHeight: 1.12, margin: "0 0 0.7rem", letterSpacing: "-0.02em" }}>
              Understand your <em style={{ fontStyle: "italic", color: ACCENT }}>credit report.</em>
            </h1>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "1rem", margin: "0 auto", maxWidth: 520, lineHeight: 1.6 }}>
              Upload your credit report to understand exactly what's affecting your score — with a what-if simulator and an AI coach to help you learn.
            </p>
          </div>
        )}
      </div>

      {analysis ? (
        <Dashboard report={report} analysis={analysis} history={history} onRestart={restart} />
      ) : gated ? (
        <Paywall feature="the full credit report analysis" onUnlock={() => setUnlocked(true)} />
      ) : (
        <Upload onAnalyzed={handleAnalyzed} />
      )}

      <div style={{ marginTop: "3rem", fontSize: "0.7rem", color: "rgba(255,255,255,0.18)", textAlign: "center", maxWidth: 600, margin: "3rem auto 0", lineHeight: 1.6 }}>
        Educational information only. Not financial, legal, or credit-repair advice. Score estimates are directional and may differ from your official FICO/VantageScore. · Dom Maier Finance
      </div>
    </div>
  );
}
