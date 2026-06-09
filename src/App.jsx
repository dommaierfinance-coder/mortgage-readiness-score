import { useState, useEffect } from "react";

const STEPS = [
  { id:"credit_score", label:"Credit Score", question:"Do you know your credit score? Pick the closest range.", hint:"You can check for free on Credit Karma or your bank app.", options:[{value:"below_580",label:"Under 580"},{value:"580_619",label:"580–619"},{value:"620_659",label:"620–659"},{value:"660_699",label:"660–699"},{value:"700_739",label:"700–739"},{value:"740_plus",label:"740 or higher"},{value:"unknown",label:"I'm not sure"}]},
  { id:"collections", label:"Unpaid Bills", question:"Have you ever had a bill sent to a collections agency?", hint:"Think old medical bills, phone bills, credit cards, etc.", options:[{value:"multiple",label:"Yes — more than one"},{value:"one",label:"Yes — just one"},{value:"paid",label:"Yes, but I've taken care of it"},{value:"none",label:"No, never"}]},
  { id:"dti", label:"Monthly Debt", question:"How much of your paycheck goes toward bills and debt every month?", hint:"Include car payments, student loans, credit cards — not rent or groceries.", options:[{value:"over_50",label:"More than half my income"},{value:"43_50",label:"About half"},{value:"36_43",label:"Roughly a third"},{value:"under_36",label:"Less than a third"},{value:"none",label:"Little to no debt payments"}]},
  { id:"employment", label:"Job Stability", question:"How long have you been at your current job?", hint:"Lenders want to see steady income — job-hopping is a red flag.", options:[{value:"less_6mo",label:"Less than 6 months"},{value:"6_12mo",label:"6 months to a year"},{value:"1_2yr",label:"1–2 years"},{value:"2yr_plus",label:"More than 2 years"},{value:"self_employed",label:"Self-employed or contractor"}]},
  { id:"down_payment", label:"Savings", question:"How much do you have saved that could go toward buying a home?", hint:"Most loans need at least 3–5% of the home price upfront.", options:[{value:"none",label:"Nothing saved yet"},{value:"under_5k",label:"Under $5,000"},{value:"5_15k",label:"$5,000–$15,000"},{value:"15_30k",label:"$15,000–$30,000"},{value:"30k_plus",label:"$30,000 or more"}]},
  { id:"late_payments", label:"Payment History", question:"Have you ever paid a bill 30+ days late?", hint:"This shows up on your credit report and significantly affects your score.", options:[{value:"recent_multiple",label:"Yes — several times recently"},{value:"recent_one",label:"Yes — once or twice recently"},{value:"older",label:"Yes, but it was a while ago"},{value:"none",label:"No — I always pay on time"}]},
  { id:"utilization", label:"Credit Cards", question:"How close are your credit cards to their limits right now?", hint:"If your limit is $1,000 and you owe $800, that's 80% — and it hurts your score.", options:[{value:"over_80",label:"Almost maxed out"},{value:"50_80",label:"More than halfway full"},{value:"30_50",label:"About half full"},{value:"10_30",label:"Mostly paid down"},{value:"under_10",label:"Barely using them"},{value:"no_cards",label:"I don't have credit cards"}]},
  { id:"timeline", label:"Your Goal", question:"When are you hoping to buy a home?", hint:"Be honest — this helps us give you a realistic action plan.", options:[{value:"asap",label:"As soon as possible"},{value:"6mo",label:"Within the next 6 months"},{value:"1yr",label:"Within the next year"},{value:"1_2yr",label:"In the next 1–2 years"},{value:"2yr_plus",label:"Just planning ahead"}]},
];

function calcFormulaResult(data) {
  const scoreMap = {
    credit_score:  {below_580:0,"580_619":8,"620_659":14,"660_699":18,"700_739":22,"740_plus":25,unknown:5},
    collections:   {multiple:0,one:4,paid:8,none:15},
    dti:           {over_50:0,"43_50":4,"36_43":8,under_36:12,none:12},
    employment:    {less_6mo:0,"6_12mo":3,"1_2yr":6,"2yr_plus":10,self_employed:5},
    down_payment:  {none:0,under_5k:2,"5_15k":5,"15_30k":8,"30k_plus":12},
    late_payments: {recent_multiple:0,recent_one:3,older:6,none:10},
    utilization:   {over_80:0,"50_80":2,"30_50":4,"10_30":6,under_10:8,no_cards:7},
    timeline:      {asap:2,"6mo":4,"1yr":6,"1_2yr":8,"2yr_plus":8},
  };
  const maxes = {credit_score:25,collections:15,dti:12,employment:10,down_payment:12,late_payments:10,utilization:8,timeline:8};
  let raw=0, total=0;
  for (const [key,max] of Object.entries(maxes)) { raw += scoreMap[key]?.[data[key]]??0; total+=max; }
  const score = Math.round((raw/total)*100);
  const blockers=[], wins=[];
  if(["below_580","580_619","620_659","unknown"].includes(data.credit_score)){blockers.push("Credit score needs improvement before most lenders will approve you");wins.push("Pull your free report at AnnualCreditReport.com and dispute any errors");}
  if(["multiple","one"].includes(data.collections)){blockers.push("Open collections are a major red flag for mortgage underwriters");wins.push("Settle or negotiate your collection accounts — even paid collections help");}
  if(["over_50","43_50"].includes(data.dti)){blockers.push("Too much monthly income going toward existing debt");wins.push("Attack your highest-interest debts first to lower your monthly obligations");}
  if(["less_6mo","6_12mo"].includes(data.employment)){blockers.push("Lenders want at least 2 years of stable employment history");wins.push("Stay at your current job — every month of stability counts");}
  if(["none","under_5k"].includes(data.down_payment)){blockers.push("Not enough saved — most loans require at least 3–5% down");wins.push("Set up an automatic transfer to a dedicated savings account each payday");}
  if(["recent_multiple","recent_one"].includes(data.late_payments)){blockers.push("Recent late payments are one of the biggest score killers");wins.push("Set up autopay on all accounts immediately — no more late payments");}
  if(["over_80","50_80"].includes(data.utilization)){blockers.push("Credit cards too close to their limits — this tanks your score");wins.push("Paying down even 20–30% of balances can move your score quickly");}
  if(blockers.length===0) blockers.push("Your profile is solid — stay consistent and keep building");
  if(wins.length===0) wins.push("Keep doing what you're doing — consistency is your best move");
  const score_cat = score>=72?"high":score>=45?"medium":"low";
  const verdicts={low:"There are real hurdles to clear before you're lender-ready.",medium:"You're closer than you think — a few key moves can unlock approval.",high:"You're in strong shape. Time to seriously start shopping."};
  return {score,score_cat,verdict:verdicts[score_cat],top_blockers:blockers.slice(0,3),quick_wins:wins.slice(0,3),months_to_ready:score>=72?0:Math.max(3,Math.round((72-score)/3)),upsell_hook:score<72?"The fastest way to close these gaps is with a proven credit repair strategy.":"A credit tune-up before you apply could save you thousands on your rate."};
}

function AnimatedScore({score,cat}){
  const [displayed,setDisplayed]=useState(0);
  useState(()=>{
    const duration=1400,start=performance.now();
    const tick=(now)=>{const p=Math.min((now-start)/duration,1),e=1-Math.pow(1-p,3);setDisplayed(Math.round(e*score));if(p<1)requestAnimationFrame(tick);};
    requestAnimationFrame(tick);
  },[score]);
  const colors={low:"#ef4444",medium:"#f59e0b",high:"#C9A96E"};
  const labels={low:"Not Ready Yet",medium:"Almost There",high:"Mortgage Ready"};
  const color=colors[cat],circ=2*Math.PI*52,dash=(displayed/100)*circ;
  return(
    <div style={{display:"flex",alignItems:"center",gap:"2rem"}}>
      <div style={{position:"relative",width:130,height:130,flexShrink:0}}>
        <svg width="130" height="130" style={{transform:"rotate(-90deg)"}}>
          <circle cx="65" cy="65" r="52" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8"/>
          <circle cx="65" cy="65" r="52" fill="none" stroke={color} strokeWidth="8" strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" style={{filter:`drop-shadow(0 0 6px ${color}88)`,transition:"stroke-dasharray 0.04s linear"}}/>
        </svg>
        <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
          <span style={{fontSize:"2.4rem",fontWeight:700,color,fontFamily:"'Courier New',monospace",lineHeight:1}}>{displayed}</span>
          <span style={{fontSize:"0.6rem",color:"rgba(255,255,255,0.3)",letterSpacing:"0.12em",textTransform:"uppercase"}}>/100</span>
        </div>
      </div>
      <div>
        <div style={{fontSize:"0.65rem",letterSpacing:"0.2em",color:"rgba(255,255,255,0.3)",textTransform:"uppercase",marginBottom:"0.3rem"}}>Readiness Score</div>
        <div style={{fontSize:"1.4rem",fontWeight:700,color:"#fff",lineHeight:1.2,marginBottom:"0.5rem"}}>{labels[cat]}</div>
        <div style={{display:"inline-block",padding:"0.2rem 0.7rem",borderRadius:3,background:`${color}18`,border:`1px solid ${color}44`,color,fontSize:"0.72rem",fontWeight:600,letterSpacing:"0.08em"}}>
          {cat==="high"?"✓ Lender-Ready Range":cat==="medium"?"⚠ Borderline Range":"✗ Pre-Approval Risk"}
        </div>
      </div>
    </div>
  );
}

const ACCENT="#C9A96E", BORDER="rgba(255,255,255,0.08)", BG="#0a0a0a";

function LoginView({onSuccess,onClose}){
  const [pwd,setPwd]=useState("");
  const [error,setError]=useState("");
  function attempt(){
    if(pwd==="2052"){onSuccess();}
    else{setError("Incorrect password.");setPwd("");}
  }
  return(
    <div style={{minHeight:"100vh",background:BG,fontFamily:"'Inter',-apple-system,sans-serif",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",padding:"2rem"}}>
      <div style={{width:"100%",maxWidth:360,border:`1px solid ${BORDER}`,borderRadius:8,padding:"2rem"}}>
        <div style={{fontSize:"0.65rem",color:ACCENT,letterSpacing:"0.2em",textTransform:"uppercase",fontWeight:600,marginBottom:"0.5rem"}}>Admin Access</div>
        <h2 style={{fontSize:"1.2rem",fontWeight:700,margin:"0 0 1.5rem"}}>Enter Password</h2>
        <input
          type="password" placeholder="Password" value={pwd}
          onChange={e=>setPwd(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&attempt()}
          style={{width:"100%",padding:"0.75rem 1rem",background:"rgba(255,255,255,0.03)",border:`1px solid ${BORDER}`,borderRadius:4,color:"#fff",fontSize:"0.9rem",fontFamily:"inherit",outline:"none",marginBottom:"0.75rem"}}
          onFocus={e=>e.target.style.borderColor="rgba(201,169,110,0.5)"}
          onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.08)"}
          autoFocus
        />
        {error&&<p style={{color:"#ef4444",fontSize:"0.8rem",marginBottom:"0.75rem"}}>{error}</p>}
        <div style={{display:"flex",gap:"0.75rem"}}>
          <button onClick={attempt} style={{padding:"0.75rem 1.5rem",borderRadius:4,cursor:"pointer",background:ACCENT,border:"none",color:"#0a0a0a",fontWeight:700,fontSize:"0.88rem",fontFamily:"inherit",letterSpacing:"0.08em",textTransform:"uppercase"}}>
            Enter →
          </button>
          <button onClick={onClose} style={{padding:"0.75rem 1rem",borderRadius:4,cursor:"pointer",background:"transparent",border:`1px solid ${BORDER}`,color:"rgba(255,255,255,0.35)",fontSize:"0.85rem",fontFamily:"inherit"}}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminView({onClose}){
  const [leads,setLeads]=useState([]);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    async function load(){
      try{
        const keys = await window.storage.list("lead:");
        const items = await Promise.all(
          keys.keys.map(async k => {
            try{ const r=await window.storage.get(k,true); return r?JSON.parse(r.value):null; }catch(e){return null;}
          })
        );
        setLeads(items.filter(Boolean).sort((a,b)=>new Date(b.submittedAt)-new Date(a.submittedAt)));
      }catch(e){setLeads([]);}
      setLoading(false);
    }
    load();
  },[]);

  const scoreColor = s => s>=72?"#C9A96E":s>=45?"#f59e0b":"#ef4444";

  return(
    <div style={{minHeight:"100vh",background:BG,fontFamily:"'Inter',-apple-system,sans-serif",color:"#fff",padding:"2rem 1rem"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');`}</style>
      <div style={{maxWidth:800,margin:"0 auto"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"2rem",paddingBottom:"1rem",borderBottom:`1px solid ${BORDER}`}}>
          <div>
            <div style={{fontSize:"0.65rem",color:ACCENT,letterSpacing:"0.2em",textTransform:"uppercase",fontWeight:600,marginBottom:"0.3rem"}}>Dom Maier Finance</div>
            <h1 style={{fontSize:"1.4rem",fontWeight:700,margin:0}}>Consultation Leads</h1>
          </div>
          <button onClick={onClose} style={{padding:"0.5rem 1rem",borderRadius:4,cursor:"pointer",background:"transparent",border:`1px solid ${BORDER}`,color:"rgba(255,255,255,0.4)",fontSize:"0.82rem",fontFamily:"inherit"}}>← Back to App</button>
        </div>

        {loading && <p style={{color:"rgba(255,255,255,0.3)"}}>Loading leads...</p>}

        {!loading && leads.length===0 && (
          <div style={{padding:"3rem",textAlign:"center",border:`1px solid ${BORDER}`,borderRadius:8}}>
            <p style={{color:"rgba(255,255,255,0.3)",margin:0}}>No leads yet. Submissions will appear here after someone books a consultation.</p>
          </div>
        )}

        {!loading && leads.length>0 && (
          <div style={{display:"flex",flexDirection:"column",gap:"0.75rem"}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr auto auto",gap:"0.5rem",padding:"0 1rem",marginBottom:"0.25rem"}}>
              {["Name","Email","Phone","Score","Date"].map(h=>(
                <div key={h} style={{fontSize:"0.65rem",color:"rgba(255,255,255,0.25)",letterSpacing:"0.12em",textTransform:"uppercase"}}>{h}</div>
              ))}
            </div>
            {leads.map((lead,i)=>(
              <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr auto auto",gap:"0.5rem",alignItems:"center",padding:"0.9rem 1rem",background:"rgba(255,255,255,0.02)",border:`1px solid ${BORDER}`,borderRadius:6}}>
                <div style={{fontWeight:600,fontSize:"0.9rem"}}>{lead.name}</div>
                <div style={{color:"rgba(255,255,255,0.55)",fontSize:"0.85rem",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{lead.email}</div>
                <div style={{color:"rgba(255,255,255,0.55)",fontSize:"0.85rem"}}>{lead.phone}</div>
                <div style={{fontWeight:700,color:scoreColor(lead.score),fontFamily:"'Courier New',monospace",fontSize:"1rem"}}>{lead.score}</div>
                <div style={{fontSize:"0.75rem",color:"rgba(255,255,255,0.3)",whiteSpace:"nowrap"}}>{new Date(lead.submittedAt).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        )}

        {!loading && leads.length>0 && (
          <p style={{color:"rgba(255,255,255,0.2)",fontSize:"0.72rem",marginTop:"1.5rem",textAlign:"center"}}>
            {leads.length} lead{leads.length!==1?"s":""} total
          </p>
        )}
      </div>
    </div>
  );
}

const WEBHOOK = "https://hook.us2.make.com/nn5375ypqb8ripym0us9kmmk3b98p9qw";

function PrivacyPolicy({onClose}){
  return(
    <div style={{minHeight:"100vh",background:BG,fontFamily:"'Inter',-apple-system,sans-serif",color:"#fff",padding:"2rem 1rem"}}>
      <div style={{maxWidth:680,margin:"0 auto"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"2rem",paddingBottom:"1rem",borderBottom:`1px solid ${BORDER}`}}>
          <div style={{fontSize:"1rem",fontWeight:700}}>Dom Maier <em style={{color:ACCENT,fontStyle:"italic"}}>Finance</em></div>
          <button onClick={onClose} style={{padding:"0.5rem 1rem",borderRadius:4,cursor:"pointer",background:"transparent",border:`1px solid ${BORDER}`,color:"rgba(255,255,255,0.4)",fontSize:"0.82rem",fontFamily:"inherit"}}>Back</button>
        </div>
        <h1 style={{fontSize:"1.6rem",fontWeight:700,marginBottom:"0.5rem"}}>Privacy Policy</h1>
        <p style={{color:"rgba(255,255,255,0.4)",fontSize:"0.8rem",marginBottom:"2rem"}}>Last updated: June 9, 2026</p>
        {[
          ["1. Who We Are","Dom Maier Finance operates dommaierfinance.com and mortgage.dommaierfinance.com, providing financial education, credit coaching resources, and mortgage readiness tools."],
          ["2. Information We Collect","When you use our Mortgage Readiness Score tool, we collect your name, email address, phone number, and quiz responses for the purpose of generating your score and providing coaching services."],
          ["3. How We Use Your Information","We use your information to deliver your mortgage readiness results, contact you about consultation requests, send follow-up educational content, and connect you with relevant financial products and services."],
          ["4. Sharing Your Information","We may share your information with third-party partners including mortgage lenders, debt consolidation companies, credit repair services, and other financial service providers who may contact you regarding their products and services. By submitting your information, you consent to this sharing."],
          ["5. TCPA Consent","By submitting your name, email, and phone number, you expressly consent to receive calls, text messages, and emails from Dom Maier Finance and its partners at the number and email provided, including calls made using an automatic telephone dialing system or pre-recorded voice. Consent is not a condition of purchase. Message and data rates may apply. You may opt out at any time by replying STOP to any text message or contacting us directly."],
          ["6. Your Rights","You may request to access, correct, or delete your personal information at any time by contacting us at dommaier.finance@gmail.com."],
          ["7. Data Security","We implement reasonable security measures to protect your information. However, no method of transmission over the internet is 100% secure."],
          ["8. Contact Us","Questions? Contact us at dommaier.finance@gmail.com or visit dommaierfinance.com."],
        ].map(([title,body])=>(
          <div key={title} style={{marginBottom:"1.5rem"}}>
            <h2 style={{fontSize:"0.95rem",fontWeight:700,color:"#fff",marginBottom:"0.5rem"}}>{title}</h2>
            <p style={{color:"rgba(255,255,255,0.55)",fontSize:"0.88rem",lineHeight:1.7,margin:0}}>{body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function LeadGate({onComplete}){
  const [form,setForm]=useState({name:"",email:"",phone:""});
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(false);
  const [showPrivacy,setShowPrivacy]=useState(false);
  if(showPrivacy) return <PrivacyPolicy onClose={()=>setShowPrivacy(false)}/>;
  async function handleSubmit(){
    if(!form.name.trim()||!form.email.trim()||!form.phone.trim()){setError("Please fill in all fields.");return;}
    if(!/[^\s@]+@[^\s@]+\.[^\s@]+/.test(form.email)){setError("Please enter a valid email address.");return;}
    setError("");setLoading(true);
    try{
      await fetch(WEBHOOK,{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({name:form.name.trim(),email:form.email.trim(),phone:form.phone.trim(),score:0,score_cat:"opt-in",submittedAt:new Date().toISOString(),message:`New opt-in: ${form.name.trim()} ${form.phone.trim()} ${form.email.trim()}`})});
    }catch(e){}
    setLoading(false);onComplete(form);
  }
  return(
    <div style={{minHeight:"100vh",background:BG,fontFamily:"'Inter',-apple-system,sans-serif",color:"#fff",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"2rem 1rem",backgroundImage:"radial-gradient(ellipse at 30% 20%, rgba(201,169,110,0.06) 0%, transparent 60%)"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,700&family=Inter:wght@400;500;600&display=swap');*{box-sizing:border-box;}input::placeholder{color:rgba(255,255,255,0.2);}.gi:focus{border-color:rgba(201,169,110,0.5)!important;outline:none;}`}</style>
      <div style={{width:"100%",maxWidth:480}}>
        <div style={{textAlign:"center",marginBottom:"2.5rem"}}>
          <div style={{fontSize:"0.9rem",fontWeight:700,marginBottom:"1.5rem"}}>Dom Maier <em style={{color:ACCENT,fontStyle:"italic"}}>Finance</em></div>
          <div style={{display:"inline-block",padding:"0.3rem 1rem",borderRadius:3,background:"rgba(201,169,110,0.1)",border:"1px solid rgba(201,169,110,0.25)",color:ACCENT,fontSize:"0.7rem",fontWeight:600,letterSpacing:"0.2em",textTransform:"uppercase",marginBottom:"1rem"}}>Free Assessment</div>
          <h1 style={{fontFamily:"'Playfair Display',Georgia,serif",fontSize:"clamp(1.8rem,5vw,2.4rem)",fontWeight:700,lineHeight:1.15,margin:"0 0 1rem",letterSpacing:"-0.02em"}}>
            Are You <em style={{fontStyle:"italic",color:ACCENT}}>Mortgage Ready?</em>
          </h1>
          <p style={{color:"rgba(255,255,255,0.45)",fontSize:"0.95rem",lineHeight:1.6,margin:0}}>
            Take our free 8-question assessment and find out exactly where you stand — and what's blocking you from getting approved.
          </p>
        </div>
        <div style={{display:"flex",justifyContent:"center",gap:"1.5rem",marginBottom:"2rem",flexWrap:"wrap"}}>
          {["Takes 2 minutes","100% Free","No credit pull"].map(b=>(
            <div key={b} style={{display:"flex",alignItems:"center",gap:"0.4rem",fontSize:"0.78rem",color:"rgba(255,255,255,0.4)"}}>
              <span style={{color:ACCENT}}>✓</span> {b}
            </div>
          ))}
        </div>
        <div style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${BORDER}`,borderRadius:8,padding:"2rem"}}>
          <div style={{display:"flex",flexDirection:"column",gap:"1rem",marginBottom:"1.25rem"}}>
            {[{key:"name",label:"Full Name",placeholder:"Jane Smith",type:"text"},{key:"email",label:"Email Address",placeholder:"jane@example.com",type:"email"},{key:"phone",label:"Phone Number",placeholder:"(555) 000-0000",type:"tel"}].map(field=>(
              <div key={field.key}>
                <div style={{fontSize:"0.7rem",color:"rgba(255,255,255,0.35)",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:"0.35rem"}}>{field.label}</div>
                <input className="gi" type={field.type} placeholder={field.placeholder} value={form[field.key]}
                  onChange={e=>setForm(prev=>({...prev,[field.key]:e.target.value}))}
                  onKeyDown={e=>e.key==="Enter"&&handleSubmit()}
                  style={{width:"100%",padding:"0.75rem 1rem",background:"rgba(255,255,255,0.03)",border:`1px solid ${BORDER}`,borderRadius:4,color:"#fff",fontSize:"0.9rem",fontFamily:"inherit"}}/>
              </div>
            ))}
          </div>
          {error&&<p style={{color:"#ef4444",fontSize:"0.8rem",marginBottom:"0.75rem"}}>{error}</p>}
          <button onClick={handleSubmit} disabled={loading} style={{width:"100%",padding:"0.9rem",borderRadius:4,cursor:"pointer",background:ACCENT,border:"none",color:"#0a0a0a",fontWeight:700,fontSize:"0.95rem",fontFamily:"inherit",letterSpacing:"0.08em",textTransform:"uppercase",opacity:loading?0.7:1}}>
            {loading?"Loading...":"Get My Free Score →"}
          </button>
          <p style={{color:"rgba(255,255,255,0.2)",fontSize:"0.68rem",lineHeight:1.5,marginTop:"1rem",textAlign:"center"}}>
            By submitting this form you consent to receive calls, texts, and emails from Dom Maier Finance and its partners regarding financial products and services. Consent is not required to purchase. Msg & data rates may apply.{" "}
            <span onClick={()=>setShowPrivacy(true)} style={{color:ACCENT,cursor:"pointer",textDecoration:"underline"}}>Privacy Policy</span>.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function MortgageReadiness(){
  const [gateComplete,setGateComplete]=useState(false);
  const [leadInfo,setLeadInfo]=useState(null);
  const [step,setStep]=useState(0);
  const [answers,setAnswers]=useState({});
  const [result,setResult]=useState(null);
  const [aiCommentary,setAiCommentary]=useState(null);
  const [aiLoading,setAiLoading]=useState(false);
  const [showForm,setShowForm]=useState(false);
  const [formData,setFormData]=useState({name:"",email:"",phone:""});
  const [formSubmitted,setFormSubmitted]=useState(false);
  const [formError,setFormError]=useState("");




  if(!gateComplete) return <LeadGate onComplete={(info)=>{setLeadInfo(info);setGateComplete(true);}}/>;

  const current=STEPS[step];
  const progress=(step/STEPS.length)*100;

  function handleSelect(value){
    const newAnswers={...answers,[current.id]:value};
    setAnswers(newAnswers);
    if(step<STEPS.length-1){setTimeout(()=>setStep(step+1),260);}
    else{const r=calcFormulaResult(newAnswers);setResult(r);fetchAI(newAnswers,r);}
  }

  async function fetchAI(data,r){
    setAiLoading(true);
    try{
      const prompt=`You are a mortgage readiness coach. Score: ${r.score}/100. Write 2 sentences of personalized insight. Be direct and specific — no generic advice.\nProfile: Credit=${data.credit_score}, Collections=${data.collections}, Debt=${data.dti}, Employment=${data.employment}, Savings=${data.down_payment}, Late payments=${data.late_payments}, Utilization=${data.utilization}, Timeline=${data.timeline}\nReturn ONLY: {"commentary":"<2 sentences>"}`;
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:200,messages:[{role:"user",content:prompt}]})});
      const raw=await res.json();
      const text=raw.content?.map(b=>b.text||"").join("")||"";
      const parsed=JSON.parse(text.replace(/```json|```/g,"").trim());
      if(parsed.commentary) setAiCommentary(parsed.commentary);
    }catch(e){}
    finally{setAiLoading(false);}
  }

  function restart(){
    setStep(0);setAnswers({});setResult(null);setAiCommentary(null);setAiLoading(false);
    setShowForm(false);setFormData({name:"",email:"",phone:""});setFormSubmitted(false);setFormError("");
  }

  async function handleFormSubmit(){
    if(!formData.name.trim()||!formData.email.trim()||!formData.phone.trim()){setFormError("Please fill in all fields.");return;}
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)){setFormError("Please enter a valid email address.");return;}
    setFormError("");
    // Send to Make.com webhook
    const lead={
      name:formData.name.trim(),
      email:formData.email.trim(),
      phone:formData.phone.trim(),
      score:result?.score??0,
      score_cat:result?.score_cat??"unknown",
      submittedAt:new Date().toISOString(),
    };
    try{
      await fetch("https://hook.us2.make.com/nn5375ypqb8ripym0us9kmmk3b98p9qw",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          name:lead.name,
          email:lead.email,
          phone:lead.phone,
          score:lead.score,
          score_cat:lead.score_cat,
          submitted_at:lead.submittedAt,
          message:`New mortgage readiness lead: ${lead.name} scored ${lead.score}/100. Call ${lead.phone} or email ${lead.email}`,
        }),
      });
    }catch(e){}
    setFormSubmitted(true);
  }

  return(
    <div style={{minHeight:"100vh",background:BG,fontFamily:"'Inter',-apple-system,sans-serif",color:"#fff",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"2rem 1rem"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,700&family=Inter:wght@400;500;600&display=swap');
        *{box-sizing:border-box;}
        .opt-btn:hover{border-color:rgba(201,169,110,0.4)!important;background:rgba(201,169,110,0.05)!important;}
        input::placeholder{color:rgba(255,255,255,0.2);}
      `}</style>

      <div style={{width:"100%",maxWidth:680,marginBottom:"2.5rem"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"2rem",paddingBottom:"1rem",borderBottom:`1px solid ${BORDER}`}}>
          <div style={{fontSize:"1rem",fontWeight:700}}>Dom Maier <em style={{color:ACCENT,fontStyle:"italic"}}>Finance</em></div>
          <div style={{display:"flex",alignItems:"center",gap:"1rem"}}>

            <div style={{fontSize:"0.72rem",color:"rgba(255,255,255,0.3)",letterSpacing:"0.15em",textTransform:"uppercase"}}>Free Assessment</div>
          </div>
        </div>
        <div>
          <div style={{fontSize:"0.7rem",color:ACCENT,letterSpacing:"0.2em",textTransform:"uppercase",marginBottom:"0.6rem",fontWeight:600}}>Mortgage Readiness Score</div>
          <h1 style={{fontSize:"clamp(1.8rem,5vw,2.6rem)",fontWeight:700,fontFamily:"'Playfair Display',Georgia,serif",lineHeight:1.15,margin:"0 0 0.6rem",letterSpacing:"-0.02em"}}>
            Does Your Credit Have a <em style={{fontStyle:"italic",color:ACCENT}}>Plan?</em>
          </h1>
          <p style={{color:"rgba(255,255,255,0.45)",fontSize:"0.95rem",margin:0,maxWidth:480}}>Answer 8 questions and get your personalized mortgage readiness score — plus exactly what's blocking you.</p>
        </div>
      </div>

      <div style={{width:"100%",maxWidth:680,border:`1px solid ${BORDER}`,borderRadius:8,overflow:"hidden"}}>
        {!result&&<div style={{height:2,background:"rgba(255,255,255,0.05)"}}><div style={{height:"100%",background:ACCENT,width:`${progress}%`,transition:"width 0.4s ease"}}/></div>}

        {/* Quiz */}
        {!result&&(
          <div style={{padding:"2rem 2rem 2.5rem"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.8rem"}}>
              <span style={{fontSize:"0.7rem",color:"rgba(255,255,255,0.25)",letterSpacing:"0.12em",textTransform:"uppercase"}}>{current.label}</span>
              <span style={{fontSize:"0.7rem",color:"rgba(255,255,255,0.25)"}}>{step+1} / {STEPS.length}</span>
            </div>
            <h2 style={{fontSize:"1.15rem",fontWeight:600,color:"#fff",marginBottom:current.hint?"0.5rem":"1.5rem",lineHeight:1.4}}>{current.question}</h2>
            {current.hint&&<p style={{fontSize:"0.78rem",color:"rgba(255,255,255,0.28)",marginBottom:"1.4rem",lineHeight:1.6,borderLeft:`2px solid rgba(201,169,110,0.3)`,paddingLeft:"0.75rem"}}>{current.hint}</p>}
            <div style={{display:"flex",flexDirection:"column",gap:"0.5rem"}}>
              {current.options.map(opt=>{
                const sel=answers[current.id]===opt.value;
                return(
                  <button key={opt.value} className="opt-btn" onClick={()=>handleSelect(opt.value)} style={{padding:"0.8rem 1rem",borderRadius:4,cursor:"pointer",textAlign:"left",fontFamily:"inherit",fontSize:"0.9rem",fontWeight:sel?600:400,background:sel?"rgba(201,169,110,0.08)":"rgba(255,255,255,0.02)",border:sel?`1px solid rgba(201,169,110,0.5)`:`1px solid rgba(255,255,255,0.07)`,color:sel?ACCENT:"rgba(255,255,255,0.7)",transition:"all 0.15s ease",display:"flex",alignItems:"center",gap:"0.6rem"}}>
                    <span style={{width:16,height:16,borderRadius:"50%",flexShrink:0,border:sel?`2px solid ${ACCENT}`:"2px solid rgba(255,255,255,0.15)",background:sel?ACCENT:"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {sel&&<span style={{width:6,height:6,borderRadius:"50%",background:BG}}/>}
                    </span>
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Result */}
        {result&&(
          <div>
            <div style={{padding:"2rem",borderBottom:`1px solid ${BORDER}`}}><AnimatedScore score={result.score} cat={result.score_cat}/></div>

            {(aiLoading||aiCommentary)&&(
              <div style={{padding:"1.25rem 2rem",borderBottom:`1px solid ${BORDER}`,background:"rgba(201,169,110,0.03)"}}>
                <div style={{fontSize:"0.65rem",color:ACCENT,letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:"0.5rem",fontWeight:600}}>AI Analysis</div>
                {aiLoading&&!aiCommentary?(
                  <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
                    <div style={{width:12,height:12,borderRadius:"50%",border:"2px solid rgba(201,169,110,0.2)",borderTop:`2px solid ${ACCENT}`,animation:"spin 0.8s linear infinite"}}/>
                    <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
                    <span style={{color:"rgba(255,255,255,0.3)",fontSize:"0.82rem"}}>Generating personalized insight...</span>
                  </div>
                ):<p style={{color:"rgba(255,255,255,0.65)",fontSize:"0.88rem",lineHeight:1.65,margin:0}}>{aiCommentary}</p>}
              </div>
            )}

            <div style={{padding:"1.5rem 2rem",borderBottom:`1px solid ${BORDER}`}}>
              <p style={{color:"rgba(255,255,255,0.6)",fontSize:"0.92rem",fontStyle:"italic",margin:"0 0 1rem"}}>"{result.verdict}"</p>
              {result.months_to_ready>0&&(
                <div style={{display:"flex",alignItems:"center",gap:"0.75rem",padding:"0.75rem 1rem",background:"rgba(255,255,255,0.03)",border:`1px solid ${BORDER}`,borderRadius:4}}>
                  <span style={{fontSize:"0.7rem",color:"rgba(255,255,255,0.3)",letterSpacing:"0.1em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Est. Timeline</span>
                  <span style={{width:1,height:16,background:BORDER}}/>
                  <span style={{fontSize:"0.88rem",color:"rgba(255,255,255,0.65)"}}>With consistent action — <strong style={{color:"#fff"}}>{result.months_to_ready} months</strong> to mortgage-ready</span>
                </div>
              )}
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:0,borderBottom:`1px solid ${BORDER}`}}>
              <div style={{padding:"1.5rem 2rem",borderRight:`1px solid ${BORDER}`}}>
                <div style={{fontSize:"0.65rem",color:"#ef4444",letterSpacing:"0.15em",textTransform:"uppercase",fontWeight:600,marginBottom:"1rem"}}>Top Blockers</div>
                <div style={{display:"flex",flexDirection:"column",gap:"0.6rem"}}>
                  {result.top_blockers.map((b,i)=>(
                    <div key={i} style={{display:"flex",gap:"0.5rem",alignItems:"flex-start"}}>
                      <span style={{color:"#ef4444",fontSize:"0.7rem",marginTop:"0.2rem",flexShrink:0}}>✗</span>
                      <span style={{color:"rgba(255,255,255,0.55)",fontSize:"0.82rem",lineHeight:1.5}}>{b}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{padding:"1.5rem 2rem"}}>
                <div style={{fontSize:"0.65rem",color:ACCENT,letterSpacing:"0.15em",textTransform:"uppercase",fontWeight:600,marginBottom:"1rem"}}>Quick Wins</div>
                <div style={{display:"flex",flexDirection:"column",gap:"0.6rem"}}>
                  {result.quick_wins.map((w,i)=>(
                    <div key={i} style={{display:"flex",gap:"0.5rem",alignItems:"flex-start"}}>
                      <span style={{color:ACCENT,fontSize:"0.7rem",marginTop:"0.2rem",flexShrink:0}}>→</span>
                      <span style={{color:"rgba(255,255,255,0.55)",fontSize:"0.82rem",lineHeight:1.5}}>{w}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Video Message */}
            <div style={{borderBottom:`1px solid ${BORDER}`}}>
              <div style={{padding:"1.5rem 2rem 0"}}>
                <div style={{fontSize:"0.65rem",color:ACCENT,letterSpacing:"0.2em",textTransform:"uppercase",fontWeight:600,marginBottom:"0.75rem"}}>
                  A Message From Dom
                </div>
              </div>
              <div style={{
                margin:"0 2rem 1.5rem",
                borderRadius:6,
                overflow:"hidden",
                border:`1px solid ${BORDER}`,
                aspectRatio:"16/9",
                position:"relative",
              }}>
                <iframe
                  width="100%"
                  height="100%"
                  src="https://www.youtube.com/embed/8ZHRhtunhjY"
                  title="A Message From Dom"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  style={{position:"absolute",top:0,left:0,width:"100%",height:"100%"}}
                />
              </div>
            </div>

            {/* CTA */}
            <div style={{padding:"1.75rem 2rem"}}>
              <p style={{color:"rgba(255,255,255,0.5)",fontSize:"0.88rem",marginBottom:"1.25rem",lineHeight:1.6}}>{result.upsell_hook}</p>

              {!showForm&&!formSubmitted&&(
                <div style={{display:"flex",gap:"0.75rem",flexWrap:"wrap"}}>
                  <button style={{padding:"0.75rem 1.5rem",borderRadius:4,cursor:"pointer",background:ACCENT,border:"none",color:"#0a0a0a",fontWeight:700,fontSize:"0.88rem",fontFamily:"inherit",letterSpacing:"0.08em",textTransform:"uppercase"}} onClick={()=>setShowForm(true)}>
                    Book a Consultation →
                  </button>
                  <button onClick={()=>window.open("https://app.dommaierfinance.com","_blank")} style={{padding:"0.75rem 1.5rem",borderRadius:4,cursor:"pointer",background:"transparent",border:`1px solid rgba(201,169,110,0.3)`,color:ACCENT,fontSize:"0.85rem",fontFamily:"inherit",letterSpacing:"0.05em"}}>
                    Try Debt Simulator
                  </button>
                  <button onClick={restart} style={{padding:"0.75rem 1.5rem",borderRadius:4,cursor:"pointer",background:"transparent",border:`1px solid ${BORDER}`,color:"rgba(255,255,255,0.35)",fontSize:"0.85rem",fontFamily:"inherit"}}>
                    Retake Assessment
                  </button>
                </div>
              )}

              {showForm&&!formSubmitted&&(
                <div>
                  <div style={{fontSize:"0.65rem",color:ACCENT,letterSpacing:"0.2em",textTransform:"uppercase",fontWeight:600,marginBottom:"1rem"}}>Book a Consultation</div>
                  <div style={{display:"flex",flexDirection:"column",gap:"0.75rem",marginBottom:"1rem"}}>
                    {[{key:"name",label:"Full Name",placeholder:"Jane Smith",type:"text"},{key:"email",label:"Email Address",placeholder:"jane@example.com",type:"email"},{key:"phone",label:"Phone Number",placeholder:"(555) 000-0000",type:"tel"}].map(field=>(
                      <div key={field.key}>
                        <div style={{fontSize:"0.7rem",color:"rgba(255,255,255,0.35)",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:"0.35rem"}}>{field.label}</div>
                        <input type={field.type} placeholder={field.placeholder} value={formData[field.key]}
                          onChange={e=>setFormData(prev=>({...prev,[field.key]:e.target.value}))}
                          style={{width:"100%",padding:"0.75rem 1rem",background:"rgba(255,255,255,0.03)",border:`1px solid ${BORDER}`,borderRadius:4,color:"#fff",fontSize:"0.9rem",fontFamily:"inherit",outline:"none"}}
                          onFocus={e=>e.target.style.borderColor="rgba(201,169,110,0.5)"}
                          onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.08)"}
                        />
                      </div>
                    ))}
                  </div>
                  {formError&&<p style={{color:"#ef4444",fontSize:"0.8rem",marginBottom:"0.75rem"}}>{formError}</p>}
                  <div style={{display:"flex",gap:"0.75rem",flexWrap:"wrap"}}>
                    <button onClick={handleFormSubmit} style={{padding:"0.75rem 1.5rem",borderRadius:4,cursor:"pointer",background:ACCENT,border:"none",color:"#0a0a0a",fontWeight:700,fontSize:"0.88rem",fontFamily:"inherit",letterSpacing:"0.08em",textTransform:"uppercase"}}>
                      Submit →
                    </button>
                    <button onClick={()=>{setShowForm(false);setFormError("");}} style={{padding:"0.75rem 1.5rem",borderRadius:4,cursor:"pointer",background:"transparent",border:`1px solid ${BORDER}`,color:"rgba(255,255,255,0.35)",fontSize:"0.85rem",fontFamily:"inherit"}}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {formSubmitted&&(
                <div style={{padding:"1.5rem",background:"rgba(201,169,110,0.06)",border:`1px solid rgba(201,169,110,0.2)`,borderRadius:4}}>
                  <div style={{fontSize:"0.65rem",color:ACCENT,letterSpacing:"0.2em",textTransform:"uppercase",fontWeight:600,marginBottom:"0.5rem"}}>Request Received</div>
                  <p style={{color:"rgba(255,255,255,0.7)",fontSize:"0.9rem",lineHeight:1.6,margin:"0 0 1rem"}}>
                    Thanks, <strong style={{color:"#fff"}}>{formData.name.split(" ")[0]}</strong>. Dom will be in touch shortly to schedule your consultation.
                  </p>
                  <button onClick={restart} style={{padding:"0.6rem 1.2rem",borderRadius:4,cursor:"pointer",background:"transparent",border:`1px solid ${BORDER}`,color:"rgba(255,255,255,0.35)",fontSize:"0.82rem",fontFamily:"inherit"}}>
                    Retake Assessment
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div style={{marginTop:"1.5rem",fontSize:"0.7rem",color:"rgba(255,255,255,0.15)",textAlign:"center"}}>
        Educational information only. Not financial or credit repair advice. · Dom Maier Finance
      </div>
    </div>
  );
}
