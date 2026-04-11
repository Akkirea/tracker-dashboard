import { useState, useEffect, useRef, useCallback } from "react";

const API = 'https://your-day.up.railway.app';

// ── PALETTE ───────────────────────────────────────────────────────────────
const DARK_THEME = {
  bg:"#0D0A06", surface:"#141009", card:"#1B1510",
  border:"#272018", borderMid:"#342C1E",
  text:"#EDE6D0", textMid:"#9A8E75", textDim:"#5A5040",
};
const LIGHT_THEME = {
  bg:"#F5F0E8", surface:"#FDFAF5", card:"#EDE8DF",
  border:"#DDD5C5", borderMid:"#C5BAA5",
  text:"#2A2218", textMid:"#5A4F3A", textDim:"#9A8E75",
};
if (typeof document !== "undefined") {
  const _r = document.documentElement;
  Object.entries(DARK_THEME).forEach(([k,v]) => _r.style.setProperty(`--${k}`,v));
}
const C = {
  bg:"var(--bg)", surface:"var(--surface)", card:"var(--card)",
  border:"var(--border)", borderMid:"var(--borderMid)",
  text:"var(--text)", textMid:"var(--textMid)", textDim:"var(--textDim)",
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
const sortSchedule = (items) =>
  [...items].sort((a, b) => {
    const left = `${a.date || ""}T${a.time || "99:99"}`;
    const right = `${b.date || ""}T${b.time || "99:99"}`;
    return left.localeCompare(right);
  });

const getCycleInfo = (lastStr, cycleLen, periodLen) => {
  if (!lastStr) return null;
  const last = new Date(lastStr); last.setHours(0,0,0,0);
  const now  = new Date();        now.setHours(0,0,0,0);
  const elapsed    = Math.floor((now - last) / 86400000);
  const dayInCycle = (elapsed % cycleLen) + 1;
  const daysLeft   = cycleLen - (elapsed % cycleLen);
  const ovDay      = cycleLen - 14;
  const fertStart  = Math.max(1, ovDay - 5);
  const fertEnd    = ovDay + 1;
  const inFertile  = dayInCycle >= fertStart && dayInCycle <= fertEnd;
  const daysToOv   = Math.max(0, ovDay - dayInCycle);
  let phase;
  if (dayInCycle <= periodLen)      phase = "menstrual";
  else if (dayInCycle < ovDay - 1)  phase = "follicular";
  else if (dayInCycle <= ovDay + 2) phase = "ovulation";
  else                              phase = "luteal";
  return { dayInCycle, cycleLen, daysLeft, ovDay, phase, inFertile, daysToOv, fertStart, fertEnd };
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
  const [status, setStatus]   = useState("idle"); // idle | running | done
  const [phase, setPhase]     = useState("inhale");
  const [round, setRound]     = useState(1);
  const [breath, setBreath]   = useState(0);   // 0-29
  const [progress, setProgress] = useState(0); // 0-1
  const [holdSecs, setHoldSecs] = useState(0);
  const [holdActive, setHoldActive] = useState(false);
  const [recoveryLeft, setRecoveryLeft] = useState(15);
  const audioRef = useRef(null);
  const stateRef    = useRef({});
  const intervalRef = useRef(null);
  const clearAll = () => { clearInterval(intervalRef.current); };

  const runBreathing = useCallback((currentBreath, currentRound) => {
    stateRef.current = { breath:currentBreath, round:currentRound, cancelled:false };
    const doBreath = (b) => {
      if (stateRef.current.cancelled) return;
      if (b >= BREATHS_PER_ROUND) {
        // → empty hold
        clearAll();
        setPhase("holdEmpty");
        setHoldActive(true);
        setHoldSecs(0);
        let s = 0;
        intervalRef.current = setInterval(() => {
          if (stateRef.current.cancelled) { clearAll(); return; }
          s++;
          setHoldSecs(s);
        }, 1000);
        return;
      }
      // inhale
      setPhase("inhale");
      setBreath(b);
      setProgress(0);
      let ticks = 0;
      const INHALE_DUR = 20; // 100ms ticks × 20 = 2s
      clearAll();
      intervalRef.current = setInterval(() => {
        if (stateRef.current.cancelled) { clearAll(); return; }
        ticks++;
        setProgress(ticks / INHALE_DUR);
        if (ticks >= INHALE_DUR) {
          clearAll();
          // exhale
          setPhase("exhale");
          setProgress(0);
          let et = 0;
          intervalRef.current = setInterval(() => {
            if (stateRef.current.cancelled) { clearAll(); return; }
            et++;
            setProgress(et / INHALE_DUR);
            if (et >= INHALE_DUR) { clearAll(); doBreath(b + 1); }
          }, 100);
        }
      }, 100);
    };
    doBreath(currentBreath);
  }, []);

  const endHold = () => {
    if (!holdActive) return;
    stateRef.current.cancelled = true;
    clearAll();
    setHoldActive(false);
    const r = stateRef.current.round;
    // → recovery hold (full inhale, hold 15s)
    setPhase("holdFull");
    setProgress(0);
    let rt = 0;
    intervalRef.current = setInterval(() => {
      rt++;
      setProgress(rt / 15);
      setRecoveryLeft(15 - rt);
      if (rt >= 15) {
        clearAll();
        if (r >= TOTAL_ROUNDS) {
          setPhase("rest");
          setStatus("done");
        } else {
          setPhase("rest");
          setProgress(1);
          setTimeout(() => {
            const nextRound = r + 1;
            setRound(nextRound);
            setBreath(0);
            stateRef.current = { breath:0, round:nextRound, cancelled:false };
            runBreathing(0, nextRound);
          }, 3000);
        }
      }
    }, 1000);
  };

  const start = () => {
    setStatus("running");
    setRound(1);
    setBreath(0);
    setHoldSecs(0);
    setHoldActive(false);
    setPhase("inhale");
    setProgress(0);
    setTimeout(() => runBreathing(0, 1), 800);
  };

  const reset = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    stateRef.current.cancelled = true;
    clearAll();
    setStatus("idle");
    setPhase("inhale");
    setRound(1);
    setBreath(0);
    setProgress(0);
    setHoldSecs(0);
    setHoldActive(false);
    setRecoveryLeft(15);
  };

  useEffect(() => () => { stateRef.current.cancelled = true; clearAll(); }, []);

  const ph = WH_PHASES[phase] || WH_PHASES.inhale;

  return (
    <div>
      {/* header card — tappable during hold to release */}
      <div onClick={phase==="holdEmpty" && holdActive ? endHold : undefined}
        style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:18,padding:"20px 18px",marginBottom:20,cursor:phase==="holdEmpty"&&holdActive?"pointer":"default"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
          <span style={{fontSize:20}}>❄️</span>
          <div>
            <span style={{fontFamily:"'Outfit',sans-serif",fontSize:12,color:C.textDim,letterSpacing:"0.08em",textTransform:"uppercase"}}>wim hof method</span>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:16,color:C.text,marginTop:1}}>3 rounds · ~10 minutes</div>
          </div>
          <div style={{marginLeft:"auto",fontFamily:"'Outfit',sans-serif",fontSize:11,color:C.textDim}}>round {round}/{TOTAL_ROUNDS}</div>
        </div>

        {/* round dots */}
        <div style={{display:"flex",gap:6,marginBottom:16}}>
          {Array.from({length:TOTAL_ROUNDS}).map((_,i) => (
            <div key={i} style={{height:3,flex:1,borderRadius:2,background:i<round-1?C.ice:i===round-1&&status==="running"?`${C.ice}70`:C.border,transition:"background 0.5s"}}/>
          ))}
        </div>

        {/* circle + phase label */}
        <div style={{textAlign:"center"}}>
          {status !== "idle" && (
            <BreathCircle phase={phase} progress={progress} breathCount={breath} round={round}/>
          )}
          {status === "idle" && (
            <div style={{height:200,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <div style={{textAlign:"center"}}>
                <div style={{width:130,height:130,borderRadius:"50%",background:`radial-gradient(circle at 38% 38%, ${C.ice}30, ${C.ice}10)`,border:`1.5px solid ${C.ice}30`,margin:"0 auto 16px",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <span style={{fontSize:40}}>❄️</span>
                </div>
                <p style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:13,color:C.textDim,margin:0}}>find a comfortable position</p>
              </div>
            </div>
          )}

          {/* hold empty instructions */}
          {phase==="holdEmpty" && status==="running" && (
            <div style={{marginTop:8}}>
              <div style={{fontFamily:"'Outfit',sans-serif",fontSize:32,color:C.blush,fontWeight:300,marginBottom:6}}>{holdSecs}s</div>
              <p style={{fontFamily:"'Outfit',sans-serif",fontSize:12,color:C.textDim,margin:0}}>tap anywhere to release</p>
            </div>
          )}

          {/* recovery hold */}
          {phase==="holdFull" && (
            <div style={{marginTop:8}}>
              <div style={{fontFamily:"'Outfit',sans-serif",fontSize:32,color:C.gold,fontWeight:300}}>{recoveryLeft}s</div>
              <p style={{fontFamily:"'Outfit',sans-serif",fontSize:12,color:C.textDim,margin:"4px 0 0"}}>hold that full breath</p>
            </div>
          )}

        </div>
      </div>

      {/* controls */}
      <div style={{display:"flex",gap:8,justifyContent:"center"}}>
        {status==="idle" && <button onClick={() => {
  if (audioRef.current) {
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
  }
  audioRef.current = new Audio('/Breathing.mp3');
  audioRef.current.play();
  start();
}} style={{...btn,background:C.ice,fontSize:14,padding:"13px 40px"}}>begin session</button>}
        {status==="running" && phase!=="holdEmpty" && phase!=="holdFull" && <button onClick={reset} style={{...ghst,fontSize:13}}>end session</button>}
        {status==="done" && (
          <>
            <button onClick={reset} style={{...btn,background:C.sage,padding:"12px 28px"}}>new session</button>
          </>
        )}
      </div>

      {/* instructions */}
      {status==="idle" && (
        <div style={{marginTop:24,background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"16px"}}>
          <span style={sec}>how it works</span>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {[
              {n:"1",text:"30 deep breaths — let the circle guide you. inhale fully, exhale without force."},
              {n:"2",text:"exhale and hold your breath. tap 'release & inhale' when you're ready (or around 90s)."},
              {n:"3",text:"take one full breath in and hold for 15 seconds."},
              {n:"4",text:"that's one round. repeat 3 times total."},
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

// ── TODAY ─────────────────────────────────────────────────────────────────
function TodayTab({habits,doneIds,setDoneIds,setHabits}) {
  const [showAdd,setShowAdd] = useState(false);
  const [newVal,setNewVal]   = useState("");
  const EMOJIS = ["✨","🌱","💫","🔥","🌙","⚡","🦋","🍃","🌸","🎋"];
  const toggle = id => setDoneIds(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
  const remove = id => {setHabits(p=>p.filter(h=>h.id!==id));setDoneIds(p=>p.filter(x=>x!==id));};
  const add = () => {
    if (!newVal.trim()) return;
    setHabits(p=>[...p,{id:`a${Date.now()}`,name:newVal.trim().toLowerCase(),emoji:EMOJIS[p.length%EMOJIS.length]}]);
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
function FocusTab({tasks,doneIds,setDoneIds,setTasks}) {
  const [showAdd,setShowAdd] = useState(false);
  const [newVal,setNewVal]   = useState("");
  const [timer,setTimer]     = useState(15*60);
  const [running,setRunning] = useState(false);
  const [sessionMin,setSessionMin] = useState(15);
  const ref = useRef(null);
  const didAlertRef = useRef(false);
  const EMOJIS = ["🎯","📝","💻","🔬","📊","🗂️","✏️","🔧","🧠","📐"];
  useEffect(()=>{
    if(running){ref.current=setInterval(()=>setTimer(t=>{if(t<=1){clearInterval(ref.current);setRunning(false);didAlertRef.current = true;playCompletionBeep();return 0;}return t-1;}),1000);}
    else clearInterval(ref.current);
    return ()=>clearInterval(ref.current);
  },[running]);
  useEffect(() => {
    if (timer > 0) didAlertRef.current = false;
  }, [timer]);
  const reset = ()=>{setRunning(false);setTimer(sessionMin*60);didAlertRef.current = false;};
  const fmt = s=>`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
  const pct = ((sessionMin*60-timer)/(sessionMin*60))*100;
  const r=54, circ=2*Math.PI*r;
  const toggle = id=>setDoneIds(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
  const remove = id=>{setTasks(p=>p.filter(h=>h.id!==id));setDoneIds(p=>p.filter(x=>x!==id));};
  const add = ()=>{if(!newVal.trim())return;setTasks(p=>[...p,{id:`f${Date.now()}`,name:newVal.trim().toLowerCase(),emoji:EMOJIS[p.length%EMOJIS.length]}]);setNewVal("");setShowAdd(false);};
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
        <div style={{display:"flex",justifyContent:"center",gap:8,marginBottom:14}}>
          {[15,25,45,60].map(m=>(
            <button key={m} onClick={()=>{setSessionMin(m);setTimer(m*60);setRunning(false);}}
              style={{...ghst,padding:"6px 14px",fontSize:12,border:`1px solid ${sessionMin===m?C.teal:C.borderMid}`,color:sessionMin===m?C.teal:C.textDim}}>{m}m</button>
          ))}
        </div>
        <div style={{display:"flex",justifyContent:"center",gap:10}}>
          <button onClick={()=>setRunning(r=>!r)} style={{...btn,background:running?C.accent:C.teal,minWidth:90}}>{running?"pause":timer===sessionMin*60?"start":"resume"}</button>
          <button onClick={reset} style={ghst}>reset</button>
        </div>
      </div>
      <ProgressBar done={doneIds.length} total={tasks.length} label="focus block" color={C.teal}/>
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
      {active.map((i, index)=><GroceryRow key={i.id} item={i} onToggle={()=>toggle(i.id)} onRemove={()=>remove(i.id)}
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

// ── RECIPES ───────────────────────────────────────────────────────────────
function RecipesTab({recipes,setRecipes}) {
  const [showAdd,setShowAdd]=useState(false);
  const [form,setForm]=useState({name:"",notes:"",emoji:"🥗"});
  const [expanded,setExpanded]=useState(null);
  const EMOJIS=["🥗","🍲","🌮","🥘","🍜","🫕","🥙","🍱","🌯","🥦","🫚","🌿","🍛","🥣","🧆"];
  const add=()=>{if(!form.name.trim())return;setRecipes(p=>[...p,{id:`r${Date.now()}`,...form,name:form.name.trim()}]);setForm({name:"",notes:"",emoji:"🥗"});setShowAdd(false);};
  return (
    <div>
      <p style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:15,color:C.textMid,margin:"0 0 22px"}}>your recipes</p>
      {recipes.map(r=>(
        <div key={r.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,marginBottom:10,overflow:"hidden"}}>
          <div onClick={()=>setExpanded(e=>e===r.id?null:r.id)} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",cursor:"pointer"}}>
            <span style={{fontSize:20}}>{r.emoji}</span>
            <span style={{fontFamily:"'Outfit',sans-serif",fontSize:14,flex:1,color:C.text}}>{r.name}</span>
            <span style={{color:C.textDim,fontSize:11}}>{expanded===r.id?"▲":"▼"}</span>
          </div>
          {expanded===r.id&&(
            <div style={{padding:"14px 16px 16px",borderTop:`1px solid ${C.border}`}}>
              {r.notes&&<p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:15,color:C.textMid,lineHeight:1.75,margin:"0 0 12px",whiteSpace:"pre-wrap"}}>{r.notes}</p>}
              <button onClick={()=>setRecipes(p=>p.filter(x=>x.id!==r.id))} style={{background:"none",border:"none",color:C.textDim,fontFamily:"'Outfit',sans-serif",fontSize:12,cursor:"pointer",padding:0}}>remove recipe</button>
            </div>
          )}
        </div>
      ))}
      {showAdd?(
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"18px",marginTop:4}}>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
            {EMOJIS.map(e=>(
              <button key={e} onClick={()=>setForm(f=>({...f,emoji:e}))}
                style={{background:form.emoji===e?`${C.sage}30`:"none",border:`1px solid ${form.emoji===e?C.sage:C.borderMid}`,borderRadius:8,padding:"6px 8px",cursor:"pointer",fontSize:18}}>{e}</button>
            ))}
          </div>
          <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="recipe name" style={{...inp,marginBottom:10}}/>
          <textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="ingredients, steps, link, or notes..." rows={5} style={{...inp,resize:"none",lineHeight:1.7,fontFamily:"'Cormorant Garamond',serif",fontSize:15}}/>
          <div style={{display:"flex",gap:8,marginTop:12}}>
            <button onClick={add} style={btn}>save recipe</button>
            <button onClick={()=>setShowAdd(false)} style={ghst}>cancel</button>
          </div>
        </div>
      ):(
        <button onClick={()=>setShowAdd(true)} style={dash}>+ add recipe</button>
      )}
      {recipes.length===0&&!showAdd&&<p style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:14,color:C.textDim,textAlign:"center",marginTop:16}}>save your go-to recipes here</p>}
    </div>
  );
}

// ── JOURNAL ───────────────────────────────────────────────────────────────
function GratitudeFolder({ dateKey, entries, open, onToggle, onDelete }) {
  const folderBorder = open ? `${C.gold}88` : C.borderMid;
  const folderFill = open
    ? `linear-gradient(180deg, rgba(201,168,76,0.16) 0%, rgba(27,21,16,0.96) 72%)`
    : `linear-gradient(180deg, rgba(201,168,76,0.10) 0%, rgba(27,21,16,0.92) 78%)`;
  const closedLayer = {
    position: "absolute",
    left: 14,
    right: 14,
    height: 48,
    borderRadius: 18,
    border: `1px solid ${C.border}`,
    background: "linear-gradient(180deg, rgba(201,168,76,0.07), rgba(27,21,16,0.82))",
  };

  return (
    <div style={{marginBottom:12}}>
      <div style={{position:"relative",paddingTop:22}}>
        {!open && (
          <>
            <div style={{ ...closedLayer, top: 34, opacity: 0.55 }} />
            <div style={{ ...closedLayer, top: 28, left: 8, right: 20, opacity: 0.75 }} />
          </>
        )}
        <button
          onClick={onToggle}
          style={{
            position:"absolute",
            top:0,
            left:16,
            minWidth:138,
            maxWidth:"58%",
            background:open ? `linear-gradient(180deg, rgba(201,168,76,0.22), rgba(196,105,74,0.18))` : `linear-gradient(180deg, rgba(201,168,76,0.20), rgba(201,168,76,0.10))`,
            border:`1px solid ${folderBorder}`,
            borderBottom:"none",
            borderTopLeftRadius:18,
            borderTopRightRadius:18,
            borderBottomLeftRadius:10,
            borderBottomRightRadius:10,
            padding:"12px 16px 10px",
            cursor:"pointer",
            textAlign:"left",
            zIndex:4,
            boxShadow:open ? "0 10px 20px rgba(0,0,0,0.14)" : "none",
          }}
        >
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24,color:C.text,lineHeight:1}}>
            {fmtShort(dateKey)}
          </div>
          <div style={{fontFamily:"'Outfit',sans-serif",fontSize:10,color:C.textDim,marginTop:5,letterSpacing:"0.08em",textTransform:"uppercase"}}>
            {fmtWeekday(dateKey)}
          </div>
        </button>

        <button
          onClick={onToggle}
          style={{
            width:"100%",
            background:folderFill,
            border:`1px solid ${folderBorder}`,
            borderRadius:22,
            padding: open ? "30px 18px 16px" : "30px 18px 12px",
            cursor:"pointer",
            textAlign:"left",
            position:"relative",
            overflow:"hidden",
            minHeight: open ? 94 : 82,
            zIndex:3,
            boxShadow:open ? "0 18px 34px rgba(0,0,0,0.18)" : "0 10px 18px rgba(0,0,0,0.08)",
          }}
        >
          <div style={{position:"absolute",top:0,left:0,right:0,height:54,background:"linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0))"}} />
          <div style={{display:"flex",justifyContent:"flex-end",alignItems:"center",gap:10,position:"relative"}}>
            <div style={{fontFamily:"'Outfit',sans-serif",fontSize:11,color:C.textDim}}>
              {entries.length} filed
            </div>
            <span style={{fontSize:12,color:open ? C.gold : C.textDim}}>{open ? "▲" : "▼"}</span>
          </div>
        </button>
      </div>
      {open && (
        <div style={{background:`linear-gradient(180deg, rgba(20,16,9,0.98), rgba(27,21,16,0.96))`,border:`1px solid ${folderBorder}`,borderTop:"none",borderBottomLeftRadius:22,borderBottomRightRadius:22,padding:"14px 16px 12px",marginTop:-14,boxShadow:"0 18px 34px rgba(0,0,0,0.18)"}}>
          <div style={{display:"grid",gap:10,marginTop:10}}>
            {entries.map((entry, index) => (
              <div key={entry.id} style={{display:"flex",gap:12,alignItems:"flex-start",paddingTop:index === 0 ? 0 : 10,borderTop:index === 0 ? "none" : `1px solid ${C.border}`}}>
                <div style={{width:24,height:24,borderRadius:"50%",background:`${C.accent}20`,border:`1px solid ${C.accent}33`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <span style={{fontFamily:"'Outfit',sans-serif",fontSize:11,color:C.accent}}>{index + 1}</span>
                </div>
                <div style={{flex:1}}>
                  <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:16,color:C.text,lineHeight:1.7,margin:0,whiteSpace:"pre-wrap"}}>{entry.text}</p>
                </div>
                <button onClick={() => onDelete(entry.id)} style={{background:"none",border:"none",color:C.textDim,cursor:"pointer",fontSize:12,padding:0,flexShrink:0}}>✕</button>
              </div>
            ))}
          </div>
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
  const [openDay, setOpenDay] = useState(null);
  const todayE = groupedEntries[tk] || [];
  const archiveDays = orderedDays.filter((day) => day !== tk);
  const add=()=>{if(!text.trim())return;setEntries(p=>[{id:`j${Date.now()}`,date:toLocalIsoString(),text:text.trim()},...p]);setText("");};
  const del=id=>setEntries(p=>p.filter(e=>e.id!==id));

  useEffect(() => {
    if (!orderedDays.length) {
      setOpenDay(null);
      return;
    }
    if (openDay && !groupedEntries[openDay]) {
      setOpenDay(null);
    }
  }, [openDay, orderedDays, groupedEntries]);

  return (
    <div>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:"18px 18px 14px",marginBottom:22}}>
        <span style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:13,color:C.textDim,display:"block",marginBottom:10}}>3 things you feel grateful for today</span>
        <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="write it here..." rows={4}
          style={{width:"100%",background:"none",border:"none",borderBottom:`1px solid ${C.borderMid}`,padding:"8px 0",color:C.text,fontSize:16,fontFamily:"'Cormorant Garamond',serif",outline:"none",boxSizing:"border-box",caretColor:C.accent,resize:"none",lineHeight:1.75}}/>
        <div style={{display:"flex",justifyContent:"flex-end",marginTop:12}}>
          <button onClick={add} style={btn}>save entry</button>
        </div>
      </div>
      {todayE.length>0&&(
        <>
          <span style={sec}>today's folder</span>
          <GratitudeFolder
            dateKey={tk}
            entries={todayE}
            open={openDay === tk}
            onToggle={() => setOpenDay((current) => current === tk ? null : tk)}
            onDelete={del}
          />
        </>
      )}
      {archiveDays.length>0&&(
        <div style={{marginTop:16}}>
          <span style={sec}>archive</span>
          {archiveDays.slice(0,12).map((day) => (
            <GratitudeFolder
              key={day}
              dateKey={day}
              entries={groupedEntries[day]}
              open={openDay === day}
              onToggle={() => setOpenDay((current) => current === day ? null : day)}
              onDelete={del}
            />
          ))}
        </div>
      )}
      {entries.length===0&&<p style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:14,color:C.textDim,textAlign:"center",marginTop:20}}>your gratitude entries will live here</p>}
    </div>
  );
}

// ── NOTES ────────────────────────────────────────────────────────────────
function NotesTab({notes, setNotes}) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
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
          <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start"}}>
            <div>
              <div style={{fontFamily:"'Outfit',sans-serif",fontSize:14,color:C.text}}>{note.title}</div>
              <div style={{fontFamily:"'Outfit',sans-serif",fontSize:11,color:C.textDim,marginTop:4}}>{fmtShort(note.date)}</div>
            </div>
            <button onClick={() => remove(note.id)} style={{background:"none",border:"none",color:C.textDim,cursor:"pointer",fontSize:12,padding:0}}>remove</button>
          </div>
          {note.text && (
            <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:16,color:C.textMid,lineHeight:1.7,margin:"12px 0 0",whiteSpace:"pre-wrap"}}>
              {note.text}
            </p>
          )}
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

  // sync form when remote data loads (e.g. switching devices)
  useEffect(()=>{
    setForm(cycleData);
    if(cycleData.lastPeriod) setEditing(false);
  },[cycleData.lastPeriod,cycleData.cycleLength,cycleData.periodLength]);

  const save=()=>{
    setCycleData({
      ...form,
      cycleLength: parseInt(form.cycleLength)||28,
      periodLength: parseInt(form.periodLength)||5,
    });
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
        <button onClick={save} style={btn}>save</button>
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
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"12px 16px",display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
        <span style={{fontSize:16}}>⚡</span>
        <div>
          <span style={{fontFamily:"'Outfit',sans-serif",fontSize:11,color:C.textDim,letterSpacing:"0.08em",textTransform:"uppercase"}}>energy mode</span>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:16,color:ph.color,marginTop:1}}>{ph.energy}</div>
        </div>
      </div>
      <button onClick={()=>setEditing(true)} style={{...ghst,width:"100%"}}>edit cycle info</button>
    </div>
  );
}

// ── SCHEDULE ──────────────────────────────────────────────────────────────
function ScheduleTab({ events, setEvents, wide = false }) {
  const today = toDateInputValue(new Date());
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
    .filter((event) => event.date >= today)
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
              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: wide ? 34 : 28, color: C.text, lineHeight: 1 }}>
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
                <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, color: C.text }}>
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
                    <p style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 15, color: C.textMid, lineHeight: 1.6, margin: "10px 0 0", whiteSpace: "pre-wrap" }}>
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
                <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 26, color: C.text }}>{viewDate.getFullYear()}</div>
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
                <p style={{ fontFamily: "'Cormorant Garamond',serif", fontStyle: "italic", fontSize: 15, color: C.textDim, margin: 0 }}>
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
    { id:"upnext",    label:"up next"   },
    { id:"completed", label:"completed" },
  ];

  const displayed = books.filter(b => b.status === sub);

  const statusAfter = { reading:"upnext", upnext:"reading", completed:"reading" };

  const add = () => {
    if (!form.title.trim()) return;
    setBooks(p => [...p, { id:`bk${Date.now()}`, ...form, title:form.title.trim(), author:form.author.trim(), status: sub }]);
    setForm({ title:"", author:"", notes:"", emoji:"📖" });
    setShowAdd(false);
  };
  const remove = id => setBooks(p => p.filter(b => b.id !== id));
  const moveTo  = (id, status) => setBooks(p => p.map(b => b.id === id ? {...b, status} : b));

  const MOVE_LABELS = {
    reading:   [{ to:"upnext",    label:"→ up next"   }, { to:"completed", label:"✓ done" }],
    upnext:    [{ to:"reading",   label:"→ reading"   }, { to:"completed", label:"✓ done" }],
    completed: [{ to:"reading",   label:"→ reading"   }],
  };

  const emptyMsg = { reading:"what are you reading right now?", upnext:"books you want to read next", completed:"your finished reads will live here" };

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

const TABS = [
  {id:"breathe", icon:"❄", label:"breathe" },
  {id:"today",   icon:"◎", label:"today"   },
  {id:"focus",   icon:"⊙", label:"focus"   },
  {id:"journal", icon:"✦", label:"gratitude" },
  {id:"schedule",icon:"☷", label:"schedule" },
  {id:"notes",   icon:"✎", label:"notes"   },
  {id:"grocery", icon:"◻", label:"grocery" },
  {id:"recipes", icon:"✿", label:"recipes" },
  {id:"readers", icon:"◈", label:"readers" },
  {id:"goals",   icon:"△", label:"dreams"  },
  {id:"cycle",   icon:"◑", label:"cycle"   },
];

function LoginScreen({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    if (e) e.preventDefault();
    if (!email || !password) return setError('enter email and password');
    setLoading(true); setError('');
    const res = mode === 'login' ? await api.login(email, password) : await api.signup(email, password);
    setLoading(false);
    if (res.error) return setError(res.error);
    localStorage.setItem('token', res.token);
    localStorage.setItem('email', email);
    onAuth(res.token, email);
  };

  const inputStyle = { width:'100%', background:C.card, border:`1px solid ${C.borderMid}`, borderRadius:10, padding:'12px 14px', color:C.text, fontFamily:"'Outfit',sans-serif", fontSize:14, outline:'none', boxSizing:'border-box' };

  return (
    <div style={{ minHeight:'100vh', background:C.bg, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ width:'100%', maxWidth:430, background:C.surface, border:`1px solid ${C.border}`, borderRadius:24, padding:'32px 28px', boxShadow:'0 28px 80px rgba(0,0,0,0.32)' }}>
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
  const [userEmail, setUserEmail] = useState(() => {
    const saved = localStorage.getItem('email');
    return saved && saved !== "undefined" ? saved : "";
  });
  const [tab,setTab]               = useState(() => localStorage.getItem('tab') || "today");
  const [anchors,setAnchors]       = useState(DEFAULT_ANCHORS);
  const [anchorDone,setAnchorDone] = useState([]);
  const [focusTasks,setFocusTasks] = useState(DEFAULT_FOCUS);
  const [focusDone,setFocusDone]   = useState([]);
  const [isDark, setIsDark]         = useState(true);
  const [grocery,setGrocery]       = useState([]);
  const [books,setBooks]           = useState([]);
  const [savedAffirms,setSavedAffirms] = useState([]);
  const [sidebarQuote, setSidebarQuote] = useState("");
  const [recipes,setRecipes]       = useState([]);
  const [journal,setJournal]       = useState([]);
  const [notes,setNotes]           = useState([]);
  const [goals,setGoals]           = useState([]);
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
    if (remote.recipes) setRecipes(remote.recipes);
    if (remote.journal) setJournal(remote.journal);
    if (remote.notes) setNotes(remote.notes);
    if (remote.goals) setGoals(remote.goals);
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
  const data = { anchors, [`adone-${tk}`]: anchorDone, focusTasks, [`fdone-${tk}`]: focusDone, grocery, books, savedAffirms, recipes, journal, notes, goals, schedule, cycle: cycleData };
  api.save(token, data);
}, [anchors, anchorDone, focusTasks, focusDone, grocery, books, savedAffirms, recipes, journal, notes, goals, schedule, cycleData, loaded]);

  const cycleInfo = getCycleInfo(cycleData.lastPeriod,cycleData.cycleLength,cycleData.periodLength);
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('email');
    setToken(null);
  };

  if (!token) return <LoginScreen onAuth={(t, e) => { setToken(t); setUserEmail(e); }} />;
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
            {TABS.map(t=>{
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
                  <span style={{fontSize:12,color:active?C.accent:C.textDim}}>{t.icon}</span>
                  <span style={{fontFamily:"'Outfit',sans-serif",fontSize:isDesktop ? 11 : 9,letterSpacing:"0.07em",color:active?C.accent:C.textDim,textTransform:"uppercase",whiteSpace:"nowrap"}}>{t.label}</span>
                </button>
              );
            })}
          </div>

          {isDesktop && (
            <div style={{marginTop:"auto",padding:"14px 20px 18px",borderTop:`1px solid ${C.border}`,background:C.surface}}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
                <p style={{ fontFamily:"'Cormorant Garamond',serif", fontStyle:'italic', fontSize:12, color:C.textDim, margin:0, overflow:"hidden", textOverflow:"ellipsis", flex:1, minWidth:0 }}>{typeof userEmail === "string" ? userEmail : ""}</p>
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
                <button onClick={() => setIsDark(d => !d)} style={{ background:"none", border:`1px solid ${C.borderMid}`, borderRadius:8, color:C.textMid, fontFamily:"'Outfit',sans-serif", fontSize:14, cursor:"pointer", padding:"5px 10px", flexShrink:0 }}>{isDark ? "☀" : "◑"}</button>
              )}
            </div>

            <div style={{flex:1,padding:isDesktop ? "28px 30px 34px" : "22px 18px 40px",overflowY:"auto"}}>
              <TabPanel active={tab==="today"}><TodayTab habits={anchors} doneIds={anchorDone} setDoneIds={setAnchorDone} setHabits={setAnchors}/></TabPanel>
              <TabPanel active={tab==="breathe"}><WimHofTab/></TabPanel>
              <TabPanel active={tab==="focus"}><FocusTab tasks={focusTasks} doneIds={focusDone} setDoneIds={setFocusDone} setTasks={setFocusTasks}/></TabPanel>
              <TabPanel active={tab==="journal"}><JournalTab entries={journal} setEntries={setJournal}/></TabPanel>
              <TabPanel active={tab==="schedule"}><ScheduleTab events={schedule} setEvents={setSchedule} wide={isWideContent}/></TabPanel>
              <TabPanel active={tab==="notes"}><NotesTab notes={notes} setNotes={setNotes}/></TabPanel>
              <TabPanel active={tab==="grocery"}><GroceryTab items={grocery} setItems={setGrocery}/></TabPanel>
              <TabPanel active={tab==="recipes"}><RecipesTab recipes={recipes} setRecipes={setRecipes}/></TabPanel>
              <TabPanel active={tab==="readers"}><ReadersTab books={books} setBooks={setBooks}/></TabPanel>
              <TabPanel active={tab==="goals"}><GoalsTab goals={goals} setGoals={setGoals}/></TabPanel>
              <TabPanel active={tab==="cycle"}><CycleTab cycleData={cycleData} setCycleData={setCycleData} info={cycleInfo}/></TabPanel>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
