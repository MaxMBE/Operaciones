"use client";

import { useState } from "react";

// ── Color tokens ──────────────────────────────────────────────────────────────
const C = {
  navy:      "#1F3864",
  blue:      "#2E75B6",
  blueMid:   "#4A90C4",
  blueLight: "#BDD7EE",
  bluePale:  "#D6E4F0",
  blueFaint: "#EBF3FB",
  white:     "#FFFFFF",
  gray50:    "#F8FAFC",
  gray100:   "#F1F5F9",
  gray200:   "#E2E8F0",
  gray400:   "#94A3B8",
  gray600:   "#475569",
  gray800:   "#1E293B",
  green:     "#16A34A",
  greenBg:   "#DCFCE7",
  amber:     "#D97706",
  amberBg:   "#FEF3C7",
  red:       "#DC2626",
  redBg:     "#FEE2E2",
};

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  root: { fontFamily: "'Segoe UI','Helvetica Neue',Arial,sans-serif", background: C.gray50, color: C.gray800 } as React.CSSProperties,
  header: { background: `linear-gradient(135deg,${C.navy} 0%,${C.blue} 100%)`, padding: "28px 32px 0", borderBottom: `3px solid ${C.blueLight}` } as React.CSSProperties,
  headerTop: { display:"flex", alignItems:"center", gap:14, marginBottom:20 } as React.CSSProperties,
  badge: { background:"rgba(255,255,255,0.15)", border:"1px solid rgba(255,255,255,0.3)", borderRadius:6, padding:"4px 10px", fontSize:11, fontWeight:700, color:C.blueLight, letterSpacing:"0.08em", textTransform:"uppercase" } as React.CSSProperties,
  headerTitle: { fontSize:22, fontWeight:700, color:C.white, margin:0, letterSpacing:"-0.3px" } as React.CSSProperties,
  headerSub: { fontSize:13, color:C.blueLight, margin:"4px 0 0", fontWeight:400 } as React.CSSProperties,
  tabs: { display:"flex", gap:0, marginTop:18 } as React.CSSProperties,
  body: { padding:"28px 32px" } as React.CSSProperties,
  section: { marginBottom:32 } as React.CSSProperties,
  sectionTitle: { fontSize:16, fontWeight:700, color:C.navy, marginBottom:16, paddingBottom:8, borderBottom:`2px solid ${C.blueLight}`, display:"flex", alignItems:"center", gap:8 } as React.CSSProperties,
  table: { width:"100%", borderCollapse:"collapse" as const, fontSize:13, background:C.white, borderRadius:8, overflow:"hidden", boxShadow:"0 1px 4px rgba(0,0,0,0.07)" },
  kpiGrid: { display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:12 } as React.CSSProperties,
  pillRow: { display:"flex", flexWrap:"wrap" as const, gap:8, margin:"16px 0 20px" },
};

function dot(color: string): React.CSSProperties { return { width:8, height:8, borderRadius:"50%", background:color, flexShrink:0 }; }
function th(w?: string): React.CSSProperties { return { background:C.navy, color:C.white, padding:"10px 14px", textAlign:"left", fontWeight:600, fontSize:12, letterSpacing:"0.04em", textTransform:"uppercase", width:w||"auto" }; }
function td(shade: boolean, bold?: boolean): React.CSSProperties { return { padding:"10px 14px", background:shade ? C.blueFaint : C.white, borderBottom:`1px solid ${C.gray200}`, verticalAlign:"top", lineHeight:1.5, fontWeight:bold?600:400, color:bold?C.navy:C.gray800 }; }
function tabBtn(active: boolean): React.CSSProperties { return { padding:"10px 22px", background:active?C.white:"transparent", color:active?C.navy:C.blueLight, border:"none", borderRadius:"6px 6px 0 0", fontWeight:active?700:500, fontSize:13, cursor:"pointer", letterSpacing:active?"-0.2px":"0", borderBottom:active?`2px solid ${C.white}`:"2px solid transparent" }; }
function alertBox(type: string): React.CSSProperties {
  const m: Record<string,{bg:string;border:string}> = {
    warning:{ bg:C.amberBg, border:C.amber },
    info:   { bg:C.blueFaint, border:C.blue },
    success:{ bg:C.greenBg, border:C.green },
    danger: { bg:C.redBg, border:C.red },
  };
  const s = m[type];
  return { display:"flex", gap:14, background:s.bg, border:`1px solid ${s.border}`, borderLeft:`4px solid ${s.border}`, borderRadius:6, padding:"12px 16px", marginBottom:12, fontSize:13, lineHeight:1.55 };
}
function alertLabel(type: string): React.CSSProperties {
  const colors: Record<string,string> = { warning:C.amber, info:C.blue, success:C.green, danger:C.red };
  return { fontWeight:700, color:colors[type], fontSize:11, letterSpacing:"0.06em", marginBottom:3 };
}
function kpiCard(status: string): React.CSSProperties {
  const m: Record<string,{border:string}> = { ok:{border:C.green}, warn:{border:C.amber}, crit:{border:C.red} };
  return { background:C.white, border:`1px solid ${C.gray200}`, borderTop:`3px solid ${m[status].border}`, borderRadius:8, padding:"14px 16px", boxShadow:"0 1px 3px rgba(0,0,0,0.05)" };
}
function pill(color: string, bg: string): React.CSSProperties { return { background:bg, color, border:`1px solid ${color}`, borderRadius:20, padding:"3px 12px", fontSize:12, fontWeight:600 }; }

// ── Data ──────────────────────────────────────────────────────────────────────
const ROLES = [
  { role:"Team Leader",       type:"ROLE only",        typeColor:C.gray600, trigger:"When project requires technical coordination among 7+ team members",                                           financial:"No additional structure cost — no headcount impact on Org ratio", note:null },
  { role:"Project Manager",   type:"MANDATORY",        typeColor:C.red,     trigger:"Required for any committed activity (Model 3, 4 or 5) or transformation engagement",                           financial:"Without a PM there is no controlled delivery — GM risk is direct and immediate", note:"If no PM is available internally, must link functionally to another entity's PM" },
  { role:"Project Director",  type:"Volume-triggered", typeColor:C.blue,    trigger:"When committed activities require coordination of ~4 PMs",                                                     financial:"1 PD covers a portfolio: analyzes and optimizes GM per project; supports escalations", note:null },
  { role:"Ops Sector Manager",type:"Scale-triggered",  typeColor:C.blueMid, trigger:"When committed activities require coordination of ~6 PDs",                                                     financial:"Defines sector financial objectives, monitors performance, reports to OD", note:null },
  { role:"Operations Director",type:"Strategic",       typeColor:C.navy,    trigger:"When there are 2+ PDs OR a local/country committed strategy is required",                                      financial:"Sets profitability targets, owns BID process, governs EBIT for the full direction", note:"If no OD in the entity, PMs/PDs must link functionally to an OD from another entity" },
];

const AXES = [
  { id:"A", title:"Delivery Management", icon:"🎯", desc:"Ensures commitments are met and operations are auditable at every level.",
    levels:[
      { role:"Project Manager",    text:"Organizes project activities per contract constraints & eXtended Delivery framework. Controls commitments and compliance." },
      { role:"Project Director",   text:"Applies portfolio strategy, ensures PM commitments, supports escalations, drives continuous improvement." },
      { role:"Ops Sector Manager", text:"Defines sector strategy aligned to SII Group objectives. Ensures team deploys projects per eXtended Delivery framework." },
      { role:"Operations Director",text:"Guarantees audit-readiness, sets profitability targets, monitors and challenges financial performance for all operations." },
    ],
    alert:{ type:"success", text:"As OD you define profitability targets for all portfolios and must guarantee 100% projects are ready for audit at any time." },
  },
  { id:"B", title:"People Management", icon:"👥", desc:"Builds, retains and develops the right team. Every departure has a direct EBIT cost.",
    levels:[
      { role:"Project Manager",    text:"Manages team operationally. Motivates around common objectives. Identifies skill gaps and development actions." },
      { role:"Project Director",   text:"Supervises multiple PMs, resolves complex relationship issues, detects talents, coaches PMs." },
      { role:"Ops Sector Manager", text:"Leads large cross-functional teams through PMs and PDs. Coaches PDs, manages OMA trainees, ensures succession." },
      { role:"Operations Director",text:"Builds org culture of controlled risk-taking. Develops leadership at all levels. Ensures 0 key people without identified successor." },
    ],
    alert:{ type:"warning", text:"Departure rate >20% = unplanned bench. Each extra bench point costs ~0.8 pts of EBIT. Succession planning is a financial control tool." },
  },
  { id:"C", title:"Business Support", icon:"📈", desc:"Generates profitable business and transforms engagement models toward WP/FPP.",
    levels:[
      { role:"Project Manager",    text:"Identifies business development opportunities within managed projects. Can act as BID manager." },
      { role:"Project Director",   text:"Acts as BID manager for complex tenders. Accountable for technical feasibility, financial profitability and contractual commitment." },
      { role:"Ops Sector Manager", text:"Creates new opportunities outside current business. Participates in business strategy. Can act as OD in pre-sales phase." },
      { role:"Operations Director",text:"Accountable for full BID management process. Builds packaged delivery offers. Represents SII as a delivery partner. >50% bid win rate required." },
    ],
    alert:{ type:"info", text:"Building packaged delivery offers (WP/FPP) is a formal OD responsibility in this framework — this is your lever to move T&M engagements toward higher-margin models." },
  },
  { id:"D", title:"Soft Skills", icon:"🧭", desc:"Leadership behaviors that protect operational discipline and team cohesion.",
    levels:[
      { role:"Be Committed", text:"PM: exemplary in individual commitments. PD: takes constructive initiatives beyond framework. OSM: makes fully autonomous decisions on key scope elements. OD: stands for strategic decisions with conviction." },
      { role:"Inspire",      text:"PM: calm communicator. PD: grows employees via collective intelligence. OSM: gives credit for success, takes responsibility for mistakes. OD: global vision, leads dialogue at all company levels." },
      { role:"Embody",       text:"PM: basic knowledge of SII values. PD: implements company strategy within their ecosystem. OSM: connects values to day-to-day actions. OD: fully embodies and promotes SII's values." },
    ],
    alert:{ type:"danger", text:"An OD who fails to communicate difficult decisions clearly creates operational ambiguity → unplanned bench → unmanaged contracts → EBIT erosion. Soft skills are risk control." },
  },
];

const KPIS = [
  { name:"Departure Rate (PM/PD/OSM)",      threshold:"< 20%",                  impact:"Unplanned bench → Activity Rate below 92% → EBIT drops directly",                            status:"warn" },
  { name:"Key People with Successor",        threshold:"0 without identified back-up", impact:"Critical operational risk if a key person exits unexpectedly",                           status:"crit" },
  { name:"Customer Satisfaction Coverage",   threshold:"≥ 80% coverage",          impact:"Early signal for delivery or relationship issues — feeds account plan quality",              status:"ok"   },
  { name:"Account Plans Defined",            threshold:"100% in your direction",   impact:"Without a plan there is no upsell or model transformation opportunity",                     status:"warn" },
  { name:"Bid Win Rate",                     threshold:"> 50%",                    impact:"Below that threshold the cost of bid activity is not justified — review Go/NoGo process",  status:"warn" },
  { name:"BID Process Conformity",           threshold:"> 90%",                    impact:"Uncontrolled process = contractual risk = GM exposure at signing",                          status:"crit" },
  { name:"Target Margin Reached",            threshold:"100% of direction",        impact:"The single number that defines whether the year was profitable or not",                     status:"ok"   },
  { name:"eXtended Delivery Conformity",     threshold:"> 80% within direction",   impact:"Below threshold: rework, penalties, and delivery quality failures increase",               status:"ok"   },
  { name:"Business Review On Time",          threshold:"100% with improvement plans", impact:"No review = no control. No plan = no correction. Non-negotiable.",                      status:"warn" },
  { name:"Projects Ready for Audit",         threshold:"100%",                     impact:"A non-auditable project is a latent legal and financial liability",                         status:"crit" },
];

const CMS_CROSS = [
  { careerPath:"OD defines profitability targets",    cms:"GM Calculator + Warning rules (GM < 25% = immediate action)" },
  { careerPath:"OD monitors financial performance",   cms:"EBIT > 10%, Activity Rate > 92%, Bench 3–5%" },
  { careerPath:"Structure justified by volume",       cms:"Ratio 1 BM / 20–30 FTE, Structure < 16% of revenue" },
  { careerPath:"OD accountable for BID process",      cms:"Go/NoGo, COR, WCR — decision gates before any commitment" },
  { careerPath:"Departure rate < 20%",                cms:"Salary Grid + AMW control + PDD to retain key profiles" },
  { careerPath:"Account plans 100% defined",          cms:"WAT + Commitment Models — T&M to WP to FPP transformation path" },
  { careerPath:"Bid win rate > 50%",                  cms:"Correct pricing from minimum GM by commitment model type" },
  { careerPath:"Projects ready for audit",            cms:"eXtended Delivery + Governance & Controlling fully active" },
];

// ── Sub-components ────────────────────────────────────────────────────────────
function AlertBox({ type, text }: { type: string; text: string }) {
  const icons: Record<string,string>  = { warning:"⚠️", info:"ℹ️", success:"✅", danger:"🚨" };
  const labels: Record<string,string> = { warning:"FINANCIAL ALERT", info:"KEY POINT", success:"YOUR ROLE", danger:"RISK" };
  return (
    <div style={alertBox(type)}>
      <span style={{ fontSize:18 }}>{icons[type]}</span>
      <div>
        <div style={alertLabel(type)}>{labels[type]}</div>
        <div>{text}</div>
      </div>
    </div>
  );
}

// ── Tab views ─────────────────────────────────────────────────────────────────
function RolesTab() {
  return (
    <div style={S.section}>
      <div style={S.sectionTitle}><span style={dot(C.navy)} />Role Hierarchy &amp; Activation Triggers</div>
      <AlertBox type="warning" text="Golden Rule: Never appoint a senior role without the volume to justify it. Premature scaling = fixed cost without margin coverage = EBIT at risk." />
      <div style={{ marginTop:16, overflowX:"auto" }}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={th("160px")}>Role</th>
              <th style={th("110px")}>Type</th>
              <th style={th()}>Activation Trigger</th>
              <th style={th()}>Financial Protection</th>
            </tr>
          </thead>
          <tbody>
            {ROLES.map((r, i) => (
              <tr key={r.role}>
                <td style={td(i%2===0, true)}>{r.role}</td>
                <td style={{ ...td(i%2===0), color:r.typeColor, fontWeight:700, fontSize:12 }}>{r.type}</td>
                <td style={td(i%2===0)}>
                  {r.trigger}
                  {r.note && <div style={{ marginTop:4, fontSize:11, color:C.amber, fontStyle:"italic" }}>Note: {r.note}</div>}
                </td>
                <td style={td(i%2===0)}>{r.financial}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AssessmentTab() {
  const [activeAxis, setActiveAxis] = useState("A");
  const axis = AXES.find(a => a.id === activeAxis)!;
  return (
    <div style={S.section}>
      <div style={S.sectionTitle}><span style={dot(C.blue)} />Assessment Criteria — 4 Axes</div>
      <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
        {AXES.map(a => (
          <button key={a.id} onClick={() => setActiveAxis(a.id)} style={{
            padding:"8px 18px", background:activeAxis===a.id?C.navy:C.white,
            color:activeAxis===a.id?C.white:C.navy,
            border:`2px solid ${activeAxis===a.id?C.navy:C.blueLight}`,
            borderRadius:6, fontWeight:600, fontSize:13, cursor:"pointer",
          }}>
            {a.id}. {a.title}
          </button>
        ))}
      </div>
      <div style={{ background:C.white, borderRadius:8, padding:"20px 24px", boxShadow:"0 1px 4px rgba(0,0,0,0.07)", marginBottom:16 }}>
        <div style={{ fontSize:15, fontWeight:700, color:C.navy, marginBottom:6 }}>{axis.title}</div>
        <div style={{ fontSize:13, color:C.gray600, marginBottom:16 }}>{axis.desc}</div>
        <table style={S.table}>
          <thead><tr><th style={th("160px")}>Level</th><th style={th()}>Expected Behavior</th></tr></thead>
          <tbody>
            {axis.levels.map((l, i) => {
              const isTop = i === axis.levels.length - 1;
              const bg = isTop ? C.bluePale : (i%2===0 ? C.blueFaint : C.white);
              return (
                <tr key={l.role}>
                  <td style={{ ...td(i%2===0, true), background:bg, color:isTop?C.navy:C.gray800 }}>
                    {l.role}
                    {isTop && <div style={{ fontSize:10, color:C.blue, fontWeight:700, marginTop:2 }}>↑ YOUR LEVEL</div>}
                  </td>
                  <td style={{ ...td(i%2===0), background:bg }}>{l.text}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <AlertBox type={axis.alert.type} text={axis.alert.text} />
    </div>
  );
}

function KPIsTab() {
  const statusLabel: Record<string,string> = { ok:"ON TRACK", warn:"MONITOR", crit:"CRITICAL" };
  const statusColor: Record<string,string> = { ok:C.green, warn:C.amber, crit:C.red };
  const statusBg:    Record<string,string> = { ok:C.greenBg, warn:C.amberBg, crit:C.redBg };
  return (
    <div style={S.section}>
      <div style={S.sectionTitle}><span style={dot(C.green)} />Performance Indicators — Operations Director Level</div>
      <AlertBox type="info" text="These are the 10 KPIs assigned specifically to the OD level. They are your minimum control dashboard. All must be measured at the appropriate frequency." />
      <div style={S.pillRow}>
        {(["ok","warn","crit"] as const).map(s => (
          <span key={s} style={pill(statusColor[s], statusBg[s])}>{statusLabel[s]}</span>
        ))}
      </div>
      <div style={S.kpiGrid}>
        {KPIS.map(k => (
          <div key={k.name} style={kpiCard(k.status)}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
              <div style={{ fontSize:13, fontWeight:700, color:C.navy }}>{k.name}</div>
              <span style={{ fontSize:10, fontWeight:700, color:statusColor[k.status], background:statusBg[k.status], padding:"2px 7px", borderRadius:10, whiteSpace:"nowrap", marginLeft:8 }}>
                {statusLabel[k.status]}
              </span>
            </div>
            <div style={{ fontSize:12, color:C.gray600, marginBottom:6 }}>🎯 Threshold: <strong>{k.threshold}</strong></div>
            <div style={{ fontSize:11, color:C.gray600, lineHeight:1.4 }}>💥 {k.impact}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CMSTab() {
  return (
    <div style={S.section}>
      <div style={S.sectionTitle}><span style={dot(C.blueMid)} />Career Path × CMS Cross-Reference</div>
      <AlertBox type="info" text="The Career Path defines WHO is responsible for each result. The CMS defines HOW to manage those responsibilities. They are complementary, not alternatives." />
      <div style={{ marginTop:16, overflowX:"auto" }}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={th("50%")}>Career Path Requirement</th>
              <th style={th("50%")}>CMS Governance Tool</th>
            </tr>
          </thead>
          <tbody>
            {CMS_CROSS.map((row, i) => (
              <tr key={i}>
                <td style={{ ...td(i%2===0), borderRight:`1px solid ${C.gray200}` }}>
                  <span style={{ color:C.navy, fontWeight:600 }}>✓</span> {row.careerPath}
                </td>
                <td style={td(i%2===0)}>
                  <span style={{ color:C.blue, fontWeight:600 }}>→</span> {row.cms}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop:24, background:C.navy, borderRadius:8, padding:"20px 24px", color:C.white }}>
        <div style={{ fontWeight:700, fontSize:14, marginBottom:12, color:C.blueLight, letterSpacing:"0.04em" }}>
          5 NON-NEGOTIABLE TAKEAWAYS FOR OPERATIONS DIRECTORS
        </div>
        {[
          "Never scale structure without volume to justify it. Each role has a specific volume trigger. Early appointment = fixed cost without margin coverage.",
          "As OD, you own EBIT, the BID process, and profitability. Not the CFO. Not the BM. You.",
          "Departure rate > 20% is a financial alarm, not just an HR metric. It directly impacts bench, activity rate, and EBIT.",
          "Business Support is not sales — it is model transformation. Moving T&M to WP or FPP is a formal OD responsibility.",
          "100% projects ready for audit is not bureaucracy. It is the guarantee that your delivery is controlled, your GM is real, and your operation is sustainable.",
        ].map((t, i) => (
          <div key={i} style={{ display:"flex", gap:14, marginBottom:i<4?12:0 }}>
            <div style={{ flexShrink:0, width:26, height:26, borderRadius:"50%", background:C.blue, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:13 }}>
              {i+1}
            </div>
            <div style={{ fontSize:13, lineHeight:1.55, color:C.bluePale }}>{t}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
const TABS = [
  { id:"roles",       label:"Role Hierarchy",     component:RolesTab },
  { id:"assessment",  label:"Assessment Criteria", component:AssessmentTab },
  { id:"kpis",        label:"KPIs",                component:KPIsTab },
  { id:"cms",         label:"CMS Cross-Reference", component:CMSTab },
];

export default function CareerPathTab() {
  const [activeTab, setActiveTab] = useState("roles");
  const Active = TABS.find(t => t.id === activeTab)!.component;

  return (
    <div style={S.root}>
      <div style={S.header}>
        <div style={S.headerTop}>
          <span style={S.badge}>SII Group</span>
          <span style={S.badge}>Operations</span>
        </div>
        <h2 style={S.headerTitle}>Operation Management Career Path</h2>
        <p style={S.headerSub}>Role hierarchy · Assessment criteria · KPIs · CMS alignment — for Operations Directors</p>
        <div style={S.tabs}>
          {TABS.map(t => (
            <button key={t.id} style={tabBtn(activeTab===t.id)} onClick={() => setActiveTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div style={S.body}>
        <Active />
      </div>
    </div>
  );
}
