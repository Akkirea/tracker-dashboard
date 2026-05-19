import { useState, useEffect, useRef, useCallback } from "react";

const API = 'https://your-day.up.railway.app';

// ── PALETTE ───────────────────────────────────────────────────────────────
const DARK_THEME = {
  bg:"#0D0A06", surface:"#141009", card:"#1B1510",
  border:"#272018", borderMid:"#342C1E",
  text:"#EDE6D0", textMid:"#9A8E75", textDim:"#5A5040",
  folderLayer:"linear-gradient(180deg, rgba(201,168,76,0.07), rgba(27,21,16,0.82))",
  folderTab:"linear-gradient(180deg, rgba(201,168,76,0.20), rgba(201,168,76,0.10))",
  folderTabOpen:"linear-gradient(180deg, rgba(201,168,76,0.22), rgba(196,105,74,0.18))",
  folderFill:"linear-gradient(180deg, rgba(201,168,76,0.10) 0%, rgba(27,21,16,0.92) 78%)",
  folderFillOpen:"linear-gradient(180deg, rgba(201,168,76,0.16) 0%, rgba(27,21,16,0.96) 72%)",
  folderPanel:"linear-gradient(180deg, rgba(20,16,9,0.98), rgba(27,21,16,0.96))",
  folderInset:"linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0))",
  folderShadow:"0 10px 18px rgba(0,0,0,0.08)",
  folderShadowOpen:"0 18px 34px rgba(0,0,0,0.18)",
  folderStackStrong:"0.75",
  folderStackSoft:"0.55",
};
const LIGHT_THEME = {
  bg:"#F5F0E8", surface:"#FDFAF5", card:"#EDE8DF",
  border:"#DDD5C5", borderMid:"#C5BAA5",
  text:"#2A2218", textMid:"#5A4F3A", textDim:"#9A8E75",
  folderLayer:"linear-gradient(180deg, rgba(255,255,255,0.92), rgba(238,228,215,0.90))",
  folderTab:"linear-gradient(180deg, #FBF6ED, #F2E8D9)",
  folderTabOpen:"linear-gradient(180deg, #F8F0E3, #EEDFCB)",
  folderFill:"linear-gradient(180deg, #F9F5EE 0%, #F0E8DD 100%)",
  folderFillOpen:"linear-gradient(180deg, #FCF8F1 0%, #EEE4D7 100%)",
  folderPanel:"#FFFCF8",
  folderInset:"linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0))",
  folderShadow:"0 10px 22px rgba(90,79,58,0.06)",
  folderShadowOpen:"0 18px 30px rgba(90,79,58,0.09)",
  folderStackStrong:"0.18",
  folderStackSoft:"0.10",
};
if (typeof document !== "undefined") {
  const _r = document.documentElement;
  Object.entries(DARK_THEME).forEach(([k,v]) => _r.style.setProperty(`--${k}`,v));
}
const C = {
  bg:"var(--bg)", surface:"var(--surface)", card:"var(--card)",
  border:"var(--border)", borderMid:"var(--borderMid)",
  text:"var(--text)", textMid:"var(--textMid)", textDim:"var(--textDim)",
  folderLayer:"var(--folderLayer)", folderTab:"var(--folderTab)", folderTabOpen:"var(--folderTabOpen)",
  folderFill:"var(--folderFill)", folderFillOpen:"var(--folderFillOpen)", folderPanel:"var(--folderPanel)",
  folderInset:"var(--folderInset)", folderShadow:"var(--folderShadow)", folderShadowOpen:"var(--folderShadowOpen)",
  folderStackStrong:"var(--folderStackStrong)", folderStackSoft:"var(--folderStackSoft)",
  accent:"#C4694A", gold:"#C9A84C", sage:"#7A9E7E",
  blush:"#C47A8A", teal:"#5A9E9A", ice:"#7AB8C4",
};

// ── HELPERS ───────────────────────────────────────────────────────────────
const todayKey = () => toDateInputValue(new Date());
const fmtShort = (iso) => new Date(iso).toLocaleDateString("en-US",{month:"short",day:"numeric"});
const fmtFull  = () => new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});
const pad = (v) => String(v).padStart(2, "0");
const toDateInputValue = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const toLocalIsoString = (date = new Date()) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString();
};
const fmtMonthYear = (date) => date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
const fmtWeekday = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { weekday: "long" });
const isSameMonth = (left, right) =>
  left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
const startOfLocalDay = (date = new Date()) => {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
};
const parseScheduleDate = (value) => {
  if (!value) return null;
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};
const sortSchedule = (items) =>
  [...items].sort((a, b) => {
    const left = `${a.date || ""}T${a.time || "99:99"}`;
    const right = `${b.date || ""}T${b.time || "99:99"}`;
    return left.localeCompare(right);
  });

const MS_PER_DAY = 86400000;
const dateOnly = (value) => {
  const date = new Date(`${value}T00:00:00`);
  date.setHours(0, 0, 0, 0);
  return date;
};
const normalizeCycleHistory = (cycleData = {}) => {
  const starts = [
    ...(Array.isArray(cycleData.history) ? cycleData.history : []),
    ...(cycleData.lastPeriod ? [cycleData.lastPeriod] : []),
  ]
    .filter(Boolean)
    .map((date) => String(date).slice(0, 10))
    .filter((date, index, list) => list.indexOf(date) === index)
    .sort();
  return starts;
};
const averageCycleLength = (history, fallback = 28) => {
  if (!Array.isArray(history) || history.length < 2) return parseInt(fallback) || 28;
  const gaps = history
    .slice(1)
    .map((date, index) => Math.round((dateOnly(date) - dateOnly(history[index])) / MS_PER_DAY))
    .filter((days) => days >= 18 && days <= 45);
  if (!gaps.length) return parseInt(fallback) || 28;
  return Math.round(gaps.reduce((sum, days) => sum + days, 0) / gaps.length);
};

const getCycleInfo = (lastStr, cycleLen, periodLen, history = []) => {
  if (!lastStr) return null;
  const normalizedHistory = normalizeCycleHistory({ history, lastPeriod: lastStr });
  const avgCycleLen = averageCycleLength(normalizedHistory, cycleLen);
  const activeCycleLen = avgCycleLen || parseInt(cycleLen) || 28;
  const activePeriodLen = parseInt(periodLen) || 5;
  const last = dateOnly(lastStr);
  const now  = new Date();        now.setHours(0,0,0,0);
  const elapsed    = Math.floor((now - last) / MS_PER_DAY);
  const normalizedElapsed = ((elapsed % activeCycleLen) + activeCycleLen) % activeCycleLen;
  const dayInCycle = normalizedElapsed + 1;
  const daysLeft   = activeCycleLen - normalizedElapsed;
  const ovDay      = Math.max(1, activeCycleLen - 14);
  const fertStart  = Math.max(1, ovDay - 5);
  const fertEnd    = ovDay + 1;
  const inFertile  = dayInCycle >= fertStart && dayInCycle <= fertEnd;
  const daysToOv   = Math.max(0, ovDay - dayInCycle);
  const nextPeriod = new Date(now);
  nextPeriod.setDate(now.getDate() + daysLeft);
  const nextOvulation = new Date(last);
  nextOvulation.setDate(last.getDate() + ovDay - 1 + Math.max(0, Math.floor(elapsed / activeCycleLen)) * activeCycleLen);
  if (nextOvulation < now) nextOvulation.setDate(nextOvulation.getDate() + activeCycleLen);
  let phase;
  if (dayInCycle <= activePeriodLen) phase = "menstrual";
  else if (dayInCycle < ovDay - 1)  phase = "follicular";
  else if (dayInCycle <= ovDay + 2) phase = "ovulation";
  else                              phase = "luteal";
  return {
    dayInCycle,
    cycleLen: activeCycleLen,
    avgCycleLen,
    periodLen: activePeriodLen,
    daysLeft,
    ovDay,
    phase,
    inFertile,
    daysToOv,
    fertStart,
    fertEnd,
    nextPeriod: toDateInputValue(nextPeriod),
    nextOvulation: toDateInputValue(nextOvulation),
    history: normalizedHistory,
  };
};

const PHASES = {
  menstrual:  {label:"Menstrual",  moon:"🌑",color:C.blush, tagline:"rest. release. renew.",      body:"Your body is shedding what no longer serves. This is not weakness — it is the deepest kind of work. Rest without guilt.",           energy:"Rest & Restore"},
  follicular: {label:"Follicular", moon:"🌒",color:C.gold,  tagline:"rising. curious. possible.", body:"Energy is building. Your mind is sharp and open. A good phase for new projects, bold ideas, and showing up for your work.",         energy:"Build & Begin"},
  ovulation:  {label:"Ovulation",  moon:"🌕",color:C.sage,  tagline:"radiant. magnetic. full.",   body:"You are at your most expressive. Connection, creativity, and visibility come naturally now. Let yourself be seen.",                  energy:"Shine & Connect"},
  luteal:     {label:"Luteal",     moon:"🌖",color:C.accent,tagline:"inward. editing. honest.",   body:"The tide is turning. Great for finishing, editing, and saying less. Your sensitivity is information, not a flaw.",                   energy:"Refine & Finish"},
};

const DEFAULT_ANCHORS = [
  {id:"a1",name:"meditation", emoji:"🌿"},
  {id:"a2",name:"breathwork", emoji:"🌬️"},
  {id:"a3",name:"writing",    emoji:"✍️"},
  {id:"a4",name:"movement",   emoji:"🌊"},
  {id:"a5",name:"cold shower",emoji:"❄️"},
];
const DEFAULT_FOCUS = [
  {id:"f1",name:"bot / quant work",        emoji:"⚡"},
  {id:"f2",name:"course / certification",  emoji:"📚"},
  {id:"f3",name:"creative project",        emoji:"🎯"},
  {id:"f4",name:"food forest",             emoji:"🌱"},
];

// ── STORAGE ───────────────────────────────────────────────────────────────
const db = {
  get: async (k) => {
    try {
      const val = localStorage.getItem(k);
      return val ? JSON.parse(val) : null;
    } catch { return null; }
  },
  set: async (k, v) => {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {}
  },
};

const api = {
  signup: async (email, password) => {
    const r = await fetch(`${API}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return r.json();
  },
  login: async (email, password) => {
    const r = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return r.json();
  },
  load: async (token) => {
    const r = await fetch(`${API}/data`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return r.json();
  },
  save: async (token, data) => {
    await fetch(`${API}/data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    });
  },
};

// ── SHARED STYLE ATOMS ────────────────────────────────────────────────────
const inp  = {width:"100%",background:C.surface,border:`1px solid ${C.borderMid}`,borderRadius:10,padding:"11px 14px",color:C.text,fontSize:14,fontFamily:"'Outfit',sans-serif",outline:"none",boxSizing:"border-box",caretColor:C.accent};
const btn  = {background:C.accent,border:"none",borderRadius:10,padding:"11px 18px",color:"#fff",fontFamily:"'Outfit',sans-serif",fontSize:13,fontWeight:500,cursor:"pointer",letterSpacing:"0.03em",whiteSpace:"nowrap",flexShrink:0};
const ghst = {background:"none",border:`1px solid ${C.borderMid}`,borderRadius:10,padding:"11px 14px",color:C.textMid,fontFamily:"'Outfit',sans-serif",fontSize:13,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0};
const lbl  = {display:"block",fontFamily:"'Outfit',sans-serif",fontSize:11,color:C.textDim,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:6};
const sec  = {fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:13,color:C.textDim,letterSpacing:"0.1em",marginBottom:12,display:"block"};
const dash = {width:"100%",background:"none",border:`1px dashed ${C.borderMid}`,borderRadius:12,padding:"12px",color:C.textDim,fontFamily:"'Outfit',sans-serif",fontSize:13,cursor:"pointer",letterSpacing:"0.05em",marginTop:10};

const moveItem = (list, fromId, toId) => {
  if (fromId === toId) return list;
  const fromIndex = list.findIndex(item => item.id === fromId);
  const toIndex = list.findIndex(item => item.id === toId);
  if (fromIndex === -1 || toIndex === -1) return list;
  const next = [...list];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
};

const moveItemByOffset = (list, id, offset) => {
  const fromIndex = list.findIndex((item) => item.id === id);
  const toIndex = fromIndex + offset;
  if (fromIndex === -1 || toIndex < 0 || toIndex >= list.length) return list;
  const next = [...list];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
};

const playCompletionBeep = () => {
  if (typeof window === "undefined") return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  const audioContext = new AudioCtx();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
  gain.gain.setValueAtTime(0.001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.12, audioContext.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.45);

  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.45);
  oscillator.onended = () => audioContext.close();
};

function useViewportWidth() {
  const [width, setWidth] = useState(() =>
    typeof window === "undefined" ? 1280 : window.innerWidth
  );

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return width;
}

// ── MICRO COMPONENTS ─────────────────────────────────────────────────────
function Ring({done, color=C.accent, size=26}) {
  return (
    <div style={{width:size,height:size,borderRadius:"50%",flexShrink:0,border:`2px solid ${done?color:C.borderMid}`,background:done?color:"transparent",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.18s ease",cursor:"pointer"}}>
      {done && <span style={{color:"#fff",fontSize:11,lineHeight:1}}>✓</span>}
    </div>
  );
}

function HabitRow({
  h,
  done,
  onToggle,
  onRemove,
  ringColor,
  draggable = false,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onMoveUp,
  onMoveDown,
}) {
  const [hov,setHov] = useState(false);
  return (
    <div onClick={onToggle} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      draggable={draggable} onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop} onDragEnd={onDragEnd}
      style={{display:"flex",alignItems:"center",gap:14,padding:"13px 16px",background:done?"#1C1B12":C.card,border:`1px solid ${done?"#2C2A18":C.border}`,borderRadius:12,cursor:"pointer",transition:"background 0.15s",marginBottom:8}}>
      <Ring done={done} color={ringColor||C.accent}/>
      <span style={{fontSize:17}}>{h.emoji}</span>
      <span style={{fontFamily:"'Outfit',sans-serif",fontSize:14,flex:1,color:done?C.textDim:C.text,textDecoration:done?"line-through":"none",letterSpacing:"0.02em"}}>{h.name}</span>
      {(onMoveUp || onMoveDown) && (
        <div onClick={(e)=>e.stopPropagation()} style={{display:"flex",gap:6,alignItems:"center"}}>
          {onMoveUp && <button onClick={onMoveUp} style={{...ghst,padding:"4px 8px",fontSize:11}}>↑</button>}
          {onMoveDown && <button onClick={onMoveDown} style={{...ghst,padding:"4px 8px",fontSize:11}}>↓</button>}
        </div>
      )}
      {draggable && !onMoveUp && !onMoveDown && <span onClick={e=>e.stopPropagation()} style={{color:C.textDim,fontSize:14,cursor:"grab"}}>⋮⋮</span>}
      {hov && <button onClick={e=>{e.stopPropagation();onRemove();}} style={{background:"none",border:"none",color:C.textDim,cursor:"pointer",fontSize:13}}>✕</button>}
    </div>
  );
}

function AddRow({show,setShow,val,setVal,onAdd,placeholder}) {
  return show ? (
    <div style={{display:"flex",gap:8,marginTop:4}}>
      <input autoFocus value={val} onChange={e=>setVal(e.target.value)} onKeyDown={e=>e.key==="Enter"&&onAdd()} placeholder={placeholder} style={inp}/>
      <button onClick={onAdd} style={btn}>add</button>
      <button onClick={()=>setShow(false)} style={ghst}>✕</button>
    </div>
  ) : (
    <button onClick={()=>setShow(true)} style={dash}>+ {placeholder}</button>
  );
}

function ProgressBar({done,total,color=C.accent,label}) {
  const pct = total ? Math.round((done/total)*100) : 0;
  const all  = pct===100 && total>0;
  return (
    <div style={{marginBottom:26}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:14,color:C.textMid,letterSpacing:"0.08em",fontStyle:"italic"}}>{label}</span>
        <span style={{fontFamily:"'Outfit',sans-serif",fontSize:12,color:all?C.sage:C.textDim}}>{done}/{total}</span>
      </div>
      <div style={{height:2,background:C.border,borderRadius:2,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${pct}%`,background:all?C.sage:color,borderRadius:2,transition:"width 0.4s ease"}}/>
      </div>
      {all && <p style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:14,color:C.sage,textAlign:"center",margin:"10px 0 0"}}>you showed up. fully. ✦</p>}
    </div>
  );
}

// ── WIM HOF BREATHWORK ────────────────────────────────────────────────────
const WH_PHASES = {
  inhale:    {label:"breathe in",    dur:2,   color:C.ice,   scale:1.25},
  exhale:    {label:"breathe out",   dur:2,   color:C.teal,  scale:0.75},
  holdEmpty: {label:"hold — empty",  dur:null, color:C.blush, scale:0.75},
  holdFull:  {label:"hold — full",   dur:15,  color:C.gold,  scale:1.15},
  rest:      {label:"round complete",dur:3,   color:C.sage,  scale:1.0},
};
const TOTAL_ROUNDS   = 3;
const BREATHS_PER_ROUND = 30;
const HOLD_SUGGESTED = 90; // shown as a guide, user taps to continue

function BreathCircle({phase, progress, breathCount, round}) {
  const p    = WH_PHASES[phase] || WH_PHASES.inhale;
  const size = 200;
  const base = 70;
  const maxR = 90;
  const r    = base + (maxR - base) * (phase==="inhale" ? progress : phase==="exhale" ? (1-progress) : phase==="holdEmpty" ? 0 : phase==="holdFull" ? 1 : 0.5);
  const pulseDur = phase==="inhale" ? "2s" : phase==="exhale" ? "2s" : "1.6s";

  return (
    <div style={{position:"relative",width:size,height:size,margin:"0 auto 8px"}}>
      {/* outer glow rings */}
      <div style={{position:"absolute",inset:0,borderRadius:"50%",background:`radial-gradient(circle at center, ${p.color}18 0%, transparent 70%)`,transition:"background 1.5s ease"}}/>
      <svg width={size} height={size} style={{position:"absolute",inset:0}}>
        {/* track */}
        <circle cx={size/2} cy={size/2} r={92} fill="none" stroke={C.border} strokeWidth="1.5"/>
        {/* progress arc for timed phases */}
        {(phase==="inhale"||phase==="exhale"||phase==="holdFull"||phase==="rest") && (
          <circle cx={size/2} cy={size/2} r={92} fill="none" stroke={p.color} strokeWidth="1.5" strokeOpacity="0.4"
            strokeDasharray={`${2*Math.PI*92}`}
            strokeDashoffset={`${2*Math.PI*92*(1-progress)}`}
            strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`}
            style={{transition:"stroke-dashoffset 0.1s linear"}}/>
        )}
      </svg>
      {/* main circle */}
      <div style={{
        position:"absolute",
        left:`${size/2 - r}px`, top:`${size/2 - r}px`,
        width:`${r*2}px`, height:`${r*2}px`,
        borderRadius:"50%",
        background:`radial-gradient(circle at 38% 38%, ${p.color}55, ${p.color}22)`,
        border:`1.5px solid ${p.color}60`,
        transition:"left 1.9s ease, top 1.9s ease, width 1.9s ease, height 1.9s ease, background 1.5s ease, border-color 1.5s ease",
        boxShadow:`0 0 ${20+r*0.2}px ${p.color}25`,
        display:"flex", alignItems:"center", justifyContent:"center",
      }}>
      </div>
    </div>
  );
}

function WimHofTab() {
  const [status, setStatus] = useState("idle"); // idle | running | paused
  const audioRef = useRef(null);

  const start = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio('/Breathing.mp3');
      audioRef.current.addEventListener("ended", () => setStatus("idle"));
    }
    audioRef.current.play();
    setStatus("running");
  };

  const pause = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    setStatus("paused");
  };

  const end = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setStatus("idle");
  };

  useEffect(() => () => {
    if (audioRef.current) audioRef.current.pause();
  }, []);

  return (
    <div>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:18,padding:"24px 18px",marginBottom:20,textAlign:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
          <span style={{fontSize:20}}>❄️</span>
          <div>
            <span style={{fontFamily:"'Outfit',sans-serif",fontSize:12,color:C.textDim,letterSpacing:"0.08em",textTransform:"uppercase"}}>wim hof method</span>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:16,color:C.text,marginTop:1}}>guided audio session</div>
          </div>
        </div>
        <div style={{height:200,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{textAlign:"center"}}>
            <div style={{width:130,height:130,borderRadius:"50%",background:`radial-gradient(circle at 38% 38%, ${C.ice}30, ${C.ice}10)`,border:`1.5px solid ${C.ice}30`,margin:"0 auto 16px",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:status==="running"?`0 0 34px ${C.ice}25`:"none",transition:"box-shadow 0.3s ease"}}>
              <span style={{fontSize:40}}>❄️</span>
            </div>
            <p style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:13,color:C.textDim,margin:0}}>
              {status==="running" ? "session playing" : status==="paused" ? "session paused" : "find a comfortable position"}
            </p>
          </div>
        </div>
      </div>

      <div style={{display:"flex",gap:8,justifyContent:"center"}}>
        {status==="idle" && (
          <button onClick={start} style={{...btn,background:C.ice,fontSize:14,padding:"13px 40px"}}>begin</button>
        )}
        {status==="running" && (
          <button onClick={pause} style={{...ghst,fontSize:13,padding:"13px 40px"}}>pause</button>
        )}
        {status==="paused" && (
          <>
            <button onClick={start} style={{...btn,background:C.ice,fontSize:14,padding:"13px 28px"}}>resume</button>
            <button onClick={end} style={{...ghst,fontSize:13,padding:"13px 28px"}}>end</button>
          </>
        )}
      </div>

      {status==="idle" && (
        <div style={{marginTop:24,background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"16px"}}>
          <span style={sec}>how it works</span>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {[
              {n:"1",text:"press begin and follow the encoded audio."},
              {n:"2",text:"pause if you need to step away."},
              {n:"3",text:"press end to stop and return to the beginning."},
            ].map(s => (
              <div key={s.n} style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                <div style={{width:22,height:22,borderRadius:"50%",background:`${C.ice}25`,border:`1px solid ${C.ice}40`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <span style={{fontFamily:"'Outfit',sans-serif",fontSize:10,color:C.ice}}>{s.n}</span>
                </div>
                <p style={{fontFamily:"'Outfit',sans-serif",fontSize:13,color:C.textMid,lineHeight:1.65,margin:0}}>{s.text}</p>
              </div>
            ))}
          </div>
          <p style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:12,color:C.textDim,marginTop:14,marginBottom:0}}>
            ⚠️ do this sitting or lying down. do not practice while driving or in water.
          </p>
        </div>
      )}
    </div>
  );
}

const pickEmoji = (pool, existing) => {
  const used = existing.map(i=>i.emoji);
  const avail = pool.filter(e=>!used.includes(e));
  const src = avail.length ? avail : pool;
  return src[Math.floor(Math.random()*src.length)];
};

// ── TODAY ─────────────────────────────────────────────────────────────────
function TodayTab({habits,doneIds,setDoneIds,setHabits}) {
  const [showAdd,setShowAdd] = useState(false);
  const [newVal,setNewVal]   = useState("");
  const EMOJIS = ["✨","🌱","💫","🔥","🌙","⚡","🦋","🍃","🌸","🎋"];
  const toggle = id => setDoneIds(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
  const remove = id => {setHabits(p=>p.filter(h=>h.id!==id));setDoneIds(p=>p.filter(x=>x!==id));};
  const add = () => {
    if (!newVal.trim()) return;
    setHabits(p=>[...p,{id:`a${Date.now()}`,name:newVal.trim().toLowerCase(),emoji:pickEmoji(EMOJIS,p)}]);
    setNewVal(""); setShowAdd(false);
  };
  return (
    <div>
      <ProgressBar done={doneIds.length} total={habits.length} label="morning anchors"/>
      {habits.map((h, index)=><HabitRow key={h.id} h={h} done={doneIds.includes(h.id)} onToggle={()=>toggle(h.id)} onRemove={()=>remove(h.id)}
        onMoveUp={index > 0 ? () => setHabits((p) => moveItemByOffset(p, h.id, -1)) : undefined}
        onMoveDown={index < habits.length - 1 ? () => setHabits((p) => moveItemByOffset(p, h.id, 1)) : undefined}
      />)}
      <AddRow show={showAdd} setShow={setShowAdd} val={newVal} setVal={setNewVal} onAdd={add} placeholder="add a morning anchor"/>
    </div>
  );
}

// ── FOCUS ─────────────────────────────────────────────────────────────────
function FocusTab({tasks,doneIds,setDoneIds,setTasks,music}) {
  const [showAdd,setShowAdd] = useState(false);
  const [newVal,setNewVal]   = useState("");
  const [timer,setTimer]     = useState(15*60);
  const [running,setRunning] = useState(false);
  const [sessionMin,setSessionMin] = useState(15);
  const [customMin,setCustomMin] = useState("");
  const ref = useRef(null);
  const didAlertRef = useRef(false);
  const EMOJIS = ["🎯","📝","💻","🔬","📊","🗂️","✏️","🔧","🧠","📐"];
  useEffect(()=>{
    if(running){
      const startTime=Date.now(), startTimer=timer;
      ref.current=setInterval(()=>{
        const newT=startTimer-Math.floor((Date.now()-startTime)/1000);
        if(newT<=0){clearInterval(ref.current);setRunning(false);didAlertRef.current=true;playCompletionBeep();setTimer(0);}
        else setTimer(newT);
      },500);
    } else clearInterval(ref.current);
    return ()=>clearInterval(ref.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[running]);
  useEffect(() => {
    if (timer > 0) didAlertRef.current = false;
  }, [timer]);


  const applyCustomMin=()=>{const m=parseInt(customMin,10);if(!customMin.trim()||!m||m<1||m>180)return;setSessionMin(m);setTimer(m*60);setRunning(false);setCustomMin("");};
  const reset = ()=>{setRunning(false);setTimer(sessionMin*60);didAlertRef.current = false;};
  const fmt = s=>`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
  const pct = ((sessionMin*60-timer)/(sessionMin*60))*100;
  const r=54, circ=2*Math.PI*r;
  const toggle = id=>setDoneIds(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
  const remove = id=>{setTasks(p=>p.filter(h=>h.id!==id));setDoneIds(p=>p.filter(x=>x!==id));};
  const add = ()=>{if(!newVal.trim())return;setTasks(p=>[...p,{id:`f${Date.now()}`,name:newVal.trim().toLowerCase(),emoji:pickEmoji(EMOJIS,p)}]);setNewVal("");setShowAdd(false);};
  const visibleDoneCount = tasks.filter((task) => doneIds.includes(task.id)).length;
  return (
    <div>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:18,padding:"22px 20px",marginBottom:24,textAlign:"center"}}>
        <div style={{position:"relative",display:"inline-block",width:120,height:120,marginBottom:14}}>
          <svg width="120" height="120" style={{transform:"rotate(-90deg)"}}>
            <circle cx="60" cy="60" r={r} fill="none" stroke={C.border} strokeWidth="5"/>
            <circle cx="60" cy="60" r={r} fill="none" stroke={C.teal} strokeWidth="5" strokeDasharray={circ} strokeDashoffset={circ*(1-pct/100)} strokeLinecap="round" style={{transition:"stroke-dashoffset 1s linear"}}/>
          </svg>
          <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:26,fontWeight:300,color:C.text}}>{fmt(timer)}</span>
          </div>
        </div>
        <div style={{display:"flex",justifyContent:"center",gap:8,marginBottom:14,flexWrap:"wrap"}}>
          {[15,25,45,60].map(m=>(
            <button key={m} onClick={()=>{setSessionMin(m);setTimer(m*60);setRunning(false);}}
              style={{...ghst,padding:"6px 14px",fontSize:12,border:`1px solid ${sessionMin===m?C.teal:C.borderMid}`,color:sessionMin===m?C.teal:C.textDim}}>{m}m</button>
          ))}
          <input type="number" min="1" max="180" value={customMin} onChange={e=>setCustomMin(e.target.value)} onKeyDown={e=>e.key==="Enter"&&applyCustomMin()} onBlur={applyCustomMin} placeholder="min" style={{...inp,width:60,padding:"4px 8px",fontSize:12,textAlign:"center"}}/>
        </div>
        <div style={{display:"flex",justifyContent:"center",gap:10}}>
          <button onClick={()=>setRunning(r=>!r)} style={{...btn,background:running?C.accent:C.teal,minWidth:90}}>{running?"pause":timer===sessionMin*60?"start":"resume"}</button>
          <button onClick={reset} style={ghst}>reset</button>
        </div>
      </div>
      <ProgressBar done={visibleDoneCount} total={tasks.length} label="focus block" color={C.teal}/>
      <p style={{fontFamily:"'Outfit',sans-serif",fontSize:11,color:C.textDim,margin:"-8px 0 18px"}}>
        Timer plays a short beep when it reaches zero.
      </p>
      {tasks.map((h, index)=><HabitRow key={h.id} h={h} done={doneIds.includes(h.id)} onToggle={()=>toggle(h.id)} onRemove={()=>remove(h.id)} ringColor={C.teal}
        onMoveUp={index > 0 ? () => setTasks((p) => moveItemByOffset(p, h.id, -1)) : undefined}
        onMoveDown={index < tasks.length - 1 ? () => setTasks((p) => moveItemByOffset(p, h.id, 1)) : undefined}
      />)}
      <AddRow show={showAdd} setShow={setShowAdd} val={newVal} setVal={setNewVal} onAdd={add} placeholder="add a focus task"/>
    </div>
  );
}

// ── GROCERY ───────────────────────────────────────────────────────────────
function GroceryRow({item,onToggle,onRemove,alwaysShowDelete=false,draggable=false,onDragStart,onDragOver,onDrop,onDragEnd,onMoveUp,onMoveDown}) {
  const [hov,setHov]=useState(false);
  const showDelete = alwaysShowDelete || hov;
  return (
    <div onClick={onToggle} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      draggable={draggable} onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop} onDragEnd={onDragEnd}
      style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",background:item.done?`${C.gold}08`:C.card,border:`1px solid ${item.done?C.borderMid:C.border}`,borderRadius:12,cursor:"pointer",marginBottom:8}}>
      <Ring done={item.done} color={C.gold} size={24}/>
      <span style={{fontFamily:"'Outfit',sans-serif",fontSize:14,flex:1,color:item.done?C.textDim:C.text,textDecoration:item.done?"line-through":"none"}}>{item.name}</span>
      {item.qty&&<span style={{fontFamily:"'Outfit',sans-serif",fontSize:12,color:C.textDim,flexShrink:0}}>{item.qty}</span>}
      {(onMoveUp || onMoveDown) && (
        <div onClick={(e)=>e.stopPropagation()} style={{display:"flex",gap:6}}>
          {onMoveUp && <button onClick={onMoveUp} style={{...ghst,padding:"4px 8px",fontSize:11}}>↑</button>}
          {onMoveDown && <button onClick={onMoveDown} style={{...ghst,padding:"4px 8px",fontSize:11}}>↓</button>}
        </div>
      )}
      {draggable && !onMoveUp && !onMoveDown && <span onClick={e=>e.stopPropagation()} style={{color:C.textDim,fontSize:14,cursor:"grab"}}>⋮⋮</span>}
      {showDelete&&<button onClick={e=>{e.stopPropagation();onRemove();}} style={{background:"none",border:"none",color:C.textDim,cursor:"pointer",fontSize:13}}>✕</button>}
    </div>
  );
}

function GroceryTab({items,setItems}) {
  const [showAdd,setShowAdd]=useState(false);
  const [name,setName]=useState("");
  const [qty,setQty]=useState("");
  const toggle  = id=>setItems(p=>p.map(i=>i.id===id?{...i,done:!i.done}:i));
  const remove  = id=>setItems(p=>p.filter(i=>i.id!==id));
  const clearDone=()=>setItems(p=>p.filter(i=>!i.done));
  const add=()=>{if(!name.trim())return;setItems(p=>[...p,{id:`gr${Date.now()}`,name:name.trim().toLowerCase(),qty:qty.trim(),done:false}]);setName("");setQty("");setShowAdd(false);};
  const active=items.filter(i=>!i.done), done=items.filter(i=>i.done);
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
        <p style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:15,color:C.textMid,margin:0}}>grocery list</p>
        {done.length>0&&<button onClick={clearDone} style={{background:"none",border:"none",color:C.textDim,fontFamily:"'Outfit',sans-serif",fontSize:12,cursor:"pointer"}}>clear checked ({done.length})</button>}
      </div>
      {active.map((i, index)=><GroceryRow key={i.id} item={i} onToggle={()=>remove(i.id)} onRemove={()=>remove(i.id)}
        onMoveUp={index > 0 ? () => setItems((p) => {
          const activeItems = p.filter((item) => !item.done);
          const doneItems = p.filter((item) => item.done);
          return [...moveItemByOffset(activeItems, i.id, -1), ...doneItems];
        }) : undefined}
        onMoveDown={index < active.length - 1 ? () => setItems((p) => {
          const activeItems = p.filter((item) => !item.done);
          const doneItems = p.filter((item) => item.done);
          return [...moveItemByOffset(activeItems, i.id, 1), ...doneItems];
        }) : undefined}
      />)}
      {showAdd?(
        <div style={{display:"flex",gap:8,marginTop:4,flexWrap:"wrap"}}>
          <input autoFocus value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()} placeholder="item name" style={{...inp,flex:2,minWidth:0}}/>
          <input value={qty} onChange={e=>setQty(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()} placeholder="qty" style={{...inp,flex:1,minWidth:60}}/>
          <button onClick={add} style={btn}>add</button>
          <button onClick={()=>setShowAdd(false)} style={ghst}>✕</button>
        </div>
      ):(
        <button onClick={()=>setShowAdd(true)} style={dash}>+ add item</button>
      )}
      {done.length>0&&<div style={{marginTop:24}}><span style={sec}>in the cart</span>{done.map(i=><GroceryRow key={i.id} item={i} onToggle={()=>toggle(i.id)} onRemove={()=>remove(i.id)} alwaysShowDelete={true}/>)}</div>}
      {items.length===0&&<p style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:14,color:C.textDim,textAlign:"center",marginTop:20}}>your grocery list is empty</p>}
    </div>
  );
}

// ── JOURNAL ───────────────────────────────────────────────────────────────
function GratitudeDay({ dateKey, entries, open, onToggle, onDelete }) {
  return (
    <div style={{borderBottom:`1px solid ${C.border}`,padding:"14px 0"}}>
      <button
        onClick={onToggle}
        style={{width:"100%",background:"none",border:"none",padding:0,cursor:"pointer",display:"flex",alignItems:"baseline",gap:12,textAlign:"left"}}
      >
        <span style={{fontFamily:"'Outfit',sans-serif",fontSize:15,fontWeight:500,color:C.text,lineHeight:1}}>
          {fmtShort(dateKey)}
        </span>
        <span style={{fontFamily:"'Outfit',sans-serif",fontSize:10,color:C.textDim,letterSpacing:"0.08em",textTransform:"uppercase",flex:1}}>
          {fmtWeekday(dateKey)}
        </span>
        <span style={{fontFamily:"'Outfit',sans-serif",fontSize:11,color:C.textDim}}>
          {entries.length} saved
        </span>
        <span style={{fontSize:11,color:open ? C.gold : C.textDim}}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{display:"grid",gap:10,marginTop:14,paddingLeft:2}}>
          {entries.map((entry) => (
            <div key={entry.id} style={{display:"flex",gap:12,alignItems:"flex-start"}}>
              <div style={{width:4,height:4,borderRadius:"50%",background:C.gold,marginTop:13,flexShrink:0}} />
              <div style={{flex:1,minWidth:0}}>
                <p style={{fontFamily:"'Outfit',sans-serif",fontSize:14,color:C.text,lineHeight:1.7,margin:0,whiteSpace:"pre-wrap"}}>{entry.text}</p>
              </div>
              <button onClick={() => onDelete(entry.id)} style={{background:"none",border:"none",color:C.textDim,cursor:"pointer",fontSize:12,padding:0,flexShrink:0}}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GratitudeMonth({ monthKey, days, groupedEntries, open, openDay, onToggleMonth, onToggleDay, onDelete }) {
  const entryCount = days.reduce((count, day) => count + groupedEntries[day].length, 0);

  return (
    <div style={{borderBottom:`1px solid ${C.border}`,padding:"16px 0"}}>
      <button
        onClick={onToggleMonth}
        style={{width:"100%",background:"none",border:"none",padding:0,cursor:"pointer",display:"flex",alignItems:"baseline",gap:12,textAlign:"left"}}
      >
        <span style={{fontFamily:"'Outfit',sans-serif",fontSize:16,fontWeight:500,color:C.text,lineHeight:1}}>
          {fmtMonthYear(new Date(`${monthKey}-01T00:00:00`))}
        </span>
        <span style={{fontFamily:"'Outfit',sans-serif",fontSize:11,color:C.textDim,flex:1}}>
          {entryCount} saved
        </span>
        <span style={{fontSize:11,color:open ? C.gold : C.textDim}}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{marginTop:10,paddingLeft:10,borderLeft:`1px solid ${C.border}`}}>
          {days.map((day) => (
            <GratitudeDay
              key={day}
              dateKey={day}
              entries={groupedEntries[day]}
              open={openDay === day}
              onToggle={() => onToggleDay(day)}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function JournalTab({entries,setEntries}) {
  const [text,setText]=useState("");
  const tk=todayKey();
  const groupedEntries = entries.reduce((groups, entry) => {
    const key = entry.date.slice(0, 10);
    if (!groups[key]) groups[key] = [];
    groups[key].push(entry);
    return groups;
  }, {});
  const orderedDays = Object.keys(groupedEntries).sort((a, b) => b.localeCompare(a));
  const currentMonthKey = tk.slice(0, 7);
  const [openDay, setOpenDay] = useState(null);
  const [openMonth, setOpenMonth] = useState(currentMonthKey);
  const currentMonthDays = orderedDays.filter((day) => day.startsWith(currentMonthKey));
  const archivedMonthKeys = [...new Set(orderedDays
    .map((day) => day.slice(0, 7))
    .filter((monthKey) => monthKey !== currentMonthKey))]
    .sort((a, b) => b.localeCompare(a));
  const daysByMonth = archivedMonthKeys.reduce((months, monthKey) => {
    months[monthKey] = orderedDays.filter((day) => day.startsWith(monthKey));
    return months;
  }, {});
  const add=()=>{if(!text.trim())return;setEntries(p=>[{id:`j${Date.now()}`,date:toLocalIsoString(),text:text.trim()},...p]);setText("");};
  const del=id=>setEntries(p=>p.filter(e=>e.id!==id));
  const toggleDay = (day) => setOpenDay((current) => current === day ? null : day);

  useEffect(() => {
    if (!orderedDays.length) {
      setOpenDay(null);
      return;
    }
    if (openDay && !groupedEntries[openDay]) {
      setOpenDay(null);
    }
  }, [openDay, orderedDays, groupedEntries]);

  useEffect(() => {
    if (openMonth && openMonth !== currentMonthKey && !archivedMonthKeys.includes(openMonth)) {
      setOpenMonth(null);
    }
  }, [openMonth, currentMonthKey, archivedMonthKeys]);

  return (
    <div>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:"18px 18px 14px",marginBottom:22}}>
        <span style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:13,color:C.textDim,display:"block",marginBottom:10}}>3 things you feel grateful for today</span>
        <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="write it here..." rows={4}
          style={{width:"100%",background:"none",border:"none",borderBottom:`1px solid ${C.borderMid}`,padding:"8px 0",color:C.text,fontSize:14,fontFamily:"'Outfit',sans-serif",outline:"none",boxSizing:"border-box",caretColor:C.accent,resize:"none",lineHeight:1.75}}/>
        <div style={{display:"flex",justifyContent:"flex-end",marginTop:12}}>
          <button onClick={add} style={btn}>save entry</button>
        </div>
      </div>
      {[currentMonthKey, ...archivedMonthKeys].filter(mk => (mk===currentMonthKey ? currentMonthDays : daysByMonth[mk])?.length).map(monthKey => (
        <GratitudeMonth
          key={monthKey}
          monthKey={monthKey}
          days={monthKey===currentMonthKey ? currentMonthDays : daysByMonth[monthKey]}
          groupedEntries={groupedEntries}
          open={openMonth === monthKey}
          openDay={openDay}
          onToggleMonth={() => setOpenMonth(cur => cur === monthKey ? null : monthKey)}
          onToggleDay={toggleDay}
          onDelete={del}
        />
      ))}
      {entries.length===0&&<p style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:14,color:C.textDim,textAlign:"center",marginTop:20}}>your gratitude entries will live here</p>}
    </div>
  );
}

// ── NOTES ────────────────────────────────────────────────────────────────
function NotesTab({notes, setNotes}) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ title:"", text:"" });
  const add = () => {
    if (!title.trim() && !text.trim()) return;
    setNotes((current) => [
      {
        id: `n${Date.now()}`,
        title: title.trim() || "untitled note",
        text: text.trim(),
        date: new Date().toISOString(),
      },
      ...current,
    ]);
    setTitle("");
    setText("");
  };
  const remove = (id) => setNotes((current) => current.filter((note) => note.id !== id));
  const startEdit = (note) => {
    setEditingId(note.id);
    setEditForm({ title: note.title || "", text: note.text || "" });
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ title:"", text:"" });
  };
  const saveEdit = (id) => {
    if (!editForm.title.trim() && !editForm.text.trim()) return;
    setNotes((current) => current.map((note) => note.id === id ? {
      ...note,
      title: editForm.title.trim() || "untitled note",
      text: editForm.text.trim(),
      updatedAt: new Date().toISOString(),
    } : note));
    cancelEdit();
  };

  return (
    <div>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:"18px 18px 14px",marginBottom:22}}>
        <span style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:13,color:C.textDim,display:"block",marginBottom:10}}>quick notes</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="note title"
          style={{...inp, marginBottom:10}}
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="write your note here..."
          rows={5}
          style={{...inp, resize:"vertical", lineHeight:1.7, fontFamily:"'Cormorant Garamond',serif", fontSize:16}}
        />
        <div style={{display:"flex",justifyContent:"flex-end",marginTop:12}}>
          <button onClick={add} style={btn}>save note</button>
        </div>
      </div>
      {notes.length === 0 && (
        <p style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:14,color:C.textDim,textAlign:"center",marginTop:20}}>
          your notes will live here
        </p>
      )}
      {notes.map((note) => (
        <div key={note.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px 16px",marginBottom:10}}>
          {editingId === note.id ? (
            <div>
              <input
                value={editForm.title}
                onChange={(e) => setEditForm((current) => ({ ...current, title: e.target.value }))}
                placeholder="note title"
                style={{...inp, marginBottom:10}}
              />
              <textarea
                value={editForm.text}
                onChange={(e) => setEditForm((current) => ({ ...current, text: e.target.value }))}
                placeholder="write your note here..."
                rows={5}
                style={{...inp, resize:"vertical", lineHeight:1.7, fontFamily:"'Cormorant Garamond',serif", fontSize:16}}
              />
              <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:12}}>
                <button onClick={() => saveEdit(note.id)} style={btn}>save</button>
                <button onClick={cancelEdit} style={ghst}>cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start"}}>
                <div>
                  <div style={{fontFamily:"'Outfit',sans-serif",fontSize:14,color:C.text}}>{note.title}</div>
                  <div style={{fontFamily:"'Outfit',sans-serif",fontSize:11,color:C.textDim,marginTop:4}}>
                    {fmtShort(note.date)}{note.updatedAt ? " · edited" : ""}
                  </div>
                </div>
                <div style={{display:"flex",gap:10,alignItems:"center",flexShrink:0}}>
                  <button onClick={() => startEdit(note)} style={{background:"none",border:"none",color:C.textDim,cursor:"pointer",fontSize:12,padding:0}}>edit</button>
                  <button onClick={() => remove(note.id)} style={{background:"none",border:"none",color:C.textDim,cursor:"pointer",fontSize:12,padding:0}}>remove</button>
                </div>
              </div>
              {note.text && (
                <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:16,color:C.textMid,lineHeight:1.7,margin:"12px 0 0",whiteSpace:"pre-wrap"}}>
                  {note.text}
                </p>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

// ── QUOTES ───────────────────────────────────────────────────────────────
function QuotesTab({quotes, setQuotes}) {
  const [text, setText] = useState("");
  const [source, setSource] = useState("");

  const add = () => {
    if (!text.trim()) return;
    setQuotes((current) => [
      {
        id: `q${Date.now()}`,
        text: text.trim(),
        source: source.trim(),
        date: new Date().toISOString(),
      },
      ...current,
    ]);
    setText("");
    setSource("");
  };

  const remove = (id) => setQuotes((current) => current.filter((quote) => quote.id !== id));

  return (
    <div>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:"18px 18px 14px",marginBottom:22}}>
        <span style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:13,color:C.textDim,display:"block",marginBottom:10}}>inspired quotes</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="write the quote here..."
          rows={4}
          style={{...inp, resize:"vertical", lineHeight:1.7, fontSize:14, marginBottom:10}}
        />
        <input
          value={source}
          onChange={(e) => setSource(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="author, book, or source"
          style={inp}
        />
        <div style={{display:"flex",justifyContent:"flex-end",marginTop:12}}>
          <button onClick={add} style={btn}>save quote</button>
        </div>
      </div>
      {quotes.length === 0 && (
        <p style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:14,color:C.textDim,textAlign:"center",marginTop:20}}>
          your quotes will live here
        </p>
      )}
      {quotes.map((quote) => (
        <div key={quote.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"16px 18px",marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start"}}>
            <div style={{flex:1,minWidth:0}}>
              <p style={{fontFamily:"'Outfit',sans-serif",fontSize:14,color:C.text,lineHeight:1.65,margin:0,whiteSpace:"pre-wrap"}}>
                "{quote.text}"
              </p>
              <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginTop:10}}>
                {quote.source && (
                  <span style={{fontFamily:"'Outfit',sans-serif",fontSize:12,color:C.textMid}}>
                    {quote.source}
                  </span>
                )}
                <span style={{fontFamily:"'Outfit',sans-serif",fontSize:11,color:C.textDim}}>
                  {fmtShort(quote.date)}
                </span>
              </div>
            </div>
            <button onClick={() => remove(quote.id)} style={{background:"none",border:"none",color:C.textDim,cursor:"pointer",fontSize:12,padding:0,flexShrink:0}}>remove</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── GOALS ─────────────────────────────────────────────────────────────────
function GoalItem({goal,toggle,remove,draggable=false,onDragStart,onDragOver,onDrop,onDragEnd,onMoveUp,onMoveDown}) {
  const [hov,setHov]=useState(false);
  return (
    <div onClick={()=>toggle(goal.id)} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      draggable={draggable} onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop} onDragEnd={onDragEnd}
      style={{display:"flex",alignItems:"flex-start",gap:12,padding:"13px 16px",background:goal.done?"#1A1D14":C.card,border:`1px solid ${goal.done?"#252A1C":C.border}`,borderRadius:12,marginBottom:8,cursor:"pointer"}}>
      <Ring done={goal.done} color={C.gold} size={24}/>
      <span style={{fontFamily:"'Outfit',sans-serif",fontSize:14,flex:1,color:goal.done?C.textDim:C.text,textDecoration:goal.done?"line-through":"none",lineHeight:1.6,paddingTop:2}}>{goal.text}</span>
      {(onMoveUp || onMoveDown) && (
        <div onClick={(e)=>e.stopPropagation()} style={{display:"flex",gap:6}}>
          {onMoveUp && <button onClick={onMoveUp} style={{...ghst,padding:"4px 8px",fontSize:11}}>↑</button>}
          {onMoveDown && <button onClick={onMoveDown} style={{...ghst,padding:"4px 8px",fontSize:11}}>↓</button>}
        </div>
      )}
      {draggable && !onMoveUp && !onMoveDown && <span onClick={e=>e.stopPropagation()} style={{color:C.textDim,fontSize:14,cursor:"grab"}}>⋮⋮</span>}
      {hov&&<button onClick={e=>{e.stopPropagation();remove(goal.id);}} style={{background:"none",border:"none",color:C.textDim,cursor:"pointer",fontSize:13}}>✕</button>}
    </div>
  );
}

function GoalsTab({goals,setGoals}) {
  const [showAdd,setShowAdd]=useState(false);
  const [newVal,setNewVal]=useState("");
  const toggle=id=>setGoals(p=>p.map(g=>g.id===id?{...g,done:!g.done}:g));
  const remove=id=>setGoals(p=>p.filter(g=>g.id!==id));
  const add=()=>{if(!newVal.trim())return;setGoals(p=>[...p,{id:`d${Date.now()}`,text:newVal.trim(),done:false}]);setNewVal("");setShowAdd(false);};
  const active=goals.filter(g=>!g.done), done=goals.filter(g=>g.done);
  return (
    <div>
      <p style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:15,color:C.textMid,marginBottom:22}}>what you're building toward</p>
      {active.map((g, index)=><GoalItem key={g.id} goal={g} toggle={toggle} remove={remove}
        onMoveUp={index > 0 ? () => setGoals((p) => {
          const activeGoals = p.filter((goal) => !goal.done);
          const doneGoals = p.filter((goal) => goal.done);
          return [...moveItemByOffset(activeGoals, g.id, -1), ...doneGoals];
        }) : undefined}
        onMoveDown={index < active.length - 1 ? () => setGoals((p) => {
          const activeGoals = p.filter((goal) => !goal.done);
          const doneGoals = p.filter((goal) => goal.done);
          return [...moveItemByOffset(activeGoals, g.id, 1), ...doneGoals];
        }) : undefined}
      />)}
      <AddRow show={showAdd} setShow={setShowAdd} val={newVal} setVal={setNewVal} onAdd={add} placeholder="a dream or goal"/>
      {done.length>0&&<div style={{marginTop:28}}><span style={sec}>manifested ✦</span>{done.map(g=><GoalItem key={g.id} goal={g} toggle={toggle} remove={remove}/>)}</div>}
      {goals.length===0&&<p style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:14,color:C.textDim,textAlign:"center",marginTop:20}}>your dreams live here — write them down</p>}
    </div>
  );
}

// ── CYCLE ─────────────────────────────────────────────────────────────────
function CycleTab({cycleData,setCycleData,info}) {
  const [editing,setEditing]=useState(!cycleData.lastPeriod);
  const [form,setForm]=useState(cycleData);
  const history = normalizeCycleHistory(cycleData);

  // sync form when remote data loads (e.g. switching devices)
  useEffect(()=>{
    setForm({
      ...cycleData,
      history: normalizeCycleHistory(cycleData),
      cycleLength: cycleData.cycleLength || 28,
      periodLength: cycleData.periodLength || 5,
    });
    if(cycleData.lastPeriod) setEditing(false);
  },[cycleData.lastPeriod,cycleData.cycleLength,cycleData.periodLength, JSON.stringify(cycleData.history || [])]);

  const save=()=>{
    const savedHistory = normalizeCycleHistory({ ...form, lastPeriod: form.lastPeriod });
    const average = averageCycleLength(savedHistory, form.cycleLength);
    setCycleData({
      ...form,
      history: savedHistory,
      cycleLength: average,
      periodLength: parseInt(form.periodLength)||5,
    });
    setEditing(false);
  };
  const beginMenstruation = () => {
    const today = todayKey();
    const nextHistory = normalizeCycleHistory({ history, lastPeriod: today });
    setCycleData((current) => ({
      ...current,
      lastPeriod: today,
      history: nextHistory,
      cycleLength: averageCycleLength(nextHistory, current.cycleLength),
      periodLength: parseInt(current.periodLength) || 5,
    }));
    setEditing(false);
  };

  if(editing||!info) return (
    <div>
      <div style={{background:`linear-gradient(135deg,${C.blush}12,${C.card})`,border:`1px solid ${C.border}`,borderRadius:18,padding:"22px 18px",marginBottom:20}}>
        <p style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:16,color:C.textMid,marginBottom:0}}>{!cycleData.lastPeriod?"let's set up your cycle":"update your cycle"}</p>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        <div><label style={lbl}>first day of last period</label><input type="date" value={form.lastPeriod} onChange={e=>setForm(f=>({...f,lastPeriod:e.target.value}))} style={inp}/></div>
        <div><label style={lbl}>cycle length (days)</label><input type="text" inputMode="numeric" pattern="[0-9]*" value={form.cycleLength} onChange={e=>setForm(f=>({...f,cycleLength:e.target.value}))} style={inp}/></div>
        <div><label style={lbl}>period length (days)</label><input type="text" inputMode="numeric" pattern="[0-9]*" value={form.periodLength} onChange={e=>setForm(f=>({...f,periodLength:e.target.value}))} style={inp}/></div>
        {history.length > 0 && (
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"12px 14px"}}>
            <span style={lbl}>period history</span>
            <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:15,color:C.textMid,lineHeight:1.6,margin:"6px 0 0"}}>
              {history.slice(-5).reverse().join(" · ")}
            </p>
          </div>
        )}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <button onClick={beginMenstruation} style={{...btn,background:C.blush}}>begin menstruation</button>
          <button onClick={save} style={btn}>save</button>
        </div>
      </div>
    </div>
  );
  const ph=PHASES[info.phase], pct=(info.dayInCycle/info.cycleLen)*100;
  return (
    <div>
      <div style={{background:`linear-gradient(135deg,${ph.color}1A,${C.card})`,border:`1px solid ${ph.color}35`,borderRadius:18,padding:"26px 22px",marginBottom:18,textAlign:"center"}}>
        <div style={{fontSize:42,marginBottom:6}}>{ph.moon}</div>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:30,fontWeight:300,color:ph.color,letterSpacing:"0.05em",marginBottom:4}}>{ph.label}</div>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:13,color:C.textMid,letterSpacing:"0.1em",marginBottom:16}}>{ph.tagline}</div>
        <p style={{fontFamily:"'Outfit',sans-serif",fontSize:13,color:C.textMid,lineHeight:1.75,margin:0}}>{ph.body}</p>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:18}}>
        {[{label:"cycle day",val:`${info.dayInCycle}`},{label:"next period",val:`${info.daysLeft}d`},{label:info.inFertile?"fertile ✦":"ovulation in",val:info.inFertile?"now":`${info.daysToOv}d`}].map(s=>(
          <div key={s.label} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px 8px",textAlign:"center"}}>
            <div style={{fontFamily:"'Outfit',sans-serif",fontSize:20,color:C.text,fontWeight:500}}>{s.val}</div>
            <div style={{fontFamily:"'Outfit',sans-serif",fontSize:10,color:C.textDim,marginTop:3,letterSpacing:"0.06em"}}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{marginBottom:18}}>
        <div style={{height:6,background:C.border,borderRadius:4,overflow:"hidden"}}>
          <div style={{height:"100%",width:`${pct}%`,background:`linear-gradient(90deg,${C.blush},${C.gold},${C.sage},${C.accent})`,borderRadius:4}}/>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:5,fontFamily:"'Outfit',sans-serif",fontSize:10,color:C.textDim}}>
          <span>menstrual</span><span>follicular</span><span>ovulation</span><span>luteal</span>
        </div>
      </div>
      {info.inFertile&&<div style={{background:`${C.sage}14`,border:`1px solid ${C.sage}30`,borderRadius:12,padding:"12px 16px",marginBottom:14,fontFamily:"'Outfit',sans-serif",fontSize:13,color:C.sage}}>🌿 fertile window — cycle days {info.fertStart}–{info.fertEnd}</div>}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"12px 16px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        <div>
          <span style={{fontFamily:"'Outfit',sans-serif",fontSize:10,color:C.textDim,letterSpacing:"0.08em",textTransform:"uppercase"}}>predicted ovulation</span>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:16,color:C.sage,marginTop:3}}>{info.nextOvulation}</div>
        </div>
        <div>
          <span style={{fontFamily:"'Outfit',sans-serif",fontSize:10,color:C.textDim,letterSpacing:"0.08em",textTransform:"uppercase"}}>average cycle</span>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:16,color:C.gold,marginTop:3}}>{info.avgCycleLen} days</div>
        </div>
      </div>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"12px 16px",display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
        <span style={{fontSize:16}}>⚡</span>
        <div>
          <span style={{fontFamily:"'Outfit',sans-serif",fontSize:11,color:C.textDim,letterSpacing:"0.08em",textTransform:"uppercase"}}>energy mode</span>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:16,color:ph.color,marginTop:1}}>{ph.energy}</div>
        </div>
      </div>
      {history.length > 1 && (
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"12px 16px",marginBottom:14}}>
          <span style={{fontFamily:"'Outfit',sans-serif",fontSize:10,color:C.textDim,letterSpacing:"0.08em",textTransform:"uppercase"}}>recent period starts</span>
          <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:15,color:C.textMid,lineHeight:1.6,margin:"6px 0 0"}}>
            {history.slice(-5).reverse().join(" · ")}
          </p>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <button onClick={beginMenstruation} style={{...btn,width:"100%",background:C.blush}}>begin menstruation</button>
        <button onClick={()=>setEditing(true)} style={{...ghst,width:"100%"}}>edit cycle info</button>
      </div>
    </div>
  );
}

// ── SCHEDULE ──────────────────────────────────────────────────────────────
function ScheduleTab({ events, setEvents, wide = false }) {
  const today = toDateInputValue(new Date());
  const todayStart = startOfLocalDay();
  const sortedEvents = sortSchedule(events);
  const [selectedDate, setSelectedDate] = useState(today);
  const [viewDate, setViewDate] = useState(() => {
    const seed = sortedEvents[0]?.date ? new Date(`${sortedEvents[0].date}T00:00:00`) : new Date();
    return new Date(seed.getFullYear(), seed.getMonth(), 1);
  });
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    title: "",
    date: today,
    time: "",
    category: "personal",
    notes: "",
  });

  useEffect(() => {
    if (!selectedDate) return;
    const next = new Date(`${selectedDate}T00:00:00`);
    if (!Number.isNaN(next.getTime())) {
      setViewDate(new Date(next.getFullYear(), next.getMonth(), 1));
      setForm((current) => ({ ...current, date: current.date || selectedDate }));
    }
  }, [selectedDate]);

  const monthStart = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());

  const days = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    const key = toDateInputValue(day);
    const dayEvents = sortedEvents.filter((event) => event.date === key);
    return { day, key, dayEvents };
  });

  const selectedEvents = sortedEvents.filter((event) => event.date === selectedDate);
  const monthEvents = sortedEvents.filter((event) => {
    const date = new Date(`${event.date}T00:00:00`);
    return !Number.isNaN(date.getTime()) && isSameMonth(date, viewDate);
  });

  const countsByMonth = Array.from({ length: 12 }, (_, month) => {
    const count = sortedEvents.filter((event) => {
      const date = new Date(`${event.date}T00:00:00`);
      return (
        !Number.isNaN(date.getTime()) &&
        date.getFullYear() === viewDate.getFullYear() &&
        date.getMonth() === month
      );
    }).length;

    return {
      month,
      label: new Date(viewDate.getFullYear(), month, 1).toLocaleDateString("en-US", { month: "short" }),
      count,
    };
  });

  const upcoming = sortedEvents
    .filter((event) => {
      const eventDate = parseScheduleDate(event.date);
      return eventDate && eventDate >= todayStart;
    })
    .slice(0, 5);

  const addEvent = () => {
    if (!form.title.trim() || !form.date) return;
    setEvents((current) =>
      sortSchedule([
        ...current,
        {
          id: `sc${Date.now()}`,
          title: form.title.trim(),
          date: form.date,
          time: form.time,
          category: form.category,
          notes: form.notes.trim(),
        },
      ])
    );
    setSelectedDate(form.date);
    setShowAdd(false);
    setForm((current) => ({ ...current, title: "", time: "", notes: "" }));
  };

  const removeEvent = (id) => setEvents((current) => current.filter((event) => event.id !== id));

  const panelStyle = {
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: 18,
    padding: wide ? "20px" : "18px",
  };

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div
        style={{
          ...panelStyle,
          display: "grid",
          gridTemplateColumns: wide ? "minmax(0, 1.5fr) minmax(300px, 0.9fr)" : "1fr",
          gap: 18,
        }}
      >
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
            <div>
              <span style={sec}>schedule</span>
              <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: wide ? 22 : 18, color: C.text, lineHeight: 1, fontWeight:500 }}>
                {fmtMonthYear(viewDate)}
              </div>
              <p style={{ fontFamily: "'Outfit',sans-serif", fontSize: 12, color: C.textDim, margin: "10px 0 0" }}>
                {monthEvents.length} event{monthEvents.length === 1 ? "" : "s"} planned this month
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} style={ghst}>prev</button>
              <button onClick={() => { const now = new Date(); setSelectedDate(toDateInputValue(now)); setViewDate(new Date(now.getFullYear(), now.getMonth(), 1)); }} style={ghst}>today</button>
              <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} style={ghst}>next</button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 8, marginBottom: 10 }}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
              <div key={label} style={{ fontFamily: "'Outfit',sans-serif", fontSize: 11, color: C.textDim, textAlign: "center", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {label}
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 8 }}>
            {days.map(({ day, key, dayEvents }) => {
              const inMonth = day.getMonth() === viewDate.getMonth();
              const isSelected = key === selectedDate;
              const isToday = key === today;
              return (
                <button
                  key={key}
                  onClick={() => {
                    setSelectedDate(key);
                    setForm((current) => ({ ...current, date: key }));
                  }}
                  style={{
                    minHeight: wide ? 108 : 86,
                    borderRadius: 16,
                    border: `1px solid ${isSelected ? C.accent : isToday ? C.gold : C.border}`,
                    background: isSelected ? `${C.accent}16` : C.surface,
                    color: inMonth ? C.text : C.textDim,
                    padding: "10px 8px",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span style={{ fontFamily: "'Outfit',sans-serif", fontSize: 13 }}>{day.getDate()}</span>
                    {dayEvents.length > 0 && (
                      <span style={{ minWidth: 20, height: 20, borderRadius: 999, background: `${C.teal}1f`, color: C.teal, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>
                        {dayEvents.length}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "grid", gap: 5 }}>
                    {dayEvents.slice(0, wide ? 3 : 2).map((event) => (
                      <div key={event.id} style={{ fontFamily: "'Outfit',sans-serif", fontSize: 11, color: C.textMid, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {event.time ? `${event.time} · ` : ""}{event.title}
                      </div>
                    ))}
                    {dayEvents.length > (wide ? 3 : 2) && (
                      <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: 11, color: C.textDim }}>
                        +{dayEvents.length - (wide ? 3 : 2)} more
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <div style={{ ...panelStyle, padding: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <div>
                <span style={lbl}>selected day</span>
                <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: 16, color: C.text, fontWeight:500 }}>
                  {fmtWeekday(selectedDate)}
                </div>
                <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: 12, color: C.textDim }}>
                  {fmtShort(selectedDate)}
                </div>
              </div>
              <button onClick={() => { setShowAdd((current) => !current); setForm((current) => ({ ...current, date: selectedDate })); }} style={{ ...btn, padding: "10px 14px" }}>
                {showAdd ? "close" : "add event"}
              </button>
            </div>

            {showAdd && (
              <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
                <input
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="event title"
                  style={inp}
                />
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 112px", gap: 10 }}>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
                    style={inp}
                  />
                  <input
                    type="time"
                    value={form.time}
                    onChange={(event) => setForm((current) => ({ ...current, time: event.target.value }))}
                    style={inp}
                  />
                </div>
                <select
                  value={form.category}
                  onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                  style={inp}
                >
                  <option value="personal">personal</option>
                  <option value="work">work</option>
                  <option value="health">health</option>
                  <option value="finance">finance</option>
                </select>
                <textarea
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="notes"
                  rows={3}
                  style={{ ...inp, resize: "vertical" }}
                />
                <button onClick={addEvent} style={btn}>save event</button>
              </div>
            )}

            <div style={{ display: "grid", gap: 10 }}>
              {selectedEvents.length === 0 && (
                <p style={{ fontFamily: "'Cormorant Garamond',serif", fontStyle: "italic", fontSize: 15, color: C.textDim, margin: 0 }}>
                  nothing scheduled for this day yet
                </p>
              )}
              {selectedEvents.map((event) => (
                <div key={event.id} style={{ border: `1px solid ${C.border}`, borderRadius: 14, padding: "12px 14px", background: C.surface }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: 14, color: C.text }}>{event.title}</div>
                      <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: 11, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 4 }}>
                        {event.category}{event.time ? ` · ${event.time}` : ""}
                      </div>
                    </div>
                    <button onClick={() => removeEvent(event.id)} style={{ background: "none", border: "none", color: C.textDim, cursor: "pointer", fontSize: 12, padding: 0 }}>
                      remove
                    </button>
                  </div>
                  {event.notes && (
                    <p style={{ fontFamily: "'Outfit',sans-serif", fontSize: 13, color: C.textMid, lineHeight: 1.6, margin: "10px 0 0", whiteSpace: "pre-wrap" }}>
                      {event.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div style={{ ...panelStyle, padding: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={lbl}>year view</span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button onClick={() => setViewDate(new Date(viewDate.getFullYear() - 1, viewDate.getMonth(), 1))} style={ghst}>-1y</button>
                <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: 18, color: C.text, fontWeight:500 }}>{viewDate.getFullYear()}</div>
                <button onClick={() => setViewDate(new Date(viewDate.getFullYear() + 1, viewDate.getMonth(), 1))} style={ghst}>+1y</button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
              {countsByMonth.map((month) => {
                const active = month.month === viewDate.getMonth();
                return (
                  <button
                    key={month.month}
                    onClick={() => setViewDate(new Date(viewDate.getFullYear(), month.month, 1))}
                    style={{
                      background: active ? `${C.gold}16` : C.surface,
                      border: `1px solid ${active ? C.gold : C.border}`,
                      borderRadius: 14,
                      padding: "10px 8px",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: 12, color: active ? C.gold : C.text }}>{month.label}</div>
                    <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: 10, color: C.textDim, marginTop: 4 }}>{month.count} planned</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ ...panelStyle, padding: "16px" }}>
            <span style={lbl}>up next</span>
            <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
              {upcoming.length === 0 && (
                <p style={{ fontFamily: "'Outfit',sans-serif", fontStyle: "italic", fontSize: 13, color: C.textDim, margin: 0 }}>
                  your future calendar is open
                </p>
              )}
              {upcoming.map((event) => (
                <button
                  key={event.id}
                  onClick={() => setSelectedDate(event.date)}
                  style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "12px 14px", textAlign: "left", cursor: "pointer" }}
                >
                  <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: 13, color: C.text }}>{event.title}</div>
                  <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: 11, color: C.textDim, marginTop: 4 }}>
                    {fmtWeekday(event.date)}, {fmtShort(event.date)}{event.time ? ` · ${event.time}` : ""}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── AFFIRMATIONS ──────────────────────────────────────────────────────────
const FALLBACK_AFFIRMATIONS = [
  "You are capable of achieving great things.",
  "Every day is a new opportunity to grow.",
  "You have the strength to overcome any challenge.",
  "Your potential is limitless.",
  "You are worthy of love and belonging.",
  "Small steps forward still move you forward.",
  "You are enough, exactly as you are.",
  "Your hard work is paying off, even when you can't see it.",
  "You have everything you need within you.",
  "Today, I choose to be the best version of myself.",
  "Progress, not perfection.",
  "You are becoming who you are meant to be.",
];

function AffirmationsTab({ saved, setSaved }) {
  const [affirmation, setAffirmation] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchAffirmation = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("https://www.affirmations.dev/");
      const data = await r.json();
      setAffirmation(data.affirmation || "");
    } catch {
      setAffirmation(FALLBACK_AFFIRMATIONS[Math.floor(Math.random() * FALLBACK_AFFIRMATIONS.length)]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAffirmation(); }, [fetchAffirmation]);

  const save = () => {
    if (!affirmation || saved.includes(affirmation)) return;
    setSaved(p => [affirmation, ...p]);
  };
  const removeSaved = text => setSaved(p => p.filter(a => a !== text));

  return (
    <div>
      <div style={{background:`linear-gradient(135deg,${C.gold}12,${C.card})`,border:`1px solid ${C.gold}30`,borderRadius:18,padding:"32px 22px",marginBottom:22,textAlign:"center",minHeight:140,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
        {loading ? (
          <p style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:18,color:C.textDim,margin:0}}>…</p>
        ) : (
          <>
            <p style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:22,color:C.text,lineHeight:1.65,margin:"0 0 22px",maxWidth:460}}>{affirmation}</p>
            <div style={{display:"flex",justifyContent:"center",gap:10,flexWrap:"wrap"}}>
              <button onClick={fetchAffirmation} style={btn}>new affirmation</button>
              <button onClick={save} style={ghst}>save ✦</button>
            </div>
          </>
        )}
      </div>

      {saved.length > 0 && (
        <>
          <span style={sec}>saved</span>
          {saved.map((text, i) => (
            <div key={i} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px 16px",marginBottom:10,display:"flex",gap:12,alignItems:"flex-start"}}>
              <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:16,color:C.textMid,lineHeight:1.65,margin:0,flex:1}}>{text}</p>
              <button onClick={() => removeSaved(text)} style={{background:"none",border:"none",color:C.textDim,cursor:"pointer",fontSize:12,padding:0,flexShrink:0}}>✕</button>
            </div>
          ))}
        </>
      )}
      {saved.length === 0 && !loading && (
        <p style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:14,color:C.textDim,textAlign:"center",marginTop:16}}>save the ones that resonate</p>
      )}
    </div>
  );
}

// ── READERS ───────────────────────────────────────────────────────────────
function ReadersTab({ books, setBooks }) {
  const [sub, setSub] = useState("reading");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title:"", author:"", notes:"", emoji:"📖" });
  const BOOK_EMOJIS = ["📖","📚","📕","📗","📘","📙","🔖","📝","✨","🌿"];

  const SUBS = [
    { id:"reading",   label:"reading"   },
    { id:"completed", label:"completed" },
  ];

  const displayed = books.filter(b => sub === "reading" ? b.status !== "completed" : b.status === "completed");

  const add = () => {
    if (!form.title.trim()) return;
    setBooks(p => [...p, { id:`bk${Date.now()}`, ...form, title:form.title.trim(), author:form.author.trim(), status: sub }]);
    setForm({ title:"", author:"", notes:"", emoji:"📖" });
    setShowAdd(false);
  };
  const remove = id => setBooks(p => p.filter(b => b.id !== id));
  const moveTo  = (id, status) => setBooks(p => p.map(b => b.id === id ? {...b, status} : b));

  const MOVE_LABELS = {
    reading:   [{ to:"completed", label:"✓ done" }],
    completed: [{ to:"reading",   label:"→ reading"   }],
  };

  const emptyMsg = { reading:"what are you reading right now?", completed:"your finished reads will live here" };

  return (
    <div>
      <div style={{ display:"flex", gap:6, marginBottom:22 }}>
        {SUBS.map(s => (
          <button key={s.id} onClick={() => { setSub(s.id); setShowAdd(false); }}
            style={{ ...ghst, borderColor: sub===s.id ? C.accent : C.borderMid, color: sub===s.id ? C.accent : C.textDim, flex:1, padding:"9px 6px" }}>
            {s.label}
          </button>
        ))}
      </div>

      {displayed.map(b => (
        <div key={b.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:"14px 16px", marginBottom:10 }}>
          <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
            <span style={{ fontSize:22, flexShrink:0 }}>{b.emoji}</span>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontFamily:"'Outfit',sans-serif", fontSize:14, color:C.text, fontWeight:500 }}>{b.title}</div>
              {b.author && <div style={{ fontFamily:"'Outfit',sans-serif", fontSize:12, color:C.textDim, marginTop:2 }}>{b.author}</div>}
              {b.notes && <p style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:15, color:C.textMid, lineHeight:1.6, margin:"8px 0 0", whiteSpace:"pre-wrap" }}>{b.notes}</p>}
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:6, flexShrink:0, alignItems:"flex-end" }}>
              {MOVE_LABELS[sub]?.map(m => (
                <button key={m.to} onClick={() => moveTo(b.id, m.to)} style={{ ...ghst, padding:"4px 10px", fontSize:11 }}>{m.label}</button>
              ))}
              <button onClick={() => remove(b.id)} style={{ background:"none", border:"none", color:C.textDim, cursor:"pointer", fontSize:12, padding:0 }}>remove</button>
            </div>
          </div>
        </div>
      ))}

      {showAdd ? (
        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:"18px", marginTop:4 }}>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:14 }}>
            {BOOK_EMOJIS.map(e => (
              <button key={e} onClick={() => setForm(f => ({...f,emoji:e}))}
                style={{ background:form.emoji===e?`${C.sage}30`:"none", border:`1px solid ${form.emoji===e?C.sage:C.borderMid}`, borderRadius:8, padding:"6px 8px", cursor:"pointer", fontSize:18 }}>{e}</button>
            ))}
          </div>
          <input value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} placeholder="book title" style={{...inp, marginBottom:10}} autoFocus/>
          <input value={form.author} onChange={e => setForm(f=>({...f,author:e.target.value}))} placeholder="author" style={{...inp, marginBottom:10}} onKeyDown={e=>e.key==="Enter"&&add()}/>
          <textarea value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))} placeholder="notes..." rows={3} style={{...inp,resize:"none",lineHeight:1.7,fontFamily:"'Cormorant Garamond',serif",fontSize:15}}/>
          <div style={{ display:"flex", gap:8, marginTop:12 }}>
            <button onClick={add} style={btn}>save</button>
            <button onClick={() => setShowAdd(false)} style={ghst}>cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowAdd(true)} style={dash}>+ add book</button>
      )}

      {displayed.length === 0 && !showAdd && (
        <p style={{ fontFamily:"'Cormorant Garamond',serif", fontStyle:"italic", fontSize:14, color:C.textDim, textAlign:"center", marginTop:20 }}>
          {emptyMsg[sub]}
        </p>
      )}
    </div>
  );
}

// ── ROOT ──────────────────────────────────────────────────────────────────
function TabPanel({ active, children }) {
  return (
    <div style={{ display: active ? "block" : "none" }}>
      {children}
    </div>
  );
}

function TabIcon({id,color}){
  const s={stroke:color,strokeWidth:1.5,fill:"none",strokeLinecap:"round",strokeLinejoin:"round"};
  const icons={
    breathe: <><path d="M3 7q3-2 6 0q3 2 6 0" {...s}/><path d="M3 11q3-2 6 0q3 2 6 0" {...s}/></>,
    today:   <><circle cx="9" cy="9" r="3.5" {...s}/><path d="M9 2v2M9 14v2M2 9h2M14 9h2" {...s}/></>,
    focus:   <><circle cx="9" cy="9" r="6" {...s}/><circle cx="9" cy="9" r="2.5" {...s}/></>,
    journal: <><path d="M3 5c2-1 4-1 6 0v9c-2-1-4-1-6 0z" {...s}/><path d="M15 5c-2-1-4-1-6 0v9c2-1 4-1 6 0z" {...s}/></>,
    schedule:<><circle cx="9" cy="9" r="6" {...s}/><path d="M9 5.5V9l2.5 2.5" {...s}/></>,
    notes:   <><path d="M4 3h7l3 3v9H4z" {...s}/><path d="M11 3v3h3" {...s}/><path d="M7 9h4M7 12h3" {...s}/></>,
    grocery: <><path d="M5.5 7h7l-1.5 7.5h-4z" {...s}/><path d="M7 7C7 5.2 7.8 3.5 9 3.5S11 5.2 11 7" {...s}/></>,
    readers: <><path d="M3 4.5C5 3.5 7 3.5 9 4.5v10C7 13.5 5 13.5 3 14.5z" {...s}/><path d="M15 4.5C13 3.5 11 3.5 9 4.5v10c2-1 4-1 6 0z" {...s}/></>,
    goals:   <><path d="M9 2l1.8 5.2H17l-4.4 3.2 1.7 5.1L9 12.6l-5.3 2.9 1.7-5.1L1 7.2h6.2z" {...s}/></>,
    quotes:  <><path d="M5 10V7.5C5 6 6 5 7.5 5" {...s}/><path d="M5 10h2.5" {...s}/><path d="M11 10V7.5C11 6 12 5 13.5 5" {...s}/><path d="M11 10h2.5" {...s}/></>,
    cycle:   <><path d="M14.5 9a5.5 5.5 0 1 1-5.5-5.5" {...s}/><path d="M9 1.5v4l3-2" {...s}/></>,
  };
  return <svg width="18" height="18" viewBox="0 0 18 18">{icons[id]??<circle cx="9" cy="9" r="4" {...s}/>}</svg>;
}

const TABS = [
  {id:"breathe", label:"breathe" },
  {id:"today",   label:"today"   },
  {id:"focus",   label:"focus"   },
  {id:"journal", label:"gratitude"},
  {id:"schedule",label:"schedule" },
  {id:"notes",   label:"notes"   },
  {id:"grocery", label:"grocery" },
  {id:"readers", label:"readers" },
  {id:"goals",   label:"dreams"  },
  {id:"quotes",  label:"quotes"  },
  {id:"cycle",   label:"cycle"   },
];

function LoginScreen({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('landing');
  const [pendingAuth, setPendingAuth] = useState(null);

  const submit = async (e) => {
    if (e) e.preventDefault();
    if (!email || !password) return setError('enter email and password');
    setLoading(true); setError('');
    const res = mode === 'login' ? await api.login(email, password) : await api.signup(email, password);
    setLoading(false);
    if (res.error) return setError(res.error);
    localStorage.setItem('token', res.token);
    localStorage.setItem('email', email);
    if (mode === 'signup') {
      setPendingAuth({ token: res.token, email });
      setStep('gender');
    } else {
      onAuth(res.token, email);
    }
  };

  const selectGender = (g) => {
    localStorage.setItem('gender', g);
    onAuth(pendingAuth.token, pendingAuth.email);
  };

  const inputStyle = { width:'100%', background:C.card, border:`1px solid ${C.borderMid}`, borderRadius:10, padding:'12px 14px', color:C.text, fontFamily:"'Outfit',sans-serif", fontSize:14, outline:'none', boxSizing:'border-box' };

  if (step === 'landing') return (
    <div style={{ minHeight:'100vh', background:C.bg, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'32px 24px' }}>
      <div style={{ width:'100%', maxWidth:460 }}>
        <div style={{ textAlign:'center', marginBottom:48 }}>
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontStyle:'italic', fontSize:56, fontWeight:300, color:C.text, lineHeight:1, marginBottom:12 }}>Held</div>
          <p style={{ fontFamily:"'Outfit',sans-serif", fontSize:14, color:C.textMid, letterSpacing:'0.08em', margin:0 }}>a quiet place to show up for yourself, daily.</p>
        </div>
        <div style={{ display:'grid', gap:12, marginBottom:48 }}>
          {[
            { icon:'◎', title:'daily anchors', desc:'morning and evening rituals to hold your rhythm' },
            { icon:'⊙', title:'focus sessions',  desc:'timed deep work with 432 hz ambient music' },
            { icon:'✦', title:'gratitude journal', desc:'daily entries archived by month, always yours' },
            { icon:'◑', title:'cycle & wellness', desc:'track your rhythm and understand your body' },
          ].map(({icon,title,desc}) => (
            <div key={title} style={{ display:'flex', alignItems:'flex-start', gap:16, background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:'16px 18px' }}>
              <span style={{ fontSize:16, color:C.accent, marginTop:2, flexShrink:0 }}>{icon}</span>
              <div>
                <div style={{ fontFamily:"'Outfit',sans-serif", fontSize:13, fontWeight:500, color:C.text, marginBottom:3, letterSpacing:'0.02em' }}>{title}</div>
                <div style={{ fontFamily:"'Outfit',sans-serif", fontSize:12, color:C.textDim, lineHeight:1.5 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <button onClick={() => { setMode('signup'); setStep('form'); }} style={{ ...btn, width:'100%', padding:'14px', fontSize:14 }}>create account</button>
          <button onClick={() => { setMode('login'); setStep('form'); }} style={{ background:'none', border:`1px solid ${C.borderMid}`, borderRadius:10, padding:'14px', color:C.textMid, fontFamily:"'Outfit',sans-serif", fontSize:14, cursor:'pointer', width:'100%' }}>log in</button>
        </div>
      </div>
    </div>
  );

  if (step === 'gender') return (
    <div style={{ minHeight:'100vh', background:C.bg, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ width:'100%', maxWidth:430, background:C.surface, border:`1px solid ${C.border}`, borderRadius:24, padding:'32px 28px', boxShadow:'0 28px 80px rgba(0,0,0,0.32)', textAlign:'center' }}>
        <div style={{ fontFamily:"'Cormorant Garamond',serif", fontStyle:'italic', fontSize:36, fontWeight:300, color:C.text, marginBottom:8 }}>Held</div>
        <div style={{ fontFamily:"'Outfit',sans-serif", fontSize:12, color:C.textDim, letterSpacing:'0.1em', marginBottom:32 }}>one more thing</div>
        <p style={{ fontFamily:"'Outfit',sans-serif", fontSize:14, color:C.textMid, marginBottom:28, lineHeight:1.6 }}>how do you identify? this helps us tailor your experience.</p>
        <div style={{ display:'flex', gap:12 }}>
          {['female','male'].map(g => (
            <button key={g} onClick={() => selectGender(g)} style={{ flex:1, padding:'14px', borderRadius:12, border:`1px solid ${C.borderMid}`, background:'none', color:C.text, fontFamily:"'Outfit',sans-serif", fontSize:14, cursor:'pointer', letterSpacing:'0.04em' }}>{g}</button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:C.bg, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ width:'100%', maxWidth:430, background:C.surface, border:`1px solid ${C.border}`, borderRadius:24, padding:'32px 28px', boxShadow:'0 28px 80px rgba(0,0,0,0.32)' }}>
        <button onClick={() => setStep('landing')} style={{ background:'none', border:'none', color:C.textDim, fontFamily:"'Outfit',sans-serif", fontSize:12, cursor:'pointer', padding:0, marginBottom:20, display:'block' }}>← back</button>
        <div style={{ fontFamily:"'Cormorant Garamond',serif", fontStyle:'italic', fontSize:36, fontWeight:300, color:C.text, textAlign:'center', marginBottom:8 }}>Held</div>
        <div style={{ fontFamily:"'Outfit',sans-serif", fontSize:12, color:C.textDim, textAlign:'center', letterSpacing:'0.1em', marginBottom:40 }}>daily anchor app</div>
        <div style={{ display:'flex', gap:8, marginBottom:24 }}>
          {['login','signup'].map(m => (
            <button key={m} type="button" onClick={() => setMode(m)} style={{ flex:1, padding:'10px', borderRadius:10, border:`1px solid ${mode===m ? C.accent : C.borderMid}`, background:'none', color: mode===m ? C.accent : C.textDim, fontFamily:"'Outfit',sans-serif", fontSize:13, cursor:'pointer' }}>{m}</button>
          ))}
        </div>
        <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <input
            name="email" type="email" autoComplete="email"
            value={email} onChange={e => setEmail(e.target.value)} placeholder="email"
            style={inputStyle} />
          <input
            name="password" type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password} onChange={e => setPassword(e.target.value)} placeholder="password"
            style={inputStyle} />
          {error && <p style={{ color:C.blush, fontFamily:"'Outfit',sans-serif", fontSize:12, margin:0 }}>{error}</p>}
          <button type="submit" disabled={loading}
            style={{ background:C.accent, border:'none', borderRadius:10, padding:'13px', color:'#fff', fontFamily:"'Outfit',sans-serif", fontSize:14, fontWeight:500, cursor:'pointer', marginTop:4 }}>
            {loading ? '...' : mode === 'login' ? 'log in' : 'create account'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const viewportWidth = useViewportWidth();
  const isDesktop = viewportWidth >= 768;
  const isWideContent = viewportWidth >= 1280;
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [gender, setGender] = useState(() => localStorage.getItem('gender') || '');
  const [userEmail, setUserEmail] = useState(() => {
    const saved = localStorage.getItem('email');
    return saved && saved !== "undefined" ? saved : "";
  });
  const [tab,setTab]               = useState(() => {
    const savedTab = localStorage.getItem('tab') || "today";
    return savedTab === "recipes" ? "today" : savedTab;
  });
  const [anchors,setAnchors]       = useState(DEFAULT_ANCHORS);
  const [anchorDone,setAnchorDone] = useState([]);
  const [focusTasks,setFocusTasks] = useState(DEFAULT_FOCUS);
  const [focusDone,setFocusDone]   = useState([]);
  const [isDark, setIsDark]         = useState(true);
  const [music, setMusic]           = useState(false);
  const audioRef                    = useRef(null);
  const [grocery,setGrocery]       = useState([]);
  const [books,setBooks]           = useState([]);
  const [savedAffirms,setSavedAffirms] = useState([]);
  const [sidebarQuote, setSidebarQuote] = useState("");
  const [journal,setJournal]       = useState([]);
  const [notes,setNotes]           = useState([]);
  const [goals,setGoals]           = useState([]);
  const [quotes,setQuotes]         = useState([]);
  const [schedule,setSchedule]     = useState([]);
  const [cycleData,setCycleData]   = useState({lastPeriod:"",cycleLength:28,periodLength:5});
  const [loaded,setLoaded]         = useState(false);
  const tk = todayKey();

  useEffect(()=>{
    const l=document.createElement("link");
    l.rel="stylesheet";
    l.href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&family=Outfit:wght@300;400;500;600&display=swap";
    document.head.appendChild(l);
    document.body.style.margin="0";
    document.body.style.background=DARK_THEME.bg;
    // fetch daily affirmation — renews once per day, cached in localStorage
    const today = todayKey();
    const cached = localStorage.getItem("affirm-quote");
    const cachedDate = localStorage.getItem("affirm-date");
    if (cached && cachedDate === today) {
      setSidebarQuote(cached);
    } else {
      fetch("https://www.affirmations.dev/")
        .then(r=>r.json())
        .then(d=>{
          const q = d.affirmation || FALLBACK_AFFIRMATIONS[Math.floor(Math.random()*FALLBACK_AFFIRMATIONS.length)];
          localStorage.setItem("affirm-quote", q);
          localStorage.setItem("affirm-date", today);
          setSidebarQuote(q);
        })
        .catch(()=>{
          const q = FALLBACK_AFFIRMATIONS[Math.floor(Math.random()*FALLBACK_AFFIRMATIONS.length)];
          setSidebarQuote(q);
        });
    }
  },[]);

  useEffect(() => {
    const theme = isDark ? DARK_THEME : LIGHT_THEME;
    const r = document.documentElement;
    Object.entries(theme).forEach(([k,v]) => r.style.setProperty(`--${k}`,v));
    document.body.style.background = theme.bg;
  }, [isDark]);

  useEffect(() => {
    if (tab === "recipes") {
      setTab("today");
      return;
    }
    localStorage.setItem('tab', tab);
  }, [tab]);

  useEffect(() => {
  if (!token) return;
  (async () => {
    const remote = await api.load(token);
    if (remote.error) { localStorage.removeItem('token'); setToken(null); return; }
    const tk = todayKey();
    if (remote.anchors) setAnchors(remote.anchors);
    setAnchorDone(remote[`adone-${tk}`] || []);
    if (remote.focusTasks) setFocusTasks(remote.focusTasks);
    setFocusDone(remote[`fdone-${tk}`] || []);
    if (remote.grocery) setGrocery(remote.grocery);
    if (remote.books) setBooks(remote.books);
    if (remote.savedAffirms) setSavedAffirms(remote.savedAffirms);
    if (remote.journal) setJournal(remote.journal);
    if (remote.notes) setNotes(remote.notes);
    if (remote.goals) setGoals(remote.goals);
    if (remote.quotes) setQuotes(remote.quotes);
    if (remote.schedule) setSchedule(sortSchedule(remote.schedule));
    if (remote.cycle) setCycleData(remote.cycle);
    setLoaded(true);
  })();
}, [token]);

  useEffect(() => {
    if (!loaded || !token) return;
    (async () => {
      const remote = await api.load(token);
      if (remote.error) return;
      setAnchorDone(remote[`adone-${tk}`] || []);
      setFocusDone(remote[`fdone-${tk}`] || []);
    })();
  }, [tk, loaded, token]);

  useEffect(() => {
  if (!loaded || !token) return;
  const tk = todayKey();
  const data = { anchors, [`adone-${tk}`]: anchorDone, focusTasks, [`fdone-${tk}`]: focusDone, grocery, books, savedAffirms, journal, notes, goals, quotes, schedule, cycle: cycleData };
  api.save(token, data);
}, [anchors, anchorDone, focusTasks, focusDone, grocery, books, savedAffirms, journal, notes, goals, quotes, schedule, cycleData, loaded]);

  const cycleInfo = getCycleInfo(cycleData.lastPeriod,cycleData.cycleLength,cycleData.periodLength,cycleData.history);

  const toggleMusic = () => {
    if (music) {
      setMusic(false);
      if (audioRef.current) {
        const a = audioRef.current;
        const fade = () => { if(a.volume>0.01){a.volume=Math.max(0,a.volume-0.01);setTimeout(fade,50);}else a.pause(); };
        fade();
      }
    } else {
      if (!audioRef.current) {
        audioRef.current = new Audio('/Meditation.mp3');
        audioRef.current.loop = true;
      }
      const a = audioRef.current;
      a.volume = 0;
      a.play().catch(()=>{});
      setMusic(true);
      const fade = () => { if(a.volume<0.35){a.volume=Math.min(0.35,a.volume+0.005);setTimeout(fade,80);} };
      fade();
    }
  };

  useEffect(()=>{
    const pause = ()=>{ if(audioRef.current) audioRef.current.volume=0; };
    const resume = ()=>{ if(audioRef.current && music) audioRef.current.volume=0.35; };
    window.addEventListener('breathwork-start',pause);
    window.addEventListener('breathwork-stop',resume);
    return ()=>{ window.removeEventListener('breathwork-start',pause); window.removeEventListener('breathwork-stop',resume); };
  },[music]);

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('email');
    setToken(null);
  };

  if (!token) return <LoginScreen onAuth={(t, e) => { setToken(t); setUserEmail(e); setGender(localStorage.getItem('gender') || ''); }} />;
  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",justifyContent:"center",fontFamily:"'Outfit',sans-serif",padding:isDesktop ? "24px" : 0,overflowX:"hidden"}}>
      <div style={{width:"100%",maxWidth:isDesktop ? 1380 : "100%",display:isDesktop ? "grid" : "flex",flexDirection:isDesktop ? undefined : "column",gridTemplateColumns:isDesktop ? "260px minmax(0, 1fr)" : undefined,gap:isDesktop ? 24 : 0,minHeight:"100vh"}}>

        <aside style={{background:C.surface,border:isDesktop ? `1px solid ${C.border}` : "none",borderRadius:isDesktop ? 28 : 0,display:"flex",flexDirection:"column",overflow:"hidden",minHeight:isDesktop ? "calc(100vh - 48px)" : "auto",position:isDesktop ? "sticky" : "relative",top:isDesktop ? 24 : 0,alignSelf:isDesktop ? "start" : "stretch"}}>
          <div style={{padding:isDesktop ? "30px 24px 22px" : "28px 24px 16px",borderBottom:`1px solid ${C.border}`}}>
            <div style={{fontFamily:"'Outfit',sans-serif",fontSize:10,color:C.textDim,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:4}}>{fmtFull()}</div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:isDesktop ? 36 : 30,fontWeight:300,color:C.text,lineHeight:1.1}}>Held</div>
            <p style={{fontFamily:"'Outfit',sans-serif",fontSize:12,color:C.textDim,lineHeight:1.6,margin:"10px 0 0"}}>
              A single place for anchors, work, reflection, and long-range planning.
            </p>
            {sidebarQuote && (
              <p style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:14,color:C.textMid,lineHeight:1.65,margin:"14px 0 0",borderTop:`1px solid ${C.border}`,paddingTop:14}}>
                {sidebarQuote}
              </p>
            )}
          </div>

          <div style={{background:C.surface,borderBottom:isDesktop ? "none" : `1px solid ${C.border}`,display:"flex",flexDirection:isDesktop ? "column" : "row",overflowX:isDesktop ? "visible" : "auto",scrollbarWidth:"none",WebkitOverflowScrolling:"touch",padding:isDesktop ? 12 : 0}}>
            {TABS.filter(t=>t.id!=='cycle'||gender!=='male').map(t=>{
              const active=tab===t.id;
              return (
                <button key={t.id} onClick={()=>setTab(t.id)} style={{
                  background:active && isDesktop ? `${C.accent}14` : "none",
                  border:"none",
                  borderBottom:!isDesktop && active ? `2px solid ${C.accent}` : !isDesktop ? "2px solid transparent" : "none",
                  borderRadius:isDesktop ? 16 : 0,
                  padding:isDesktop ? "14px 16px" : "11px 12px 9px",
                  cursor:"pointer",
                  display:"flex",
                  flexDirection:isDesktop ? "row" : "column",
                  alignItems:"center",
                  gap:isDesktop ? 10 : 3,
                  flexShrink:0,
                  minWidth:isDesktop ? "100%" : 46,
                  textAlign:isDesktop ? "left" : "center"
                }}>
                  <TabIcon id={t.id} color={active?C.accent:C.textDim}/>
                  <span style={{fontFamily:"'Outfit',sans-serif",fontSize:isDesktop ? 11 : 9,letterSpacing:"0.07em",color:active?C.accent:C.textDim,textTransform:"uppercase",whiteSpace:"nowrap"}}>{t.label}</span>
                </button>
              );
            })}
          </div>

          {isDesktop && (
            <div style={{marginTop:"auto",padding:"14px 20px 18px",borderTop:`1px solid ${C.border}`,background:C.surface}}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
                <p style={{ fontFamily:"'Cormorant Garamond',serif", fontStyle:'italic', fontSize:12, color:C.textDim, margin:0, overflow:"hidden", textOverflow:"ellipsis", flex:1, minWidth:0 }}>{typeof userEmail === "string" ? userEmail : ""}</p>
                <button onClick={toggleMusic} style={{ background:"none", border:`1px solid ${music?C.teal:C.borderMid}`, borderRadius:8, color:music?C.teal:C.textMid, fontFamily:"'Outfit',sans-serif", fontSize:13, cursor:"pointer", padding:"4px 8px", flexShrink:0 }}>♪</button>
                <button onClick={() => setIsDark(d => !d)} style={{ background:"none", border:`1px solid ${C.borderMid}`, borderRadius:8, color:C.textMid, fontFamily:"'Outfit',sans-serif", fontSize:12, cursor:"pointer", padding:"4px 8px", flexShrink:0 }}>{isDark ? "☀" : "◑"}</button>
                <button onClick={logout} style={{ background:'none', border:'none', color:C.textDim, fontFamily:"'Outfit',sans-serif", fontSize:11, cursor:'pointer', padding:0 }}>log out</button>
              </div>
            </div>
          )}
        </aside>

        <main style={{display:"flex",flexDirection:"column",minWidth:0}}>
          <div style={{background:C.surface,border:isDesktop ? `1px solid ${C.border}` : "none",borderRadius:isDesktop ? 28 : 0,display:"flex",flexDirection:"column",minHeight:isDesktop ? "calc(100vh - 48px)" : "auto",overflow:"hidden"}}>
            <div style={{padding:isDesktop ? "30px 30px 18px" : "16px 18px 0",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:isDesktop ? 38 : 28,color:C.text,lineHeight:1}}>
                {TABS.find((item) => item.id === tab)?.label || "today"}
              </div>
              {!isDesktop && (
                <div style={{display:"flex",gap:8}}>
                  <button onClick={toggleMusic} style={{ background:"none", border:`1px solid ${music?C.teal:C.borderMid}`, borderRadius:8, color:music?C.teal:C.textMid, fontFamily:"'Outfit',sans-serif", fontSize:14, cursor:"pointer", padding:"5px 10px", flexShrink:0 }}>♪</button>
                  <button onClick={() => setIsDark(d => !d)} style={{ background:"none", border:`1px solid ${C.borderMid}`, borderRadius:8, color:C.textMid, fontFamily:"'Outfit',sans-serif", fontSize:14, cursor:"pointer", padding:"5px 10px", flexShrink:0 }}>{isDark ? "☀" : "◑"}</button>
                </div>
              )}
            </div>

            <div style={{flex:1,padding:isDesktop ? "28px 30px 34px" : "22px 18px 40px",overflowY:"auto"}}>
              <TabPanel active={tab==="today"}><TodayTab habits={anchors} doneIds={anchorDone} setDoneIds={setAnchorDone} setHabits={setAnchors}/></TabPanel>
              <TabPanel active={tab==="breathe"}><WimHofTab/></TabPanel>
              <TabPanel active={tab==="focus"}><FocusTab tasks={focusTasks} doneIds={focusDone} setDoneIds={setFocusDone} setTasks={setFocusTasks} music={music}/></TabPanel>
              <TabPanel active={tab==="journal"}><JournalTab entries={journal} setEntries={setJournal}/></TabPanel>
              <TabPanel active={tab==="schedule"}><ScheduleTab events={schedule} setEvents={setSchedule} wide={isWideContent}/></TabPanel>
              <TabPanel active={tab==="notes"}><NotesTab notes={notes} setNotes={setNotes}/></TabPanel>
              <TabPanel active={tab==="grocery"}><GroceryTab items={grocery} setItems={setGrocery}/></TabPanel>
              <TabPanel active={tab==="readers"}><ReadersTab books={books} setBooks={setBooks}/></TabPanel>
              <TabPanel active={tab==="goals"}><GoalsTab goals={goals} setGoals={setGoals}/></TabPanel>
              <TabPanel active={tab==="quotes"}><QuotesTab quotes={quotes} setQuotes={setQuotes}/></TabPanel>
              <TabPanel active={tab==="cycle"}><CycleTab cycleData={cycleData} setCycleData={setCycleData} info={cycleInfo}/></TabPanel>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
