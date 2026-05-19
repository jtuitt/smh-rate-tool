import { useState, useMemo, useCallback, useRef } from "react";

// ─── DATA ─────────────────────────────────────────────────────────────────────

const GEO_TIERS = {
  "T1 – High Cost / Remote": 1.18,
  "T2 – Regional Market": 1.07,
  "T3 – Mid-Market": 1.00,
  "T4 – Competitive / High Supply": 0.91,
};
const FACILITY_TYPES = {
  "Academic / Flagship": 1.12,
  "Community Hospital": 1.00,
  "Critical Access": 1.18,
  "ASC / Outpatient": 0.94,
  "VA / Federal": 0.93,
};
const LEVERAGE_LABELS = ["","Low","Low-Med","Moderate","High","Max"];
const LEVERAGE_COLORS = ["","#6b7280","#d97706","#f59e0b","#059669","#dc2626"];
const CONFIDENCE_LABELS = {
  5:{ label:"★★★ Internal",   color:"#059669", bg:"#f0fdf4" },
  4:{ label:"★★☆ Benchmark", color:"#3b82f6", bg:"#eff6ff" },
  3:{ label:"★☆☆ Estimate",  color:"#d97706", bg:"#fffbeb" },
  2:{ label:"⚠ Limited",     color:"#ef4444", bg:"#fef2f2" },
};

const SPECIALTY_DATA = {
  "Hospitalist (Standard)":           { type:"MD",  category:"High Volume", negotiationLeverage:3, confidence:5, payLow:210, payHigh:230, billLow:260, billHigh:296, billTarget:300, marginTypical:[0.25,0.33], leverageNote:"High supply, competitive market. SMH has extensive internal placement data.", keyFactors:["Shift type (day/night/swing)","Facility volume","Call burden"], acceptanceDrivers:"rate", shiftRef:{ hourlyDay:[210,230], flatNightCall:[700,900], callback:[210,250], weekend24:[1800,2200] } },
  "Hospitalist (Premium / MUSC-type)":{ type:"MD",  category:"High Volume", negotiationLeverage:4, confidence:4, payLow:250, payHigh:270, billLow:365, billHigh:365, billTarget:365, marginTypical:[0.27,0.32], leverageNote:"Academic/flagship sites. MUSC, large systems.", keyFactors:["Academic affiliation","Subspecialty skills","System prestige"], acceptanceDrivers:"rate + credentials", shiftRef:{ hourlyDay:[250,270], flatNightCall:[900,1100], callback:[250,280], weekend24:[2200,2600] } },
  "Nocturnist":                        { type:"MD",  category:"High Volume", negotiationLeverage:4, confidence:5, payLow:240, payHigh:260, billLow:295, billHigh:325, billTarget:340, marginTypical:[0.20,0.28], leverageNote:"Night premium justified. 6+ SMH internal placements.", keyFactors:["Shift structure","Nights only preference","Solo vs team coverage"], acceptanceDrivers:"pay rate", shiftRef:{ hourlyNight:[240,260], flatNightCall:[1800,2200], callback:[240,270] } },
  "Internal Medicine":                 { type:"MD",  category:"High Volume", negotiationLeverage:3, confidence:4, payLow:165, payHigh:175, billLow:185, billHigh:220, billTarget:210, marginTypical:[0.20,0.26], leverageNote:"High supply. Survey avg $182/hr. Competitive.", keyFactors:["Inpatient vs outpatient","Geographic preference"], acceptanceDrivers:"rate", shiftRef:{ hourlyDay:[165,175] } },
  "Family Medicine":                   { type:"MD",  category:"High Volume", negotiationLeverage:2, confidence:4, payLow:130, payHigh:160, billLow:160, billHigh:200, billTarget:200, marginTypical:[0.18,0.22], leverageNote:"Lowest leverage. Volume play only. Survey $144/hr avg.", keyFactors:["Outpatient only vs urgent care","Panel size"], acceptanceDrivers:"schedule", shiftRef:{ hourlyDay:[130,160] } },
  "Emergency Medicine":                { type:"MD",  category:"Hard Fill",   negotiationLeverage:4, confidence:5, payLow:290, payHigh:320, billLow:325, billHigh:425, billTarget:425, marginTypical:[0.22,0.28], leverageNote:"Strongest performer. 4 internal placements. Docs regularly ask $350+.", keyFactors:["Annual volume","Trauma level","Peds capacity","Single vs double coverage"], acceptanceDrivers:"rate + schedule", shiftRef:{ hourlyDay:[290,320], flatNightCall:[2400,3000], callback:[300,350], weekend24:[2800,3400] } },
  "Anesthesiology":                    { type:"MD",  category:"Hard Fill",   negotiationLeverage:5, confidence:4, payLow:390, payHigh:420, billLow:450, billHigh:575, billTarget:575, marginTypical:[0.12,0.18], leverageNote:"Thin margin. Watch closely. Seller's market.", keyFactors:["Case mix","Call burden","Cardiac/OB subspecialty","ASC vs hospital"], acceptanceDrivers:"pay rate + case mix", shiftRef:{ hourlyDay:[390,420], flatNightCall:[2800,3400], callback:[400,450] } },
  "OB/GYN (Daytime)":                  { type:"MD",  category:"Hard Fill",   negotiationLeverage:4, confidence:4, payLow:180, payHigh:210, billLow:200, billHigh:260, billTarget:260, marginTypical:[0.22,0.28], leverageNote:"Corrected floor $200. Novant $287-325/hr market rate.", keyFactors:["Deliveries included","Clinic vs hospital","Scope of practice"], acceptanceDrivers:"rate + schedule", shiftRef:{ hourlyDay:[180,210], flatNightCall:[1400,1800], callback:[200,240] } },
  "OB/GYN (24hr Call)":                { type:"MD",  category:"Hard Fill",   negotiationLeverage:4, confidence:4, payLow:280, payHigh:320, billLow:350, billHigh:420, billTarget:420, marginTypical:[0.22,0.28], leverageNote:"Call rate well-supported. 24hr assignments command premium.", keyFactors:["Call volume","C-section rate","Backup available"], acceptanceDrivers:"pay rate", shiftRef:{ flatCall24:[2400,2900], callback:[280,340] } },
  "Maternal Fetal Medicine":           { type:"MD",  category:"Hard Fill",   negotiationLeverage:5, confidence:4, payLow:360, payHigh:420, billLow:480, billHigh:550, billTarget:550, marginTypical:[0.24,0.30], leverageNote:"Novant $3,340+/day. Very limited supply.", keyFactors:["Fetal surveillance capacity","Academic training"], acceptanceDrivers:"pay rate + location", shiftRef:{ hourlyDay:[360,420], flatCall24:[2800,3400] } },
  "Gastroenterology":                  { type:"MD",  category:"Specialty",   negotiationLeverage:4, confidence:4, payLow:340, payHigh:360, billLow:400, billHigh:500, billTarget:500, marginTypical:[0.20,0.28], leverageNote:"STRONG. Day rate $4,400-6,500. Strong demand.", keyFactors:["Call burden","Endoscopy volume","Inpatient consults","24hr vs day only"], acceptanceDrivers:"pay rate + call structure", shiftRef:{ hourlyDay:[340,360], flatDay:[2700,3200], flatCall24:[3600,4500], callback:[350,400] } },
  "Cardiology (General)":              { type:"MD",  category:"Specialty",   negotiationLeverage:4, confidence:3, payLow:285, payHigh:310, billLow:350, billHigh:450, billTarget:450, marginTypical:[0.22,0.28], leverageNote:"Doximity $495/hr locums est. No SMH internal yet.", keyFactors:["Invasive vs non-invasive","Cath lab access","Call frequency"], acceptanceDrivers:"rate + case mix", shiftRef:{ hourlyDay:[285,310], flatCall24:[2400,3000] } },
  "Cardiology (Interventional)":       { type:"MD",  category:"Specialty",   negotiationLeverage:5, confidence:4, payLow:310, payHigh:360, billLow:450, billHigh:500, billTarget:500, marginTypical:[0.22,0.28], leverageNote:"Novant + Doximity strongly validate.", keyFactors:["Cath lab volume","STEMI coverage","Structural heart"], acceptanceDrivers:"pay rate + volume", shiftRef:{ hourlyDay:[310,360], callback:[320,380] } },
  "Cardiovascular Surgery":            { type:"MD",  category:"Hard Fill",   negotiationLeverage:5, confidence:4, payLow:500, payHigh:600, billLow:650, billHigh:750, billTarget:750, marginTypical:[0.18,0.22], leverageNote:"Novant $3,680+/day. Very limited pool.", keyFactors:["Program volume","CABG vs valve mix","Perfusionist availability"], acceptanceDrivers:"pay rate + program quality", shiftRef:{ hourlyDay:[500,600], flatDay:[4000,5000] } },
  "Pulmonary / Critical Care":         { type:"MD",  category:"Specialty",   negotiationLeverage:4, confidence:4, payLow:280, payHigh:310, billLow:375, billHigh:425, billTarget:425, marginTypical:[0.22,0.28], leverageNote:"STRONG call rates. Novant $3,018-3,255/day.", keyFactors:["ICU size","Ventilator management","Rounding model"], acceptanceDrivers:"pay rate + call", shiftRef:{ hourlyDay:[280,310], flatCall24:[2400,2900], callback:[290,330] } },
  "Critical Care (only)":              { type:"MD",  category:"Specialty",   negotiationLeverage:4, confidence:3, payLow:260, payHigh:300, billLow:360, billHigh:400, billTarget:400, marginTypical:[0.22,0.26], leverageNote:"Novant CC $372-411/hr direct. Survey avg $306/hr.", keyFactors:["Unit level (MICU/SICU)","Intensivist model","Procedures expected"], acceptanceDrivers:"rate", shiftRef:{ hourlyDay:[260,300] } },
  "Psychiatry":                        { type:"MD",  category:"Specialty",   negotiationLeverage:4, confidence:4, payLow:230, payHigh:260, billLow:300, billHigh:350, billTarget:350, marginTypical:[0.25,0.32], leverageNote:"STRONG — easy recruit, good margin. $198 survey avg.", keyFactors:["Inpatient vs outpatient","Medication management vs therapy","Call"], acceptanceDrivers:"schedule + location", shiftRef:{ hourlyDay:[230,260] } },
  "Hematology / Oncology":             { type:"MD",  category:"Specialty",   negotiationLeverage:4, confidence:3, payLow:300, payHigh:360, billLow:390, billHigh:450, billTarget:450, marginTypical:[0.20,0.26], leverageNote:"High value, limited supply. Doximity $424/hr locums est.", keyFactors:["Infusion center","Inpatient consults","Clinical trial involvement"], acceptanceDrivers:"rate + case mix", shiftRef:{ hourlyDay:[300,360] } },
  "Nephrology":                        { type:"MD",  category:"Specialty",   negotiationLeverage:3, confidence:2, payLow:200, payHigh:240, billLow:280, billHigh:325, billTarget:325, marginTypical:[0.22,0.28], leverageNote:"Survey n=5, limited data. Doximity $222/hr est.", keyFactors:["Dialysis rounds","Transplant involvement","Consult volume"], acceptanceDrivers:"rate", shiftRef:{ hourlyDay:[200,240] } },
  "Neurology":                         { type:"MD",  category:"Specialty",   negotiationLeverage:4, confidence:3, payLow:260, payHigh:300, billLow:340, billHigh:400, billTarget:400, marginTypical:[0.22,0.26], leverageNote:"Novant $310-343/hr. Wide survey range $220-1000.", keyFactors:["Stroke neurology","EMG/EEG","Inpatient vs outpatient"], acceptanceDrivers:"case mix", shiftRef:{ hourlyDay:[260,300] } },
  "Neurosurgery (Coverage)":           { type:"MD",  category:"Hard Fill",   negotiationLeverage:5, confidence:4, payLow:320, payHigh:380, billLow:400, billHigh:500, billTarget:500, marginTypical:[0.18,0.24], leverageNote:"Standard coverage $300-500/hr. Novant $4,880-5,454/day.", keyFactors:["Call frequency","OR volume","Trauma level"], acceptanceDrivers:"pay rate + schedule", shiftRef:{ hourlyDay:[320,380], flatCall24:[2800,3600], callback:[340,400] } },
  "Neurosurgery (Program/24hr)":       { type:"MD",  category:"Hard Fill",   negotiationLeverage:5, confidence:5, isDayRate:true, payLow:700, payHigh:800, billLow:4000, billHigh:5500, billTarget:5500, marginTypical:[0.25,0.30], leverageNote:"★ INTERNALLY VALIDATED — Aultman $5,500/day.", keyFactors:["Program type","OR case volume","24hr vs shifts"], acceptanceDrivers:"pay rate", shiftRef:{ flatDay:[700,800] } },
  "Interventional Radiology":          { type:"MD",  category:"Hard Fill",   negotiationLeverage:5, confidence:5, payLow:480, payHigh:520, billLow:500, billHigh:700, billTarget:700, marginTypical:[0.22,0.28], leverageNote:"VALIDATED — SGHS internal confirms. UPMC $600-650/hr.", keyFactors:["IR procedure volume","Night call","Hybrid suite access"], acceptanceDrivers:"rate + volume", shiftRef:{ hourlyDay:[480,520], callback:[500,550] } },
  "Radiology (Diagnostic)":            { type:"MD",  category:"Hard Fill",   negotiationLeverage:5, confidence:5, payLow:380, payHigh:450, billLow:500, billHigh:600, billTarget:600, marginTypical:[0.18,0.24], leverageNote:"VALIDATED — SGHS $500-535 internal. Doximity $482/hr est.", keyFactors:["Read volume","Subspecialty (neuro, body)","Teleradiology option"], acceptanceDrivers:"rate + volume", shiftRef:{ hourlyDay:[380,450] } },
  "Radiation Oncology":                { type:"MD",  category:"Specialty",   negotiationLeverage:4, confidence:3, payLow:220, payHigh:260, billLow:300, billHigh:350, billTarget:350, marginTypical:[0.22,0.28], leverageNote:"Novant $2,344+/day. Doximity $496/hr.", keyFactors:["Linear accelerator volume","Brachytherapy","Consult volume"], acceptanceDrivers:"rate", shiftRef:{ hourlyDay:[220,260] } },
  "General Surgery":                   { type:"MD",  category:"Specialty",   negotiationLeverage:3, confidence:3, payLow:200, payHigh:240, billLow:280, billHigh:325, billTarget:325, marginTypical:[0.22,0.28], leverageNote:"Survey n=22, solid data. Doximity $407/hr.", keyFactors:["Elective vs emergency","Trauma coverage","Endoscopy expected"], acceptanceDrivers:"rate + case mix", shiftRef:{ hourlyDay:[200,240], flatCall24:[1800,2400], callback:[220,260] } },
  "Orthopedic Surgery":                { type:"MD",  category:"Specialty",   negotiationLeverage:4, confidence:2, payLow:240, payHigh:280, billLow:330, billHigh:375, billTarget:375, marginTypical:[0.22,0.28], leverageNote:"Limited survey data (n=3). Doximity $573/hr.", keyFactors:["Joint vs spine","Trauma coverage","ASC availability"], acceptanceDrivers:"case mix", shiftRef:{ hourlyDay:[240,280] } },
  "Vascular Surgery":                  { type:"MD",  category:"Specialty",   negotiationLeverage:4, confidence:2, payLow:280, payHigh:340, billLow:380, billHigh:450, billTarget:450, marginTypical:[0.20,0.26], leverageNote:"Wide survey range $200-450. Doximity $486/hr.", keyFactors:["Open vs endovascular","Call burden","Program volume"], acceptanceDrivers:"rate", shiftRef:{ hourlyDay:[280,340] } },
  "Urology":                           { type:"MD",  category:"Hard Fill",   negotiationLeverage:4, confidence:5, isDayRate:true, payLow:3200, payHigh:3200, billLow:3200, billHigh:4000, billTarget:4000, marginTypical:[0.20,0.26], leverageNote:"VALIDATED — Novant/internal $4,000/day bill, $3,200/day SMH pay.", keyFactors:["Clinic vs call","OR volume","24hr vs day shift"], acceptanceDrivers:"pay rate + structure", shiftRef:{ flatDay:[3200,3200] } },
  "Rheumatology":                      { type:"MD",  category:"Specialty",   negotiationLeverage:3, confidence:2, payLow:200, payHigh:260, billLow:280, billHigh:350, billTarget:350, marginTypical:[0.22,0.28], leverageNote:"Wide rate range. Survey avg $254/hr.", keyFactors:["Infusion","Consult volume","Outpatient only vs inpatient"], acceptanceDrivers:"schedule", shiftRef:{ hourlyDay:[200,260] } },
  "Endocrinology":                     { type:"MD",  category:"Specialty",   negotiationLeverage:2, confidence:2, payLow:160, payHigh:200, billLow:220, billHigh:280, billTarget:280, marginTypical:[0.20,0.26], leverageNote:"LOW PRIORITY. Survey avg $145/hr. Abundant supply.", keyFactors:["Diabetes focus","Thyroid procedures","Outpatient only"], acceptanceDrivers:"schedule + location", shiftRef:{ hourlyDay:[160,200] } },
  "Infectious Disease":                { type:"MD",  category:"Specialty",   negotiationLeverage:3, confidence:2, payLow:200, payHigh:240, billLow:270, billHigh:320, billTarget:320, marginTypical:[0.22,0.26], leverageNote:"Limited survey data (n=2). Growing demand post-COVID.", keyFactors:["Stewardship program","HIV/transplant","Hospital epidemiology"], acceptanceDrivers:"rate", shiftRef:{ hourlyDay:[200,240] } },
  "Pediatric Hospitalist":             { type:"MD",  category:"Specialty",   negotiationLeverage:3, confidence:3, payLow:180, payHigh:200, billLow:200, billHigh:250, billTarget:250, marginTypical:[0.20,0.26], leverageNote:"SageWest 24hr=$2,525. Novant $176-207/hr.", keyFactors:["Inpatient volume","NICU availability","24hr vs day coverage"], acceptanceDrivers:"rate + location", shiftRef:{ hourlyDay:[180,200], flatCall24:[1600,2100] } },
  "Pediatrics":                        { type:"MD",  category:"Specialty",   negotiationLeverage:3, confidence:3, payLow:150, payHigh:180, billLow:180, billHigh:230, billTarget:230, marginTypical:[0.18,0.24], leverageNote:"Survey avg $95/hr (wide range $80-230).", keyFactors:["Well-child vs acute","Hospital coverage","Subspecialty"], acceptanceDrivers:"schedule", shiftRef:{ hourlyDay:[150,180] } },
  "APP - Hospitalist (NP/PA)":         { type:"APP", category:"APP",         negotiationLeverage:2, confidence:5, payLow:110, payHigh:130, billLow:150, billHigh:175, billTarget:175, marginTypical:[0.22,0.30], leverageNote:"INTERNAL — Brockton/HH/Landmark data. Market $80-130/hr.", keyFactors:["Nights vs days","SCU coverage","Supervising physician model"], acceptanceDrivers:"rate", shiftRef:{ hourlyDay:[110,130], hourlyNight:[115,135] } },
  "APP - Urology (NP/PA)":             { type:"APP", category:"APP",         negotiationLeverage:3, confidence:5, payLow:300, payHigh:320, billLow:450, billHigh:500, billTarget:500, marginTypical:[0.30,0.36], leverageNote:"Novant/Urology APP $500/hr bill. SMH pay $300/hr confirmed.", keyFactors:["OR first assist","Clinic vs surgical","Supervision model"], acceptanceDrivers:"rate", shiftRef:{ hourlyDay:[300,320] } },
  "APP - Emergency Medicine (NP/PA)":  { type:"APP", category:"APP",         negotiationLeverage:2, confidence:3, payLow:90,  payHigh:120, billLow:140, billHigh:190, billTarget:190, marginTypical:[0.25,0.32], leverageNote:"Market $90-130/hr. Fast-track vs full-scope drives rate.", keyFactors:["Fast-track vs main ED","Volume","Autonomy level"], acceptanceDrivers:"schedule", shiftRef:{ hourlyDay:[90,120] } },
  "APP - Surgery (NP/PA)":             { type:"APP", category:"APP",         negotiationLeverage:2, confidence:3, payLow:90,  payHigh:130, billLow:140, billHigh:200, billTarget:200, marginTypical:[0.25,0.32], leverageNote:"Procedural APPs command higher rates. Market $90-130/hr.", keyFactors:["First assist","Wound care","Scope of procedures"], acceptanceDrivers:"scope", shiftRef:{ hourlyDay:[90,130] } },
  "APP - Critical Care (NP/PA)":       { type:"APP", category:"APP",         negotiationLeverage:3, confidence:2, payLow:100, payHigh:140, billLow:160, billHigh:210, billTarget:210, marginTypical:[0.24,0.30], leverageNote:"ICU APPs increasingly valued. Limited benchmarks.", keyFactors:["ICU procedures","Supervision model","Unit size"], acceptanceDrivers:"rate + scope", shiftRef:{ hourlyDay:[100,140] } },
  "CRNA":                              { type:"CRNA",category:"Hard Fill",   negotiationLeverage:5, confidence:5, payLow:150, payHigh:220, billLow:200, billHigh:340, billTarget:300, marginTypical:[0.18,0.25], leverageNote:"Structural seller's market. T1 states $290-340/hr bill. 70-80% pay/bill ratio.", keyFactors:["State tier (opt-out vs supervised)","Setting (ASC/hospital)","Subspecialty (cardiac/OB/peds)","Rural premium"], acceptanceDrivers:"pay rate + package transparency", shiftRef:{ hourlyDay:[150,220], flatCall24:[1200,1760], callback:[150,220] } },
};

const SHIFT_REF_LABELS = {
  hourlyDay:       "Hourly – Day/Clinic ($/hr)",
  hourlyNight:     "Hourly – Night ($/hr)",
  flatNightCall:   "Flat Night Call ($/shift)",
  flatCall24:      "Flat 24hr Call ($/shift)",
  flatDay:         "Flat Day Rate ($/shift)",
  callback:        "Callback Rate ($/hr)",
  weekend24:       "Weekend 24hr ($/shift)",
};

const SHIFT_TYPES = [
  { id:"hourly_day",        label:"Hourly – Day / Clinic",         unit:"hr",    hasGratis:false, refKey:"hourlyDay",     desc:"Standard daytime hourly rate." },
  { id:"hourly_night",      label:"Hourly – Night Coverage",       unit:"hr",    hasGratis:false, refKey:"hourlyNight",   desc:"Overnight hourly coverage." },
  { id:"flat_call_wkday",   label:"Flat – Weekday Night Call",     unit:"shift", hasGratis:true,  refKey:"flatNightCall", desc:"Fixed amount for being on-call overnight weekdays. Set gratis = hours included before callback triggers." },
  { id:"flat_call_wkend",   label:"Flat – Weekend 24hr Call",      unit:"shift", hasGratis:true,  refKey:"weekend24",     desc:"Fixed day rate for full weekend 24hr. Set gratis = hours included before callback." },
  { id:"flat_call_wkday24", label:"Flat – Weekday 24hr Call",      unit:"shift", hasGratis:true,  refKey:"flatCall24",    desc:"Fixed day rate for full weekday 24hr. Set gratis = hours included before callback." },
  { id:"callback",          label:"Callback Only (no flat rate)",  unit:"hr",    hasGratis:false, refKey:"callback",      desc:"Use ONLY when there is no flat call rate — purely paid per hour when physically called in. If there IS a flat rate, use a Flat Call component and enter callback in the gratis threshold section instead." },
  { id:"flat_day",          label:"Flat – Day Shift",              unit:"shift", hasGratis:false, refKey:"flatDay",       desc:"Fixed rate per day shift regardless of hours worked." },
  { id:"holiday",           label:"Holiday Rate",                  unit:"shift", hasGratis:false, refKey:null,            desc:"Special rate for holiday coverage." },
  { id:"custom",            label:"Custom Component",              unit:"unit",  hasGratis:false, refKey:null,            desc:"Any other compensation element." },
];

const CATEGORIES = ["All","High Volume","Specialty","Hard Fill","APP","CRNA"];
const TYPES      = ["All","MD","APP","CRNA"];

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const f$ = (n,d=0) => n==null||n===""?"—":"$"+Number(n).toLocaleString("en-US",{minimumFractionDigits:d,maximumFractionDigits:d});
const fpct = (n,d=1) => (n>=0?"+":"")+n.toFixed(d)+"%";
const applyMod = (base,geo,fac) => Math.round(base*(GEO_TIERS[geo]??1)*(FACILITY_TYPES[fac]??1));
const mColor = m => m>=22?"#059669":m>=15?"#d97706":"#dc2626";

const S = {
  inp:  { padding:"8px 11px", borderRadius:8, border:"1.5px solid #d1d5db", fontSize:13, background:"white", color:"#111827", outline:"none", fontFamily:"'DM Sans',sans-serif", width:"100%", boxSizing:"border-box" },
  card: { background:"white", borderRadius:12, padding:"16px 20px", boxShadow:"0 1px 4px rgba(0,0,0,0.07)", border:"1px solid #f3f4f6" },
  lbl:  { fontSize:11, fontWeight:600, color:"#374151", display:"block", marginBottom:3 },
  mono: { fontFamily:"'DM Mono',monospace" },
};

// ─── ATOMS ────────────────────────────────────────────────────────────────────

function DollarInput({ value, onChange, placeholder, style={} }) {
  return (
    <div style={{ position:"relative" }}>
      <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"#9ca3af", pointerEvents:"none" }}>$</span>
      <input type="number" value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder||"0"} style={{ ...S.inp, paddingLeft:24, ...style }} />
    </div>
  );
}

function LeverageMeter({ value }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:5 }}>
      {[1,2,3,4,5].map(i=>(
        <div key={i} style={{ width:13, height:13, borderRadius:3, background:i<=value?LEVERAGE_COLORS[value]:"#e5e7eb" }} />
      ))}
      <span style={{ fontSize:11, color:LEVERAGE_COLORS[value], fontWeight:700, fontFamily:"monospace" }}>{LEVERAGE_LABELS[value]}</span>
    </div>
  );
}

function ConfBadge({ level }) {
  const c = CONFIDENCE_LABELS[level]??CONFIDENCE_LABELS[3];
  return <span style={{ fontSize:10, padding:"2px 8px", borderRadius:12, background:c.bg, color:c.color, fontWeight:700 }}>{c.label}</span>;
}

function StatBox({ label, sub, value, color, bg, border }) {
  return (
    <div style={{ background:bg||"#f8fafc", borderRadius:10, padding:"11px 10px", textAlign:"center", border:border||"none" }}>
      <div style={{ fontSize:9, color:"#9ca3af", textTransform:"uppercase", letterSpacing:0.5 }}>{label}</div>
      {sub&&<div style={{ fontSize:10, color:"#6b7280", marginTop:1 }}>{sub}</div>}
      <div style={{ fontSize:17, fontWeight:700, color:color||"#111827", marginTop:4, fontFamily:"'DM Mono',monospace" }}>{value}</div>
    </div>
  );
}

// ─── MARGIN TABLE ─────────────────────────────────────────────────────────────

function MarginTable({ basePay, baseBill, defaultUnit="hourly" }) {
  const [visible, setVisible] = useState(true);
  const [unit, setUnit] = useState(defaultUnit);
  const pay  = parseFloat(basePay);
  const bill = parseFloat(baseBill);
  if (!pay||!bill||pay<=0||bill<=0) return null;
  const mult = { hourly:1, daily:8, weekly:40 }[unit]||1;
  const sp = pay*mult, sb = bill*mult;
  const steps = [-0.10,-0.05,0,0.05,0.10,0.15,0.20,0.25,0.30,0.35,0.40,0.45];
  const payRows  = steps.map(s=>({ pct:s, rate:Math.round(sp*(1+s)) }));
  const billCols = steps.map(s=>({ pct:s, rate:Math.round(sb*(1+s)) }));
  const cm = (p,b) => b>0?((b-p)/b)*100:0;
  const th = { padding:"6px 7px", fontSize:10, fontWeight:700, color:"#6b7280", textAlign:"center", background:"#f8fafc", whiteSpace:"nowrap", borderBottom:"2px solid #e5e7eb" };
  const td = (m,pb,bb) => ({
    padding:"6px 7px", fontSize:11, textAlign:"center", fontFamily:"'DM Mono',monospace",
    fontWeight:(pb&&bb)?700:400,
    background:(pb&&bb)?"#0f172a":m>=30?"#86efac":m>=25?"#bbf7d0":m>=20?"#d1fae5":m>=15?"#fef9c3":m>=10?"#fed7aa":"#fecaca",
    color:(pb&&bb)?"white":m>=25?"#065f46":m>=20?"#065f46":m>=15?"#713f12":m>=10?"#9a3412":"#991b1b",
    border:(pb&&bb)?"2px solid #3b82f6":"none",
  });
  return (
    <div style={{ ...S.card, marginTop:16 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10, marginBottom:visible?12:0 }}>
        <div>
          <div style={{ fontSize:14, fontWeight:700 }}>Margin Negotiation Table</div>
          {visible&&<div style={{ fontSize:11, color:"#6b7280", marginTop:1 }}>Pay −10%→+45% · Bill −10%→+45% · 5% steps · Dark cell = current</div>}
        </div>
        <div style={{ display:"flex", gap:6, alignItems:"center" }}>
          {visible&&["hourly","daily","weekly"].map(u=>(
            <button key={u} onClick={()=>setUnit(u)} style={{ padding:"4px 10px", borderRadius:14, border:`1.5px solid ${unit===u?"#0f172a":"#e5e7eb"}`, background:unit===u?"#0f172a":"white", color:unit===u?"white":"#6b7280", fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", textTransform:"capitalize" }}>{u}</button>
          ))}
          <button onClick={()=>setVisible(v=>!v)} style={{ padding:"4px 11px", borderRadius:14, border:"1.5px solid #e5e7eb", background:"white", color:"#6b7280", fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>{visible?"▲ Hide":"▼ Show Table"}</button>
        </div>
      </div>
      {visible&&(
        <>
          <div style={{ display:"flex", gap:6, marginBottom:10, flexWrap:"wrap" }}>
            {[{bg:"#86efac",c:"#065f46",l:"≥30%"},{bg:"#bbf7d0",c:"#065f46",l:"25-29%"},{bg:"#d1fae5",c:"#065f46",l:"20-24%"},{bg:"#fef9c3",c:"#713f12",l:"15-19%"},{bg:"#fed7aa",c:"#9a3412",l:"10-14%"},{bg:"#fecaca",c:"#991b1b",l:"<10%"},{bg:"#0f172a",c:"white",l:"Current"}].map(x=>(
              <div key={x.l} style={{ display:"flex", alignItems:"center", gap:3 }}>
                <div style={{ width:12, height:12, borderRadius:3, background:x.bg, border:x.bg==="#0f172a"?"none":"1px solid #e5e7eb" }} />
                <span style={{ fontSize:10, color:"#374151" }}>{x.l}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize:11, color:"#6b7280", marginBottom:8 }}>
            <strong>{unit}</strong> view — base pay {f$(sp)} · base bill {f$(sb)}
          </div>
          <div style={{ overflowX:"auto", maxHeight:460, overflowY:"auto" }}>
            <table style={{ borderCollapse:"collapse", minWidth:900 }}>
              <thead>
                <tr>
                  <th style={{ ...th, textAlign:"left", minWidth:128, position:"sticky", top:0, zIndex:2 }}>Pay ↓ / Bill →</th>
                  {billCols.map(c=>(
                    <th key={c.pct} style={{ ...th, minWidth:70, position:"sticky", top:0, zIndex:2 }}>
                      <div style={{ color:c.pct===0?"#0f172a":c.pct>0?"#059669":"#dc2626", fontWeight:c.pct===0?800:600 }}>
                        {c.pct===0?"Base":(c.pct>0?"+":"")+(c.pct*100).toFixed(0)+"%"}
                      </div>
                      <div style={{ fontWeight:700, color:"#374151", fontSize:11 }}>{f$(c.rate)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payRows.map(r=>(
                  <tr key={r.pct}>
                    <td style={{ padding:"6px 10px", fontSize:11, background:"#f8fafc", borderRight:"2px solid #e5e7eb", whiteSpace:"nowrap", position:"sticky", left:0 }}>
                      <span style={{ color:r.pct===0?"#0f172a":r.pct>0?"#dc2626":"#059669", fontWeight:r.pct===0?800:600 }}>
                        {r.pct===0?"Base":(r.pct>0?"+":"")+(r.pct*100).toFixed(0)+"%"}
                      </span>
                      <span style={{ marginLeft:6, fontWeight:700, ...S.mono }}>{f$(r.rate)}</span>
                    </td>
                    {billCols.map(c=>{
                      const m=cm(r.rate,c.rate);
                      return <td key={c.pct} style={td(m,r.pct===0,c.pct===0)}>{m.toFixed(1)}%</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop:10, padding:"8px 12px", background:"#f8fafc", borderRadius:8, fontSize:11, color:"#374151" }}>
            💡 Your current deal is the highlighted cell. Rows = doctor negotiates pay up. Columns = what you need to bill to hold margin. Toggle daily/weekly to see real dollar impact.
          </div>
        </>
      )}
    </div>
  );
}

// ─── BID DEAL SHEET ───────────────────────────────────────────────────────────

function DealSheet({ scenario, onClose }) {
  if (!scenario) return null;
  const { specialty, geo, fac, pay, bill, margin, likelihood, likelihoodLabel, weeks, assignmentValue, assignmentGP, recommendation, confidence, leverageNote, shiftComponents } = scenario;
  const sp = SPECIALTY_DATA[specialty];
  const printRef = useRef();

  const handleCopy = () => {
    const text = `SMH INNOVATIONS — DEAL SUMMARY\n${"─".repeat(40)}\nSpecialty: ${specialty}\nGeo Tier: ${geo}\nFacility: ${fac}\nDoc Pay Rate: ${f$(pay)}/hr\nBill Rate: ${f$(bill)}/hr\nMargin: ${margin?.toFixed(1)}%\nAcceptance Likelihood: ${likelihood}% (${likelihoodLabel})\nAssignment (${weeks} wks): Rev ${f$(assignmentValue)} | GP ${f$(assignmentGP)}\nRecommendation: ${recommendation}\n\nData Confidence: ${CONFIDENCE_LABELS[confidence]?.label}\nIntel: ${leverageNote}`;
    navigator.clipboard.writeText(text).catch(()=>{});
  };

  return (
    <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.5)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div ref={printRef} style={{ background:"white", borderRadius:16, maxWidth:620, width:"100%", maxHeight:"90vh", overflowY:"auto", boxShadow:"0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ background:"linear-gradient(135deg,#0f172a,#1e3a5f)", padding:"20px 24px", borderRadius:"16px 16px 0 0", color:"white" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div>
              <div style={{ fontSize:10, opacity:0.5, letterSpacing:3, textTransform:"uppercase", fontFamily:"'DM Mono',monospace" }}>SMH Innovations · Deal Summary</div>
              <div style={{ fontSize:20, fontWeight:700, marginTop:4 }}>{specialty}</div>
              <div style={{ fontSize:12, opacity:0.7, marginTop:2 }}>{geo} · {fac}</div>
            </div>
            <button onClick={onClose} style={{ background:"rgba(255,255,255,0.15)", border:"none", color:"white", borderRadius:8, padding:"6px 12px", cursor:"pointer", fontSize:12, fontFamily:"'DM Sans',sans-serif" }}>✕ Close</button>
          </div>
        </div>

        <div style={{ padding:"20px 24px" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:16 }}>
            <StatBox label="Doc Pay Rate" value={f$(pay)+"/hr"} color="#374151" bg="#f8fafc" />
            <StatBox label="Bill Rate" value={f$(bill)+"/hr"} color="#d97706" bg="#fffbeb" />
            <StatBox label="Margin" value={margin!=null?margin.toFixed(1)+"%":"—"} color={margin!=null?mColor(margin):"#9ca3af"} bg={margin!=null?(margin>=20?"#f0fdf4":margin>=12?"#fffbeb":"#fef2f2"):"#f8fafc"} />
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:16 }}>
            <StatBox label="Acceptance" value={`${likelihood}%`} sub={likelihoodLabel} color={likelihood>=70?"#059669":likelihood>=45?"#d97706":"#dc2626"} bg="#f8fafc" />
            <StatBox label={`${weeks}-Wk Revenue`} value={f$(assignmentValue)} color="#d97706" bg="#fffbeb" />
            <StatBox label={`${weeks}-Wk Gross Profit`} value={f$(assignmentGP)} color={assignmentGP>=0?"#059669":"#dc2626"} bg={assignmentGP>=0?"#f0fdf4":"#fef2f2"} />
          </div>

          <div style={{ padding:"12px 14px", background:"#f0f9ff", borderRadius:10, border:"1px solid #bae6fd", marginBottom:12 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#075985", marginBottom:4 }}>💡 Recommendation</div>
            <div style={{ fontSize:12, color:"#374151", lineHeight:1.7 }}>{recommendation}</div>
          </div>

          <div style={{ padding:"10px 14px", background:"#f8fafc", borderRadius:10, marginBottom:16 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#374151", marginBottom:3 }}>Market Intel <ConfBadge level={confidence} /></div>
            <div style={{ fontSize:12, color:"#6b7280", marginTop:4, lineHeight:1.6 }}>{leverageNote}</div>
          </div>

          {shiftComponents && shiftComponents.length > 0 && (
            <div style={{ padding:"10px 14px", background:"#f8fafc", borderRadius:10, marginBottom:16 }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#374151", marginBottom:8 }}>Shift Structure</div>
              {shiftComponents.map((c,i)=>(
                <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:12, padding:"4px 0", borderBottom:"1px solid #f3f4f6" }}>
                  <span style={{ color:"#374151" }}>{c.label||c.type}</span>
                  <span style={{ ...S.mono, fontWeight:600 }}>Pay {f$(c.pay)} · Bill {f$(c.bill)} · {c.qty} {c.unit}/wk</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display:"flex", gap:10 }}>
            <button onClick={handleCopy} style={{ flex:1, padding:"10px", borderRadius:8, background:"#0f172a", color:"white", border:"none", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>📋 Copy to Clipboard</button>
            <button onClick={onClose} style={{ padding:"10px 16px", borderRadius:8, background:"white", color:"#6b7280", border:"1.5px solid #e5e7eb", fontSize:13, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SCENARIO COMPARISON ──────────────────────────────────────────────────────

function ScenarioCompare({ scenarios, onRemove, onClear }) {
  if (!scenarios || scenarios.length === 0) return null;
  const fields = [
    { key:"specialty",      label:"Specialty" },
    { key:"geo",            label:"Geo Tier" },
    { key:"fac",            label:"Facility" },
    { key:"payDisplay",     label:"Doc Pay Rate" },
    { key:"billDisplay",    label:"Bill Rate" },
    { key:"marginDisplay",  label:"Margin %" },
    { key:"likelihoodDisp", label:"Acceptance" },
    { key:"assgnRevDisp",   label:"Assignment Rev" },
    { key:"assgnGPDisp",    label:"Assignment GP" },
  ];
  return (
    <div style={{ ...S.card, marginTop:16, overflow:"hidden" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <div style={{ fontSize:14, fontWeight:700 }}>Scenario Comparison ({scenarios.length})</div>
        <button onClick={onClear} style={{ padding:"4px 12px", borderRadius:14, border:"1.5px solid #e5e7eb", background:"white", color:"#ef4444", fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>Clear All</button>
      </div>
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
          <thead>
            <tr style={{ background:"#f8fafc" }}>
              <th style={{ padding:"8px 12px", textAlign:"left", fontSize:11, fontWeight:700, color:"#6b7280", borderBottom:"2px solid #e5e7eb", minWidth:130 }}>Field</th>
              {scenarios.map((s,i)=>(
                <th key={i} style={{ padding:"8px 12px", textAlign:"center", fontSize:11, fontWeight:700, color:"#374151", borderBottom:"2px solid #e5e7eb", minWidth:160 }}>
                  <div>Scenario {i+1}</div>
                  <button onClick={()=>onRemove(i)} style={{ fontSize:9, color:"#9ca3af", background:"none", border:"none", cursor:"pointer", marginTop:2 }}>✕ remove</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fields.map((f,fi)=>(
              <tr key={f.key} style={{ background:fi%2===0?"white":"#f9fafb" }}>
                <td style={{ padding:"8px 12px", fontWeight:600, color:"#374151", fontSize:11 }}>{f.label}</td>
                {scenarios.map((s,si)=>{
                  const val = s[f.key];
                  const isMargin = f.key==="marginDisplay";
                  const isLike   = f.key==="likelihoodDisp";
                  const allVals  = scenarios.map(x=>parseFloat(x[f.key])).filter(v=>!isNaN(v));
                  const numVal   = parseFloat(s[f.key]);
                  const isBest   = allVals.length>1 && !isNaN(numVal) && (
                    (isMargin||isLike||f.key==="assgnGPDisp"||f.key==="assgnRevDisp") ? numVal===Math.max(...allVals) : false
                  );
                  return (
                    <td key={si} style={{ padding:"8px 12px", textAlign:"center", ...S.mono, color:isBest?"#059669":"#374151", fontWeight:isBest?700:400, background:isBest?"#f0fdf4":"transparent" }}>
                      {val||"—"}
                      {isBest&&<span style={{ fontSize:9, marginLeft:4, color:"#059669" }}>▲ best</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── MAIN CALCULATOR ──────────────────────────────────────────────────────────

function Calculator({ log, scenarios, setScenarios }) {
  const [selected, setSelected]   = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [typeFilter, setTypeFilter]= useState("All");
  const [docPay, setDocPay]       = useState("");
  const [billRate, setBillRate]   = useState("");
  const [compRate, setCompRate]   = useState("");
  const [search, setSearch]       = useState("");
  const [geo, setGeo]             = useState("T3 – Mid-Market");
  const [fac, setFac]             = useState("Community Hospital");
  const [weeks, setWeeks]         = useState("13");
  const [minMargin, setMinMargin] = useState("20");
  const [dealSheet, setDealSheet] = useState(null);
  const [recentlyViewed, setRecentlyViewed] = useState([]);

  const sp = selected ? SPECIALTY_DATA[selected] : null;
  const rl = sp?.isDayRate?"/day":"/hr";

  const adj = b => applyMod(b, geo, fac);

  const filtered = Object.keys(SPECIALTY_DATA).filter(s=>{
    const d=SPECIALTY_DATA[s];
    if(catFilter!=="All"&&d.category!==catFilter)return false;
    if(typeFilter!=="All"&&d.type!==typeFilter)return false;
    if(search&&!s.toLowerCase().includes(search.toLowerCase()))return false;
    return true;
  });

  const selectSpecialty = useCallback(s => {
    setSelected(s);
    setDocPay(""); setBillRate(""); setCompRate("");
    setRecentlyViewed(prev => {
      const updated = [s, ...prev.filter(x=>x!==s)].slice(0,5);
      return updated;
    });
  },[]);

  const analysis = useMemo(()=>{
    if(!sp||!docPay) return null;
    const pay=parseFloat(docPay), bill=parseFloat(billRate)||0;
    const payLow=adj(sp.payLow), payHigh=adj(sp.payHigh);
    const bLow=adj(sp.billLow), bHigh=adj(sp.billHigh), bTarget=adj(sp.billTarget);
    const midPay=(payLow+payHigh)/2;
    const pctMid=((pay-midPay)/midPay)*100;
    const impliedBillLo=Math.round(pay/(1-sp.marginTypical[0]));
    const impliedBillHi=Math.round(pay/(1-sp.marginTypical[1]));
    const actualMargin=bill>0?((bill-pay)/bill)*100:null;
    const wks=parseFloat(weeks)||13;
    const hoursPerWeek=40;
    const assignmentRev=bill>0?bill*hoursPerWeek*wks:impliedBillLo*hoursPerWeek*wks;
    const assignmentCost=pay*hoursPerWeek*wks;
    const assignmentGP=assignmentRev-assignmentCost;

    // Counter-offer: max pay at min margin
    const mm=parseFloat(minMargin)/100||0.20;
    const maxPay=bill>0?Math.round(bill*(1-mm)):Math.round(impliedBillLo*(1-mm));

    let likelihood;
    if(pay<=payLow)likelihood=90;
    else if(pay<=payHigh)likelihood=72;
    else if(pay<=payHigh*1.08)likelihood=52;
    else if(pay<=payHigh*1.15)likelihood=32;
    else likelihood=12;
    likelihood=Math.min(95,Math.max(5,likelihood+(sp.negotiationLeverage-3)*6));

    const comp=parseFloat(compRate);
    let compNote="";
    if(comp>0){
      if(pay<=comp*0.97){likelihood=Math.min(95,likelihood+8); compNote=`✓ Below competitor ${f$(comp)}`;}
      else if(pay>=comp*1.03){likelihood=Math.max(5,likelihood-10); compNote=`⚠ Above competitor ${f$(comp)}`;}
      else compNote=`≈ At par with competitor ${f$(comp)}`;
    }
    const specLog=log.filter(l=>l.specialty===selected);
    let logNote="";
    if(specLog.length>0){
      const acc=specLog.filter(l=>l.outcome==="accepted").map(l=>parseFloat(l.docPayRate)).filter(Boolean);
      const dec=specLog.filter(l=>l.outcome==="declined").map(l=>parseFloat(l.docPayRate)).filter(Boolean);
      if(acc.length>0){const mx=Math.max(...acc);if(pay<=mx){likelihood=Math.min(95,likelihood+10);logNote=`✓ Accepted up to ${f$(mx)}`;}}
      if(dec.length>0){const mn=Math.min(...dec);if(pay>=mn){likelihood=Math.max(5,likelihood-15);logNote+=(logNote?" | ":"")+`✗ Declined at ${f$(mn)}`;}}
    }
    const lc=likelihood>=70?"#059669":likelihood>=45?"#d97706":"#dc2626";
    const ll=likelihood>=70?"Likely":likelihood>=45?"Possible":"Challenging";
    const recommendation=likelihood>=70
      ?`Rate is within market. Present with confidence. Primary driver: ${sp.acceptanceDrivers}.`
      :likelihood>=45
      ?`Rate is at the high end. Counter-offer near ${f$(payHigh)}${rl} if needed. Driver: ${sp.acceptanceDrivers}.`
      :`Rate likely creates a bill the facility won't accept. Negotiate toward ${f$(payHigh)}${rl} or leverage ${LEVERAGE_LABELS[sp.negotiationLeverage]} supply position.`;

    return { pay, bill, payLow, payHigh, midPay, pctMid, bLow, bHigh, bTarget,
             impliedBillLo, impliedBillHi, actualMargin, likelihood, lc, ll,
             compNote, logNote, specLog, assignmentRev, assignmentCost, assignmentGP,
             maxPay, mm, wks, recommendation };
  },[sp, docPay, billRate, compRate, geo, fac, selected, log, weeks, minMargin]);

  const saveScenario = () => {
    if(!analysis||!selected) return;
    const s = {
      specialty: selected,
      geo, fac,
      pay: analysis.pay,
      bill: analysis.bill||analysis.impliedBillLo,
      margin: analysis.actualMargin,
      likelihood: analysis.likelihood,
      likelihoodLabel: analysis.ll,
      weeks: analysis.wks,
      assignmentValue: analysis.assignmentRev,
      assignmentGP: analysis.assignmentGP,
      recommendation: analysis.recommendation,
      confidence: sp.confidence,
      leverageNote: sp.leverageNote,
      // Display versions for comparison table
      payDisplay: f$(analysis.pay)+rl,
      billDisplay: f$(analysis.bill||analysis.impliedBillLo)+rl,
      marginDisplay: analysis.actualMargin!=null?analysis.actualMargin.toFixed(1)+"%":"—",
      likelihoodDisp: analysis.likelihood+"%",
      assgnRevDisp: f$(analysis.assignmentRev),
      assgnGPDisp: f$(analysis.assignmentGP),
    };
    setScenarios(prev=>[...prev.slice(-2), s]);
  };

  const openDealSheet = () => {
    if(!analysis||!selected) return;
    setDealSheet({
      specialty:selected, geo, fac,
      pay:analysis.pay, bill:analysis.bill||analysis.impliedBillLo,
      margin:analysis.actualMargin,
      likelihood:analysis.likelihood, likelihoodLabel:analysis.ll,
      weeks:analysis.wks, assignmentValue:analysis.assignmentRev, assignmentGP:analysis.assignmentGP,
      recommendation:analysis.recommendation,
      confidence:sp.confidence, leverageNote:sp.leverageNote,
    });
  };

  return (
    <div>
      {dealSheet && <DealSheet scenario={dealSheet} onClose={()=>setDealSheet(null)} />}

      {/* Modifiers */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
        {[
          { label:"🌎 Geographic Tier", state:geo, setState:setGeo, opts:GEO_TIERS, ac:"#0f172a", at:"white" },
          { label:"🏥 Facility Type",   state:fac, setState:setFac, opts:FACILITY_TYPES, ac:"#eff6ff", at:"#1d4ed8", ab:"#3b82f6" },
        ].map(m=>(
          <div key={m.label} style={{ ...S.card, padding:"12px 16px" }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#374151", marginBottom:7 }}>{m.label}</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
              {Object.keys(m.opts).map(t=>(
                <button key={t} onClick={()=>m.setState(t)} style={{ padding:"4px 9px", borderRadius:14, border:`1.5px solid ${m.state===t?(m.ab||m.ac):"#e5e7eb"}`, background:m.state===t?m.ac:"white", color:m.state===t?m.at:"#6b7280", fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>{t}</button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Recently viewed */}
      {recentlyViewed.length > 0 && (
        <div style={{ display:"flex", gap:6, marginBottom:12, alignItems:"center", flexWrap:"wrap" }}>
          <span style={{ fontSize:11, color:"#9ca3af", fontWeight:600 }}>Recent:</span>
          {recentlyViewed.map(s=>(
            <button key={s} onClick={()=>selectSpecialty(s)} style={{ padding:"3px 9px", borderRadius:12, border:"1.5px solid #e5e7eb", background: selected===s?"#eff6ff":"white", color: selected===s?"#1d4ed8":"#374151", fontSize:11, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontWeight: selected===s?700:400 }}>{s}</button>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display:"flex", gap:7, flexWrap:"wrap", marginBottom:14, alignItems:"center" }}>
        <input placeholder="🔍 Search specialty..." value={search} onChange={e=>setSearch(e.target.value)} style={{ ...S.inp, width:185 }} />
        {TYPES.map(t=>(
          <button key={t} onClick={()=>setTypeFilter(t)} style={{ padding:"5px 11px", borderRadius:18, border:`1.5px solid ${typeFilter===t?"#0f172a":"#e5e7eb"}`, background:typeFilter===t?"#0f172a":"white", color:typeFilter===t?"white":"#6b7280", fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>{t}</button>
        ))}
        <div style={{ width:1, height:18, background:"#e5e7eb" }} />
        {CATEGORIES.filter(c=>c!=="All").map(c=>(
          <button key={c} onClick={()=>setCatFilter(catFilter===c?"All":c)} style={{ padding:"5px 11px", borderRadius:18, border:`1.5px solid ${catFilter===c?"#3b82f6":"#e5e7eb"}`, background:catFilter===c?"#eff6ff":"white", color:catFilter===c?"#1d4ed8":"#6b7280", fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>{c}</button>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"280px 1fr", gap:18, alignItems:"start" }}>
        {/* List */}
        <div style={{ ...S.card, padding:0, overflow:"hidden" }}>
          <div style={{ padding:"9px 14px", background:"#f8fafc", borderBottom:"1px solid #f3f4f6" }}>
            <span style={{ fontSize:11, fontWeight:700, color:"#6b7280", letterSpacing:1, textTransform:"uppercase" }}>{filtered.length} Specialties</span>
          </div>
          <div style={{ maxHeight:600, overflowY:"auto" }}>
            {filtered.map(s=>{
              const d=SPECIALTY_DATA[s]; const isSel=selected===s;
              const nl=log.filter(l=>l.specialty===s).length;
              return (
                <div key={s} onClick={()=>selectSpecialty(s)} style={{ padding:"8px 13px", cursor:"pointer", borderBottom:"1px solid #f9fafb", background:isSel?"#eff6ff":"white", borderLeft:isSel?"3px solid #3b82f6":"3px solid transparent" }}>
                  <div style={{ display:"flex", justifyContent:"space-between" }}>
                    <div>
                      <div style={{ fontSize:12, fontWeight:isSel?700:500, color:isSel?"#1d4ed8":"#111827" }}>{s}</div>
                      <div style={{ fontSize:10, color:"#9ca3af", marginTop:1 }}>
                        {d.type} · {d.category}{nl>0&&<span style={{ color:"#059669", marginLeft:5 }}>●{nl}</span>}
                      </div>
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", gap:2, alignItems:"flex-end" }}>
                      <div style={{ width:7, height:7, borderRadius:"50%", background:LEVERAGE_COLORS[d.negotiationLeverage] }} />
                      <div style={{ width:7, height:7, borderRadius:"50%", background:CONFIDENCE_LABELS[d.confidence]?.color??"#9ca3af" }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detail */}
        <div>
          {!sp ? (
            <div style={{ ...S.card, textAlign:"center", padding:60, color:"#9ca3af" }}>
              <div style={{ fontSize:36, marginBottom:10 }}>📋</div>
              <div style={{ fontSize:15, fontWeight:600 }}>Select a specialty to begin</div>
            </div>
          ) : (
            <>
              {/* Specialty card */}
              <div style={{ ...S.card, marginBottom:12 }}>
                <div style={{ display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:10, marginBottom:12 }}>
                  <div>
                    <div style={{ fontSize:18, fontWeight:700 }}>{selected}</div>
                    <div style={{ fontSize:12, color:"#6b7280", marginTop:2, display:"flex", gap:7, alignItems:"center" }}>
                      <span>{sp.type} · {sp.category}</span><ConfBadge level={sp.confidence} />
                    </div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:10, color:"#9ca3af", textTransform:"uppercase", letterSpacing:1, marginBottom:3 }}>Negotiation Leverage</div>
                    <LeverageMeter value={sp.negotiationLeverage} />
                  </div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:9, marginBottom:11 }}>
                  {[
                    { label:"Adjusted Pay Range",  val:`${f$(adj(sp.payLow))}–${f$(adj(sp.payHigh))}${rl}`, bg:"#f0fdf4", color:"#059669" },
                    { label:"Adjusted Bill Range",  val:`${f$(adj(sp.billLow))}–${f$(adj(sp.billHigh))}${rl}`, bg:"#fff7ed", color:"#d97706" },
                    { label:"Bill Target",          val:`${f$(adj(sp.billTarget))}${rl}`, bg:"#eff6ff", color:"#3b82f6" },
                  ].map(b=>(
                    <div key={b.label} style={{ textAlign:"center", padding:9, background:b.bg, borderRadius:8 }}>
                      <div style={{ fontSize:9, color:"#6b7280", textTransform:"uppercase", letterSpacing:0.4 }}>{b.label}</div>
                      <div style={{ fontSize:13, fontWeight:700, color:b.color, marginTop:3 }}>{b.val}</div>
                    </div>
                  ))}
                </div>
                <div style={{ padding:"7px 11px", background:"#f8fafc", borderRadius:7, fontSize:11, color:"#374151", marginBottom:9 }}>
                  <strong>Intel:</strong> {sp.leverageNote}
                </div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                  {sp.keyFactors.map(f=>(
                    <span key={f} style={{ padding:"2px 8px", background:"#f3f4f6", borderRadius:18, fontSize:10, color:"#374151", fontWeight:500 }}>{f}</span>
                  ))}
                </div>
              </div>

              {/* Inputs */}
              <div style={{ ...S.card, marginBottom:12 }}>
                <div style={{ fontSize:13, fontWeight:700, marginBottom:10 }}>Rate Inputs</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:9, marginBottom:10 }}>
                  <div><label style={S.lbl}>Doc Pay Rate{rl} *</label><DollarInput value={docPay} onChange={setDocPay} placeholder={`e.g. ${adj(sp.payHigh)}`} /></div>
                  <div><label style={S.lbl}>Bill Rate{rl} (if known)</label><DollarInput value={billRate} onChange={setBillRate} placeholder="optional" /></div>
                  <div><label style={S.lbl}>Competitor Rate</label><DollarInput value={compRate} onChange={setCompRate} placeholder="other agency" /></div>
                  <div><label style={S.lbl}>Assignment Weeks</label><input type="number" value={weeks} onChange={e=>setWeeks(e.target.value)} style={S.inp} /></div>
                </div>

                {/* Counter-offer */}
                <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:9, padding:"10px 13px" }}>
                  <div style={{ fontSize:11, fontWeight:700, color:"#065f46", marginBottom:6 }}>🔄 Counter-Offer Calculator — Max I Can Offer</div>
                  <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <span style={{ fontSize:11, color:"#374151" }}>Min acceptable margin:</span>
                      <input type="number" value={minMargin} onChange={e=>setMinMargin(e.target.value)} style={{ ...S.inp, width:60 }} />
                      <span style={{ fontSize:11, color:"#374151" }}>%</span>
                    </div>
                    {analysis && (
                      <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
                        <div>
                          <span style={{ fontSize:10, color:"#6b7280" }}>Max pay to doctor: </span>
                          <span style={{ fontSize:14, fontWeight:700, color:"#059669", ...S.mono }}>{f$(analysis.maxPay)}{rl}</span>
                        </div>
                        {analysis.pay > analysis.maxPay && (
                          <div style={{ padding:"3px 9px", background:"#fef2f2", borderRadius:8, fontSize:11, color:"#dc2626", fontWeight:600 }}>
                            ⚠ Doctor's ask {f$(analysis.pay)} exceeds max by {f$(analysis.pay - analysis.maxPay)}
                          </div>
                        )}
                        {analysis.pay <= analysis.maxPay && (
                          <div style={{ padding:"3px 9px", background:"#f0fdf4", borderRadius:8, fontSize:11, color:"#059669", fontWeight:600 }}>
                            ✓ Within margin — {f$(analysis.maxPay - analysis.pay)} headroom
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Analysis */}
              {analysis && (
                <div>
                  <div style={{ ...S.card, marginBottom:12 }}>
                    <div style={{ fontSize:13, fontWeight:700, marginBottom:12 }}>Rate Analysis</div>

                    {/* slider */}
                    <div style={{ marginBottom:14 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#9ca3af", marginBottom:4 }}><span>Below Market</span><span>Market Range</span><span>Above Market</span></div>
                      <div style={{ height:10, background:"#f3f4f6", borderRadius:6, position:"relative" }}>
                        {(()=>{
                          const mn=analysis.payLow*0.7, mx=analysis.payHigh*1.4, rng=mx-mn;
                          const lo=((analysis.payLow-mn)/rng)*100, hi=((analysis.payHigh-mn)/rng)*100;
                          const pp=Math.min(98,Math.max(2,((analysis.pay-mn)/rng)*100));
                          return(<>
                            <div style={{ position:"absolute", left:`${lo}%`, width:`${hi-lo}%`, height:"100%", background:"linear-gradient(90deg,#bbf7d0,#6ee7b7)", borderRadius:4 }} />
                            <div style={{ position:"absolute", left:`${pp}%`, top:-5, transform:"translateX(-50%)", width:20, height:20, borderRadius:"50%", background:analysis.lc, border:"3px solid white", boxShadow:"0 2px 6px rgba(0,0,0,0.2)" }} />
                          </>);
                        })()}
                      </div>
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"#9ca3af", marginTop:4 }}>
                        <span>{f$(analysis.payLow)}{rl}</span>
                        <span style={{ fontWeight:700, color:"#111827" }}>→ {f$(analysis.pay)}{rl}</span>
                        <span>{f$(analysis.payHigh)}{rl}</span>
                      </div>
                    </div>

                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:9, marginBottom:12 }}>
                      <div style={{ padding:11, background:"#f8fafc", borderRadius:9 }}>
                        <div style={{ fontSize:10, color:"#9ca3af" }}>vs. Market Midpoint</div>
                        <div style={{ fontSize:19, fontWeight:700, color:analysis.pctMid>0?"#ef4444":"#059669" }}>{fpct(analysis.pctMid)}</div>
                        <div style={{ fontSize:10, color:"#6b7280" }}>{analysis.pctMid>0?"above":"below"} {f$(Math.round(analysis.midPay))}{rl}</div>
                      </div>
                      <div style={{ padding:11, borderRadius:9, background:`${analysis.lc}15`, border:`2px solid ${analysis.lc}40` }}>
                        <div style={{ fontSize:10, color:"#9ca3af" }}>Acceptance Likelihood</div>
                        <div style={{ display:"flex", alignItems:"baseline", gap:5 }}>
                          <span style={{ fontSize:22, fontWeight:700, color:analysis.lc }}>{analysis.likelihood}%</span>
                          <span style={{ fontSize:12, color:analysis.lc, fontWeight:700 }}>{analysis.ll}</span>
                        </div>
                        {analysis.logNote&&<div style={{ fontSize:9, color:"#6b7280", marginTop:2 }}>{analysis.logNote}</div>}
                        {analysis.compNote&&<div style={{ fontSize:9, color:"#6b7280", marginTop:1 }}>{analysis.compNote}</div>}
                      </div>
                      <div style={{ padding:11, borderRadius:9, background:analysis.actualMargin!=null?(analysis.actualMargin>=20?"#f0fdf4":analysis.actualMargin>=12?"#fffbeb":"#fef2f2"):"#f8fafc", border:analysis.actualMargin!=null?`2px solid ${mColor(analysis.actualMargin)}40`:"none" }}>
                        <div style={{ fontSize:10, color:"#9ca3af" }}>{analysis.actualMargin!=null?"Actual Margin":"Typical Margin"}</div>
                        <div style={{ fontSize:19, fontWeight:700, color:analysis.actualMargin!=null?mColor(analysis.actualMargin):"#374151" }}>
                          {analysis.actualMargin!=null?analysis.actualMargin.toFixed(1)+"%":`${(sp.marginTypical[0]*100).toFixed(0)}–${(sp.marginTypical[1]*100).toFixed(0)}%`}
                        </div>
                        {analysis.actualMargin==null&&<div style={{ fontSize:10, color:"#6b7280" }}>Enter bill rate above</div>}
                      </div>
                    </div>

                    {/* Assignment value */}
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:9, marginBottom:12 }}>
                      <StatBox label={`${analysis.wks}-Wk Revenue`} sub="bill × 40 hrs/wk" value={f$(analysis.assignmentRev)} color="#d97706" bg="#fffbeb" />
                      <StatBox label={`${analysis.wks}-Wk Doc Cost`} sub="pay × 40 hrs/wk" value={f$(analysis.assignmentCost)} color="#374151" bg="#f8fafc" />
                      <StatBox label={`${analysis.wks}-Wk Gross Profit`} value={f$(analysis.assignmentGP)} color={analysis.assignmentGP>=0?"#059669":"#dc2626"} bg={analysis.assignmentGP>=0?"#f0fdf4":"#fef2f2"} border={`2px solid ${analysis.assignmentGP>=0?"#059669":"#dc2626"}30`} />
                    </div>

                    {/* Implied bill */}
                    <div style={{ padding:11, background:"#fff7ed", borderRadius:9, border:"1px solid #fed7aa", marginBottom:10 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:"#92400e", marginBottom:5 }}>📋 Implied Bill Rate</div>
                      <div style={{ fontSize:12, color:"#374151", lineHeight:1.7 }}>
                        To hold {(sp.marginTypical[0]*100).toFixed(0)}–{(sp.marginTypical[1]*100).toFixed(0)}% margin on {f$(analysis.pay)}{rl} → bill <strong>{f$(analysis.impliedBillHi)}–{f$(Math.round(analysis.impliedBillLo*1.05))}{rl}</strong>.
                        {analysis.impliedBillLo>analysis.bTarget
                          ?<span style={{ color:"#dc2626", fontWeight:600 }}> ⚠ Exceeds bill target {f$(analysis.bTarget)}{rl}.</span>
                          :<span style={{ color:"#059669", fontWeight:600 }}> ✓ Fits within bill range.</span>
                        }
                      </div>
                    </div>

                    {/* Recommendation */}
                    <div style={{ padding:11, background:"#f0f9ff", borderRadius:9, border:"1px solid #bae6fd", marginBottom:analysis.specLog.length>0?10:0 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:"#075985", marginBottom:4 }}>💡 Recruiter Recommendation</div>
                      <div style={{ fontSize:12, color:"#374151", lineHeight:1.7 }}>{analysis.recommendation}</div>
                    </div>

                    {analysis.specLog.length>0&&(
                      <div style={{ padding:11, background:"#f8fafc", borderRadius:9, marginTop:10 }}>
                        <div style={{ fontSize:12, fontWeight:700, marginBottom:6 }}>📊 Bid History — {selected}</div>
                        {analysis.specLog.slice(0,4).map(l=>(
                          <div key={l.id} style={{ display:"flex", gap:7, fontSize:11, padding:"4px 0", borderBottom:"1px solid #f3f4f6" }}>
                            <span style={{ color:l.outcome==="accepted"?"#059669":l.outcome==="declined"?"#dc2626":"#d97706", fontWeight:700 }}>{l.outcome==="accepted"?"✓":l.outcome==="declined"?"✗":"⏳"}</span>
                            <span>Pay:<strong>{f$(parseFloat(l.docPayRate))}</strong></span>
                            {l.billRate&&<span>Bill:<strong>{f$(parseFloat(l.billRate))}</strong></span>}
                            <span style={{ color:"#9ca3af" }}>{l.date}</span>
                            {l.notes&&<span style={{ color:"#6b7280" }}>— {l.notes}</span>}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Action buttons */}
                    <div style={{ display:"flex", gap:8, marginTop:12, flexWrap:"wrap" }}>
                      <button onClick={openDealSheet} style={{ padding:"8px 16px", borderRadius:8, background:"#0f172a", color:"white", border:"none", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>📄 Generate Deal Sheet</button>
                      <button onClick={saveScenario} style={{ padding:"8px 16px", borderRadius:8, background:"#eff6ff", color:"#1d4ed8", border:"1.5px solid #bfdbfe", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>⚖ Save to Compare</button>
                    </div>
                  </div>

                  <MarginTable basePay={analysis.pay} baseBill={analysis.bill||analysis.impliedBillLo} />
                </div>
              )}

              {/* Scenario comparison */}
              {scenarios.length>0&&(
                <ScenarioCompare
                  scenarios={scenarios}
                  onRemove={i=>setScenarios(s=>s.filter((_,idx)=>idx!==i))}
                  onClear={()=>setScenarios([])}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── SHIFT BUILDER ────────────────────────────────────────────────────────────

function ShiftBuilder() {
  const newComp = () => ({ id:Date.now()+Math.random(), typeId:"hourly_day", label:"", payRate:"", billRate:"", qtyPerWeek:"", gratisHours:"", expectedCallbackHrs:"", callbackPayRate:"", callbackBillRate:"" });
  const [comps, setComps] = useState([newComp()]);
  const [weeks, setWeeks] = useState("13");
  const [refSpecialty, setRefSpecialty] = useState("");
  const [refSearch, setRefSearch] = useState("");

  const upd = (id,f,v)=>setComps(c=>c.map(x=>x.id===id?{...x,[f]:v}:x));
  const add  = ()=>setComps(c=>[...c,newComp()]);
  const del  = id=>setComps(c=>c.filter(x=>x.id!==id));

  const refSp = refSpecialty ? SPECIALTY_DATA[refSpecialty] : null;
  const filteredRef = Object.keys(SPECIALTY_DATA).filter(s => !refSearch || s.toLowerCase().includes(refSearch.toLowerCase()));

  const computed = comps.map(comp=>{
    const type=SHIFT_TYPES.find(t=>t.id===comp.typeId)||SHIFT_TYPES[0];
    const pay=parseFloat(comp.payRate)||0, bill=parseFloat(comp.billRate)||0, qty=parseFloat(comp.qtyPerWeek)||0;
    const gratisHrs=type.hasGratis?(parseFloat(comp.gratisHours)||0):0;
    const cbkHrs=type.hasGratis?(parseFloat(comp.expectedCallbackHrs)||0):0;
    const cbkPay=type.hasGratis?(parseFloat(comp.callbackPayRate)||0):0;
    const cbkBill=type.hasGratis?(parseFloat(comp.callbackBillRate)||0):0;
    const baseDocPay=pay*qty, baseBill=bill*qty;
    const cbkDocPay=cbkHrs*cbkPay*qty, cbkBill_=cbkHrs*cbkBill*qty;
    const totalDocPay=baseDocPay+cbkDocPay, totalBill=baseBill+cbkBill_;
    const gp=totalBill-totalDocPay, margin=totalBill>0?(gp/totalBill)*100:0;
    const totalHrs=type.hasGratis?(gratisHrs+cbkHrs)*qty:qty;
    const effPayRate=type.hasGratis&&totalHrs>0?totalDocPay/totalHrs:pay;
    return {...comp,type,pay,bill,qty,gratisHrs,cbkHrs,cbkPay,cbkBill,baseDocPay,baseBill,cbkDocPay,cbkBill_,totalDocPay,totalBill,gp,margin,effPayRate};
  });

  const tot=computed.reduce((a,c)=>({totalDocPay:a.totalDocPay+c.totalDocPay,totalBill:a.totalBill+c.totalBill,gp:a.gp+c.gp}),{totalDocPay:0,totalBill:0,gp:0});
  const totalMargin=tot.totalBill>0?(tot.gp/tot.totalBill)*100:0;
  const wks=parseFloat(weeks)||13;
  const assign={doc:tot.totalDocPay*wks, bill:tot.totalBill*wks, gp:tot.gp*wks};

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18, flexWrap:"wrap", gap:10 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:700 }}>Complex Shift Structure Calculator</div>
          <div style={{ fontSize:12, color:"#6b7280", marginTop:2 }}>Build any combination of components. Gratis = hours included in flat call before callback triggers.</div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:12, fontWeight:600, color:"#374151" }}>Assignment weeks:</span>
          <input type="number" value={weeks} onChange={e=>setWeeks(e.target.value)} style={{ ...S.inp, width:65 }} />
        </div>
      </div>

      {/* SPECIALTY RATE REFERENCE PANEL */}
      <div style={{ ...S.card, marginBottom:18, border:"1.5px solid #e0e7ff" }}>
        <div style={{ fontSize:13, fontWeight:700, color:"#3730a3", marginBottom:10 }}>📖 Specialty Rate Reference</div>
        <div style={{ display:"grid", gridTemplateColumns:"220px 1fr", gap:12, alignItems:"start" }}>
          <div>
            <input placeholder="Search specialty..." value={refSearch} onChange={e=>setRefSearch(e.target.value)} style={{ ...S.inp, marginBottom:6 }} />
            <div style={{ maxHeight:200, overflowY:"auto", border:"1.5px solid #e5e7eb", borderRadius:8 }}>
              {filteredRef.map(s=>(
                <div key={s} onClick={()=>setRefSpecialty(s)} style={{ padding:"7px 11px", cursor:"pointer", fontSize:12, background:refSpecialty===s?"#eff6ff":"white", borderBottom:"1px solid #f9fafb", color:refSpecialty===s?"#1d4ed8":"#374151", fontWeight:refSpecialty===s?700:400 }}>{s}</div>
              ))}
            </div>
          </div>
          <div>
            {!refSp ? (
              <div style={{ padding:"24px 0", textAlign:"center", color:"#9ca3af", fontSize:12 }}>Select a specialty to see reference rates for each shift type</div>
            ) : (
              <>
                <div style={{ display:"flex", gap:8, marginBottom:10, alignItems:"center", flexWrap:"wrap" }}>
                  <span style={{ fontSize:13, fontWeight:700 }}>{refSpecialty}</span>
                  <ConfBadge level={refSp.confidence} />
                  <span style={{ fontSize:11, color:"#6b7280" }}>{refSp.type} · {refSp.category}</span>
                </div>
                {refSp.shiftRef && Object.keys(refSp.shiftRef).length > 0 ? (
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(190px,1fr))", gap:8 }}>
                    {Object.entries(refSp.shiftRef).map(([key,[lo,hi]])=>(
                      <div key={key} style={{ background:"#f0f9ff", border:"1px solid #bae6fd", borderRadius:9, padding:"9px 12px" }}>
                        <div style={{ fontSize:10, color:"#0369a1", fontWeight:700, textTransform:"uppercase", letterSpacing:0.4, marginBottom:4 }}>{SHIFT_REF_LABELS[key]||key}</div>
                        <div style={{ fontSize:15, fontWeight:700, color:"#0f172a", ...S.mono }}>{f$(lo)} – {f$(hi)}</div>
                        <div style={{ fontSize:10, color:"#6b7280", marginTop:2 }}>SMH pay range · bill typically {f$(Math.round(lo/(1-refSp.marginTypical[1])))}–{f$(Math.round(hi/(1-refSp.marginTypical[0])))}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize:12, color:"#9ca3af", padding:"12px 0" }}>No component-level reference data for this specialty. Use the hourly range: {f$(refSp.payLow)}–{f$(refSp.payHigh)}/hr.</div>
                )}
                <div style={{ marginTop:8, padding:"7px 11px", background:"#fef9c3", borderRadius:7, fontSize:11, color:"#713f12" }}>
                  ⚠ These are SMH pay ranges. Bill rates shown are estimates based on typical margin. Adjust for geo/facility type.
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Components */}
      <div style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:14 }}>
        {computed.map(comp=>{
          const hg=comp.type.hasGratis;
          // Get reference rates for this component type
          const refRates = refSp?.shiftRef?.[comp.type.refKey];
          return (
            <div key={comp.id} style={{ ...S.card, border:"1.5px solid #e5e7eb", padding:"13px 15px" }}>
              <div style={{ display:"grid", gridTemplateColumns:"220px 1fr auto", gap:9, marginBottom:10, alignItems:"center" }}>
                <div>
                  <label style={S.lbl}>Shift Type</label>
                  <select value={comp.typeId} onChange={e=>upd(comp.id,"typeId",e.target.value)} style={S.inp}>
                    {SHIFT_TYPES.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.lbl}>Label (optional)</label>
                  <input value={comp.label} onChange={e=>upd(comp.id,"label",e.target.value)} placeholder="e.g. Mon-Fri night call" style={S.inp} />
                </div>
                {comps.length>1&&<button onClick={()=>del(comp.id)} style={{ marginTop:18, background:"none", border:"none", cursor:"pointer", color:"#d1d5db", fontSize:18 }}>✕</button>}
              </div>

              <div style={{ fontSize:11, color:"#6b7280", background:"#f8fafc", padding:"5px 9px", borderRadius:6, marginBottom:10 }}>{comp.type.desc}</div>

              {/* Reference rate hint */}
              {refRates && (
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:9, padding:"5px 10px", background:"#f0f9ff", borderRadius:7, border:"1px solid #bae6fd" }}>
                  <span style={{ fontSize:10, color:"#0369a1", fontWeight:700 }}>📖 {refSpecialty} reference:</span>
                  <span style={{ fontSize:11, color:"#0f172a", fontWeight:700, ...S.mono }}>{f$(refRates[0])} – {f$(refRates[1])}</span>
                  <span style={{ fontSize:10, color:"#6b7280" }}>doc pay range for this component</span>
                </div>
              )}

              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:9, marginBottom:hg?10:0 }}>
                <div><label style={S.lbl}>Doc Pay ({comp.type.unit==="hr"?"$/hr":comp.type.unit==="shift"?"$/shift":"$/unit"})</label><DollarInput value={comp.payRate} onChange={v=>upd(comp.id,"payRate",v)} /></div>
                <div><label style={S.lbl}>SMH Bill (same unit)</label><DollarInput value={comp.billRate} onChange={v=>upd(comp.id,"billRate",v)} /></div>
                <div><label style={S.lbl}>Qty / week</label><input type="number" value={comp.qtyPerWeek} onChange={e=>upd(comp.id,"qtyPerWeek",e.target.value)} style={S.inp} /></div>
              </div>

              {hg&&(
                <div style={{ background:"#fffbeb", border:"1.5px solid #fde68a", borderRadius:9, padding:"11px 13px", marginBottom:10 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"#92400e", marginBottom:6 }}>⏱ Gratis Threshold — Hours Included Before Callback</div>
                  <div style={{ fontSize:11, color:"#78350f", marginBottom:9 }}>The flat call rate covers the first <em>N</em> gratis hours at no additional billing. Beyond that, the callback rate applies.</div>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:9 }}>
                    <div><label style={{ ...S.lbl, color:"#92400e" }}>Gratis Hours (in flat rate)</label><input type="number" value={comp.gratisHours} onChange={e=>upd(comp.id,"gratisHours",e.target.value)} placeholder="e.g. 4" style={{ ...S.inp, background:"#fffbeb", borderColor:"#fde68a" }} /></div>
                    <div><label style={{ ...S.lbl, color:"#92400e" }}>Expected Callback Hrs/shift</label><input type="number" value={comp.expectedCallbackHrs} onChange={e=>upd(comp.id,"expectedCallbackHrs",e.target.value)} placeholder="e.g. 2" style={{ ...S.inp, background:"#fffbeb", borderColor:"#fde68a" }} /></div>
                    <div><label style={{ ...S.lbl, color:"#92400e" }}>Callback Doc Pay $/hr</label><DollarInput value={comp.callbackPayRate} onChange={v=>upd(comp.id,"callbackPayRate",v)} style={{ background:"#fffbeb", borderColor:"#fde68a" }} /></div>
                    <div><label style={{ ...S.lbl, color:"#92400e" }}>Callback SMH Bill $/hr</label><DollarInput value={comp.callbackBillRate} onChange={v=>upd(comp.id,"callbackBillRate",v)} style={{ background:"#fffbeb", borderColor:"#fde68a" }} /></div>
                  </div>
                  {comp.gratisHours&&comp.qtyPerWeek&&(
                    <div style={{ marginTop:7, fontSize:11, color:"#92400e", background:"#fef3c7", padding:"5px 9px", borderRadius:6 }}>
                      ℹ {comp.gratisHours} gratis hrs × {comp.qtyPerWeek} shifts/wk = <strong>{(parseFloat(comp.gratisHours)||0)*(parseFloat(comp.qtyPerWeek)||0)} hrs/wk</strong> within flat rate.
                      {comp.expectedCallbackHrs>0&&` Plus ${(parseFloat(comp.expectedCallbackHrs)||0)*(parseFloat(comp.qtyPerWeek)||0)} callback hrs/wk @ ${f$(parseFloat(comp.callbackBillRate)||0)}/hr.`}
                    </div>
                  )}
                </div>
              )}

              {(comp.pay>0||comp.bill>0)&&comp.qty>0&&(
                <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:7 }}>
                  <StatBox label="Base Pay/wk" value={f$(comp.baseDocPay)} color="#374151" bg="#f8fafc" />
                  {hg?<StatBox label="Callback Pay/wk" sub={comp.cbkHrs>0?`${comp.cbkHrs}hr×${comp.qty}`:"0 triggered"} value={f$(comp.cbkDocPay)} color={comp.cbkDocPay>0?"#7c3aed":"#9ca3af"} bg={comp.cbkDocPay>0?"#faf5ff":"#f8fafc"} />
                     :<StatBox label="Total Pay/wk" value={f$(comp.totalDocPay)} color="#374151" bg="#f8fafc" />}
                  <StatBox label="Eff. Pay/hr" sub={hg?"base+cbk÷hrs":""} value={hg&&comp.gratisHrs>0?f$(comp.effPayRate,2)+"/hr":f$(comp.pay)+"/"+comp.type.unit} color="#7c3aed" bg="#faf5ff" />
                  <StatBox label="SMH Bill/wk" value={f$(comp.totalBill)} color="#d97706" bg="#fffbeb" />
                  <StatBox label="Gross Profit/wk" value={f$(comp.gp)} color={comp.gp>=0?"#059669":"#dc2626"} bg={comp.gp>=0?"#f0fdf4":"#fef2f2"} />
                  <StatBox label="Margin %" value={comp.totalBill>0?comp.margin.toFixed(1)+"%":"—"} color={mColor(comp.margin)} bg="#f8fafc" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button onClick={add} style={{ padding:"7px 15px", borderRadius:8, border:"1.5px dashed #d1d5db", background:"white", cursor:"pointer", fontSize:13, color:"#6b7280", fontFamily:"'DM Sans',sans-serif", marginBottom:22 }}>+ Add Component</button>

      {tot.totalBill>0&&(
        <>
          <div style={{ ...S.card, marginBottom:14, border:"2px solid #0f172a" }}>
            <div style={{ fontSize:14, fontWeight:700, marginBottom:12, display:"flex", alignItems:"center", gap:8 }}>
              📊 Weekly Summary <span style={{ fontSize:11, background:"#0f172a", color:"white", padding:"2px 8px", borderRadius:18 }}>all components</span>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:10 }}>
              <StatBox label="Total Doc Pay/wk" value={f$(tot.totalDocPay)} color="#374151" bg="#f8fafc" />
              <StatBox label="Total SMH Bill/wk" value={f$(tot.totalBill)} color="#d97706" bg="#fffbeb" />
              <StatBox label="Gross Profit/wk" value={f$(tot.gp)} color={tot.gp>=0?"#059669":"#dc2626"} bg={tot.gp>=0?"#f0fdf4":"#fef2f2"} />
              <StatBox label="Blended Margin" value={totalMargin.toFixed(1)+"%"} color={mColor(totalMargin)} bg="#f8fafc" border={`2px solid ${mColor(totalMargin)}`} />
            </div>
            <MarginTable basePay={tot.totalDocPay} baseBill={tot.totalBill} defaultUnit="weekly" />
          </div>

          <div style={{ ...S.card, background:"linear-gradient(135deg,#0f172a,#1e3a5f)", color:"white" }}>
            <div style={{ fontSize:14, fontWeight:700, marginBottom:12, opacity:0.9 }}>🗓 Full Assignment — {weeks} Weeks</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
              {[{l:"Total Doc Pay",v:f$(assign.doc)},{l:"Total SMH Revenue",v:f$(assign.bill)},{l:"Total Gross Profit",v:f$(assign.gp)}].map(b=>(
                <div key={b.l} style={{ background:"rgba(255,255,255,0.1)", borderRadius:9, padding:"13px 11px", textAlign:"center" }}>
                  <div style={{ fontSize:10, opacity:0.6, textTransform:"uppercase", letterSpacing:0.4 }}>{b.l}</div>
                  <div style={{ fontSize:20, fontWeight:700, marginTop:5, ...S.mono }}>{b.v}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── BID LOG ─────────────────────────────────────────────────────────────────

function BidLog({ log, setLog }) {
  const blank = ()=>({ specialty:"", docPayRate:"", billRate:"", compRate:"", outcome:"accepted", notes:"", date:new Date().toISOString().slice(0,10) });
  const [form, setForm] = useState(blank());

  function save(){
    if(!form.specialty||!form.docPayRate)return;
    setLog(p=>[{...form,id:Date.now()},...p]);
    setForm(blank());
  }
  function del(id){ setLog(p=>p.filter(l=>l.id!==id)); }

  const exportCSV = () => {
    const header = ["specialty","docPayRate","billRate","compRate","outcome","date","notes"];
    const rows = log.map(l => header.map(k => `"${(l[k]||"").toString().replace(/"/g,'""')}"`).join(","));
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type:"text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href=url; a.download="smh_bid_log.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const acc=log.filter(l=>l.outcome==="accepted").length;
  const dec=log.filter(l=>l.outcome==="declined").length;
  const pend=log.filter(l=>l.outcome==="pending").length;
  const winRate=(acc+dec)>0?Math.round((acc/(acc+dec))*100):null;

  return (
    <div style={{ display:"grid", gridTemplateColumns:"330px 1fr", gap:18, alignItems:"start" }}>
      <div style={S.card}>
        <div style={{ fontSize:15, fontWeight:700, marginBottom:13 }}>Log Bid Outcome</div>
        <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
          <div>
            <label style={S.lbl}>Specialty *</label>
            <select value={form.specialty} onChange={e=>setForm(f=>({...f,specialty:e.target.value}))} style={S.inp}>
              <option value="">Select specialty...</option>
              {Object.keys(SPECIALTY_DATA).map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {[{k:"docPayRate",l:"Doctor Pay Rate *",ph:"e.g. 290"},{k:"billRate",l:"Bill Rate (if known)",ph:"optional"},{k:"compRate",l:"Competitor Rate (if known)",ph:"optional"}].map(f=>(
            <div key={f.k}><label style={S.lbl}>{f.l}</label><DollarInput value={form[f.k]} onChange={v=>setForm(p=>({...p,[f.k]:v}))} placeholder={f.ph} /></div>
          ))}
          <div>
            <label style={S.lbl}>Outcome *</label>
            <div style={{ display:"flex", gap:6 }}>
              {["accepted","declined","pending"].map(o=>(
                <button key={o} onClick={()=>setForm(f=>({...f,outcome:o}))} style={{ flex:1, padding:"7px", borderRadius:8, border:`1.5px solid ${form.outcome===o?(o==="accepted"?"#059669":o==="declined"?"#dc2626":"#d97706"):"#e5e7eb"}`, background:form.outcome===o?(o==="accepted"?"#f0fdf4":o==="declined"?"#fef2f2":"#fffbeb"):"white", color:form.outcome===o?(o==="accepted"?"#059669":o==="declined"?"#dc2626":"#d97706"):"#6b7280", fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", textTransform:"capitalize" }}>{o}</button>
              ))}
            </div>
          </div>
          <div><label style={S.lbl}>Date</label><input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} style={S.inp} /></div>
          <div><label style={S.lbl}>Notes</label><textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Facility, context, why accepted/declined..." style={{ ...S.inp, height:60, resize:"vertical" }} /></div>
          <button onClick={save} disabled={!form.specialty||!form.docPayRate} style={{ padding:"10px", borderRadius:8, border:"none", background:(!form.specialty||!form.docPayRate)?"#e5e7eb":"#0f172a", color:(!form.specialty||!form.docPayRate)?"#9ca3af":"white", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>Save Bid Entry</button>
        </div>
      </div>

      <div style={S.card}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
          <div style={{ fontSize:15, fontWeight:700 }}>Bid History</div>
          {log.length>0&&<button onClick={exportCSV} style={{ padding:"5px 12px", borderRadius:14, border:"1.5px solid #e5e7eb", background:"white", color:"#374151", fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>⬇ Export CSV</button>}
        </div>
        <div style={{ fontSize:11, color:"#9ca3af", marginBottom:13 }}>{log.length} entries · feeds back into acceptance likelihood</div>
        {log.length===0?(
          <div style={{ textAlign:"center", padding:40, color:"#9ca3af" }}>
            <div style={{ fontSize:30, marginBottom:8 }}>📭</div>
            <div>No bids logged yet.</div>
          </div>
        ):(
          <>
            <div style={{ display:"flex", gap:9, marginBottom:13 }}>
              {[{l:"Accepted",c:"#059669",bg:"#f0fdf4",v:acc},{l:"Declined",c:"#dc2626",bg:"#fef2f2",v:dec},{l:"Pending",c:"#d97706",bg:"#fffbeb",v:pend},...(winRate!=null?[{l:"Win Rate",c:"#3b82f6",bg:"#eff6ff",v:`${winRate}%`}]:[])].map(s=>(
                <div key={s.l} style={{ padding:"9px 13px", background:s.bg, borderRadius:8, textAlign:"center", flex:1 }}>
                  <div style={{ fontSize:19, fontWeight:700, color:s.c }}>{s.v}</div>
                  <div style={{ fontSize:10, color:"#6b7280" }}>{s.l}</div>
                </div>
              ))}
            </div>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                <thead>
                  <tr style={{ background:"#f8fafc" }}>
                    {["","Specialty","Pay","Bill","Comp.","Date","Notes",""].map((h,i)=>(
                      <th key={i} style={{ padding:"6px 9px", textAlign:"left", fontSize:10, fontWeight:700, color:"#6b7280", textTransform:"uppercase", borderBottom:"2px solid #f3f4f6" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {log.map(l=>(
                    <tr key={l.id} style={{ borderBottom:"1px solid #f9fafb" }}>
                      <td style={{ padding:"6px 9px" }}><span style={{ padding:"2px 7px", borderRadius:9, fontSize:10, fontWeight:700, background:l.outcome==="accepted"?"#f0fdf4":l.outcome==="declined"?"#fef2f2":"#fffbeb", color:l.outcome==="accepted"?"#059669":l.outcome==="declined"?"#dc2626":"#d97706" }}>{l.outcome}</span></td>
                      <td style={{ padding:"6px 9px", fontWeight:500, maxWidth:150, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{l.specialty}</td>
                      <td style={{ padding:"6px 9px", ...S.mono, fontWeight:600 }}>{l.docPayRate?f$(parseFloat(l.docPayRate)):"—"}</td>
                      <td style={{ padding:"6px 9px", ...S.mono, color:"#6b7280" }}>{l.billRate?f$(parseFloat(l.billRate)):"—"}</td>
                      <td style={{ padding:"6px 9px", ...S.mono, color:"#6b7280" }}>{l.compRate?f$(parseFloat(l.compRate)):"—"}</td>
                      <td style={{ padding:"6px 9px", color:"#9ca3af" }}>{l.date}</td>
                      <td style={{ padding:"6px 9px", color:"#6b7280", maxWidth:150, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{l.notes||"—"}</td>
                      <td style={{ padding:"6px 9px" }}><button onClick={()=>del(l.id)} style={{ background:"none", border:"none", cursor:"pointer", color:"#d1d5db", fontSize:13 }}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [tab, setTab]           = useState("calculator");
  const [log, setLog]           = useState([]);
  const [scenarios, setScenarios] = useState([]);

  return (
    <div style={{ minHeight:"100vh", background:"#f8fafc", fontFamily:"'DM Sans',sans-serif", color:"#111827" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      <div style={{ background:"linear-gradient(135deg,#0f172a 0%,#1e3a5f 60%,#1e4070 100%)", padding:"18px 30px 16px", color:"white" }}>
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
          <div>
            <div style={{ fontSize:10, letterSpacing:3, opacity:0.5, textTransform:"uppercase", fontFamily:"'DM Mono',monospace" }}>SMH Innovations</div>
            <div style={{ fontSize:21, fontWeight:700, marginTop:3 }}>Locums Rate Intelligence</div>
            <div style={{ fontSize:11, opacity:0.6, marginTop:2 }}>Physician · APP · CRNA · All Specialties · v4.0</div>
          </div>
          <div style={{ display:"flex", gap:5 }}>
            {[
              { id:"calculator", icon:"📊", label:"Rate Calculator" },
              { id:"shift",      icon:"🔢", label:"Shift Builder" },
              { id:"log",        icon:"📋", label:`Bid Log${log.length>0?` (${log.length})`:""}` },
            ].map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} style={{ padding:"7px 15px", borderRadius:8, border:"none", cursor:"pointer", background:tab===t.id?"rgba(255,255,255,0.2)":"transparent", color:"white", fontWeight:tab===t.id?700:400, fontSize:12, fontFamily:"'DM Sans',sans-serif", whiteSpace:"nowrap" }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth:1180, margin:"0 auto", padding:"20px 18px" }}>
        {tab==="calculator" && <Calculator log={log} scenarios={scenarios} setScenarios={setScenarios} />}
        {tab==="shift"      && <ShiftBuilder />}
        {tab==="log"        && <BidLog log={log} setLog={setLog} />}
      </div>

      <div style={{ textAlign:"center", padding:"14px", fontSize:10, color:"#d1d5db" }}>
        SMH Innovations Rate Intelligence v4 · Internal placements, Novant benchmark, Doximity, Industry surveys · May 2026
      </div>
    </div>
  );
}