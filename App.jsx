import { useState, useEffect, useRef, useCallback } from "react";

const API = 'https://your-day.up.railway.app';

// ── PALETTE ───────────────────────────────────────────────────────────────
const C = {
  bg:"#0D0A06", surface:"#141009", card:"#1B1510",
  border:"#272018", borderMid:"#342C1E",
  text:"#EDE6D0", textMid:"#9A8E75", textDim:"#5A5040",
  accent:"#C4694A", gold:"#C9A84C", sage:"#7A9E7E",
  blush:"#C47A8A", teal:"#5A9E9A", ice:"#7AB8C4",
};

// ── HELPERS ───────────────────────────────────────────────────────────────
const todayKey = () => new Date().toISOString().slice(0, 10);
const fmtShort = (iso) => new Date(iso).toLocaleDateString("en-US",{month:"short",day:"numeric"});
const fmtFull  = () => new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});
const pad = (v) => String(v).padStart(2, "0");
const toDateInputValue = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
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

function HabitRow({h, done, onToggle, onRemove, ringColor, draggable=false, onDragStart, onDragOver, onDrop, onDragEnd}) {
  const [hov,setHov] = useState(false);
  return (
    <div onClick={onToggle} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      draggable={draggable} onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop} onDragEnd={onDragEnd}
      style={{display:"flex",alignItems:"center",gap:14,padding:"13px 16px",background:done?"#1C1B12":C.card,border:`1px solid ${done?"#2C2A18":C.border}`,borderRadius:12,cursor:"pointer",transition:"background 0.15s",marginBottom:8}}>
      <Ring done={done} color={ringColor||C.accent}/>
      <span style={{fontSize:17}}>{h.emoji}</span>
      <span style={{fontFamily:"'Outfit',sans-serif",fontSize:14,flex:1,color:done?C.textDim:C.text,textDecoration:done?"line-through":"none",letterSpacing:"0.02em"}}>{h.name}</span>
      {draggable && <span onClick={e=>e.stopPropagation()} style={{color:C.textDim,fontSize:14,cursor:"grab"}}>⋮⋮</span>}
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
      {/* header card */}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:18,padding:"20px 18px",marginBottom:20}}>
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
              <p style={{fontFamily:"'Outfit',sans-serif",fontSize:12,color:C.textDim,margin:"0 0 14px"}}>suggested: {HOLD_SUGGESTED}s — tap when ready</p>
              <button onClick={endHold} style={{...btn,background:C.blush,fontSize:14,padding:"12px 32px"}}>release &amp; inhale</button>
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
        {status==="running" && phase!=="holdEmpty" && <button onClick={reset} style={{...ghst,fontSize:13}}>end session</button>}
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
  const [dragId,setDragId]   = useState(null);
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
      {habits.map(h=><HabitRow key={h.id} h={h} done={doneIds.includes(h.id)} onToggle={()=>toggle(h.id)} onRemove={()=>remove(h.id)}
        draggable
        onDragStart={()=>setDragId(h.id)}
        onDragOver={e=>e.preventDefault()}
        onDrop={()=>{ if (!dragId) return; setHabits(p=>moveItem(p, dragId, h.id)); setDragId(null); }}
        onDragEnd={()=>setDragId(null)}
      />)}
      <AddRow show={showAdd} setShow={setShowAdd} val={newVal} setVal={setNewVal} onAdd={add} placeholder="add a morning anchor"/>
    </div>
  );
}

// ── FOCUS ─────────────────────────────────────────────────────────────────
function FocusTab({tasks,doneIds,setDoneIds,setTasks}) {
  const [showAdd,setShowAdd] = useState(false);
  const [newVal,setNewVal]   = useState("");
  const [dragId,setDragId]   = useState(null);
  const [timer,setTimer]     = useState(25*60);
  const [running,setRunning] = useState(false);
  const [sessionMin,setSessionMin] = useState(25);
  const ref = useRef(null);
  const EMOJIS = ["🎯","📝","💻","🔬","📊","🗂️","✏️","🔧","🧠","📐"];
  useEffect(()=>{
    if(running){ref.current=setInterval(()=>setTimer(t=>{if(t<=1){clearInterval(ref.current);setRunning(false);return 0;}return t-1;}),1000);}
    else clearInterval(ref.current);
    return ()=>clearInterval(ref.current);
  },[running]);
  const reset = ()=>{setRunning(false);setTimer(sessionMin*60);};
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
          {[25,45,60].map(m=>(
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
      {tasks.map(h=><HabitRow key={h.id} h={h} done={doneIds.includes(h.id)} onToggle={()=>toggle(h.id)} onRemove={()=>remove(h.id)} ringColor={C.teal}
        draggable
        onDragStart={()=>setDragId(h.id)}
        onDragOver={e=>e.preventDefault()}
        onDrop={()=>{ if (!dragId) return; setTasks(p=>moveItem(p, dragId, h.id)); setDragId(null); }}
        onDragEnd={()=>setDragId(null)}
      />)}
      <AddRow show={showAdd} setShow={setShowAdd} val={newVal} setVal={setNewVal} onAdd={add} placeholder="add a focus task"/>
    </div>
  );
}

// ── GROCERY ───────────────────────────────────────────────────────────────
function GroceryRow({item,onToggle,onRemove,draggable=false,onDragStart,onDragOver,onDrop,onDragEnd}) {
  const [hov,setHov]=useState(false);
  return (
    <div onClick={onToggle} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      draggable={draggable} onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop} onDragEnd={onDragEnd}
      style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",background:item.done?"#1C1B12":C.card,border:`1px solid ${item.done?"#2C2A18":C.border}`,borderRadius:12,cursor:"pointer",marginBottom:8}}>
      <Ring done={item.done} color={C.gold} size={24}/>
      <span style={{fontFamily:"'Outfit',sans-serif",fontSize:14,flex:1,color:item.done?C.textDim:C.text,textDecoration:item.done?"line-through":"none"}}>{item.name}</span>
      {item.qty&&<span style={{fontFamily:"'Outfit',sans-serif",fontSize:12,color:C.textDim,flexShrink:0}}>{item.qty}</span>}
      {draggable && <span onClick={e=>e.stopPropagation()} style={{color:C.textDim,fontSize:14,cursor:"grab"}}>⋮⋮</span>}
      {hov&&<button onClick={e=>{e.stopPropagation();onRemove();}} style={{background:"none",border:"none",color:C.textDim,cursor:"pointer",fontSize:13}}>✕</button>}
    </div>
  );
}

function GroceryTab({items,setItems}) {
  const [showAdd,setShowAdd]=useState(false);
  const [name,setName]=useState("");
  const [qty,setQty]=useState("");
  const [dragId,setDragId]=useState(null);
  const toggle  = id=>setItems(p=>p.map(i=>i.id===id?{...i,done:!i.done}:i));
  const remove  = id=>setItems(p=>p.filter(i=>i.id!==id));
  const clearDone=()=>setItems(p=>p.filter(i=>!i.done));
  const add=()=>{if(!name.trim())return;setItems(p=>[...p,{id:`gr${Date.now()}`,name:name.trim().toLowerCase(),qty:qty.trim(),done:false}]);setName("");setQty("");setShowAdd(false);};
  const active=items.filter(i=>!i.done), done=items.filter(i=>i.done);
  const reorderActive = (targetId) => {
    if (!dragId) return;
    setItems(p => {
      const activeItems = p.filter(i => !i.done);
      const doneItems = p.filter(i => i.done);
      return [...moveItem(activeItems, dragId, targetId), ...doneItems];
    });
    setDragId(null);
  };
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
        <p style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:15,color:C.textMid,margin:0}}>grocery list</p>
        {done.length>0&&<button onClick={clearDone} style={{background:"none",border:"none",color:C.textDim,fontFamily:"'Outfit',sans-serif",fontSize:12,cursor:"pointer"}}>clear checked ({done.length})</button>}
      </div>
      {active.map(i=><GroceryRow key={i.id} item={i} onToggle={()=>toggle(i.id)} onRemove={()=>remove(i.id)}
        draggable
        onDragStart={()=>setDragId(i.id)}
        onDragOver={e=>e.preventDefault()}
        onDrop={()=>reorderActive(i.id)}
        onDragEnd={()=>setDragId(null)}
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
      {done.length>0&&<div style={{marginTop:24,opacity:0.55}}><span style={sec}>in the cart</span>{done.map(i=><GroceryRow key={i.id} item={i} onToggle={()=>toggle(i.id)} onRemove={()=>remove(i.id)}/>)}</div>}
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
function JournalCard({entry,onDelete}) {
  const [hov,setHov]=useState(false);
  return (
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px 16px",marginBottom:10,position:"relative"}}>
      <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:16,color:C.text,lineHeight:1.75,margin:"0 0 6px",whiteSpace:"pre-wrap"}}>{entry.text}</p>
      <span style={{fontFamily:"'Outfit',sans-serif",fontSize:11,color:C.textDim}}>{fmtShort(entry.date)}</span>
      {hov&&<button onClick={onDelete} style={{position:"absolute",top:10,right:10,background:"none",border:"none",color:C.textDim,cursor:"pointer",fontSize:12}}>✕</button>}
    </div>
  );
}

function JournalTab({entries,setEntries}) {
  const [text,setText]=useState("");
  const tk=todayKey();
  const todayE=entries.filter(e=>e.date.slice(0,10)===tk);
  const pastE =entries.filter(e=>e.date.slice(0,10)!==tk);
  const add=()=>{if(!text.trim())return;setEntries(p=>[{id:`j${Date.now()}`,date:new Date().toISOString(),text:text.trim()},...p]);setText("");};
  const del=id=>setEntries(p=>p.filter(e=>e.id!==id));
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
      {todayE.length>0&&<><span style={sec}>today</span>{todayE.map(e=><JournalCard key={e.id} entry={e} onDelete={()=>del(e.id)}/>)}</>}
      {pastE.length>0&&<div style={{marginTop:16}}><span style={sec}>earlier</span>{pastE.slice(0,15).map(e=><JournalCard key={e.id} entry={e} onDelete={()=>del(e.id)}/>)}</div>}
      {entries.length===0&&<p style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:14,color:C.textDim,textAlign:"center",marginTop:20}}>your gratitude entries will live here</p>}
    </div>
  );
}

// ── GOALS ─────────────────────────────────────────────────────────────────
function GoalItem({goal,toggle,remove,draggable=false,onDragStart,onDragOver,onDrop,onDragEnd}) {
  const [hov,setHov]=useState(false);
  return (
    <div onClick={()=>toggle(goal.id)} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      draggable={draggable} onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop} onDragEnd={onDragEnd}
      style={{display:"flex",alignItems:"flex-start",gap:12,padding:"13px 16px",background:goal.done?"#1A1D14":C.card,border:`1px solid ${goal.done?"#252A1C":C.border}`,borderRadius:12,marginBottom:8,cursor:"pointer"}}>
      <Ring done={goal.done} color={C.gold} size={24}/>
      <span style={{fontFamily:"'Outfit',sans-serif",fontSize:14,flex:1,color:goal.done?C.textDim:C.text,textDecoration:goal.done?"line-through":"none",lineHeight:1.6,paddingTop:2}}>{goal.text}</span>
      {draggable && <span onClick={e=>e.stopPropagation()} style={{color:C.textDim,fontSize:14,cursor:"grab"}}>⋮⋮</span>}
      {hov&&<button onClick={e=>{e.stopPropagation();remove(goal.id);}} style={{background:"none",border:"none",color:C.textDim,cursor:"pointer",fontSize:13}}>✕</button>}
    </div>
  );
}

function GoalsTab({goals,setGoals}) {
  const [showAdd,setShowAdd]=useState(false);
  const [newVal,setNewVal]=useState("");
  const [dragId,setDragId]=useState(null);
  const toggle=id=>setGoals(p=>p.map(g=>g.id===id?{...g,done:!g.done}:g));
  const remove=id=>setGoals(p=>p.filter(g=>g.id!==id));
  const add=()=>{if(!newVal.trim())return;setGoals(p=>[...p,{id:`d${Date.now()}`,text:newVal.trim(),done:false}]);setNewVal("");setShowAdd(false);};
  const active=goals.filter(g=>!g.done), done=goals.filter(g=>g.done);
  const reorderActive = (targetId) => {
    if (!dragId) return;
    setGoals(p => {
      const activeGoals = p.filter(g => !g.done);
      const doneGoals = p.filter(g => g.done);
      return [...moveItem(activeGoals, dragId, targetId), ...doneGoals];
    });
    setDragId(null);
  };
  return (
    <div>
      <p style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:15,color:C.textMid,marginBottom:22}}>what you're building toward</p>
      {active.map(g=><GoalItem key={g.id} goal={g} toggle={toggle} remove={remove}
        draggable
        onDragStart={()=>setDragId(g.id)}
        onDragOver={e=>e.preventDefault()}
        onDrop={()=>reorderActive(g.id)}
        onDragEnd={()=>setDragId(null)}
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
  const save=()=>{setCycleData(form);setEditing(false);};
  if(editing||!info) return (
    <div>
      <div style={{background:`linear-gradient(135deg,${C.blush}12,${C.card})`,border:`1px solid ${C.border}`,borderRadius:18,padding:"22px 18px",marginBottom:20,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:"50%",right:18,transform:"translateY(-50%)",width:78,height:78,borderRadius:20,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(220,228,240,0.18)",display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(2px)"}}>
          <div style={{position:"relative",width:58,height:58,borderRadius:"50%",background:"radial-gradient(circle at 32% 30%, rgba(255,255,255,1), rgba(237,241,247,0.98) 35%, rgba(203,211,224,0.88) 68%, rgba(203,211,224,0.72) 100%)",boxShadow:"0 0 26px rgba(226, 232, 244, 0.38), inset 0 0 12px rgba(255,255,255,0.28)"}}>
            <div style={{position:"absolute",top:3,left:19,width:52,height:52,borderRadius:"50%",background:`linear-gradient(135deg,${C.blush}20,${C.card})`}} />
          </div>
        </div>
        <p style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:16,color:C.textMid,marginBottom:0,paddingRight:96,minHeight:34,display:"flex",alignItems:"center"}}>{!cycleData.lastPeriod?"let's set up your cycle":"update your cycle"}</p>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        <div><label style={lbl}>first day of last period</label><input type="date" value={form.lastPeriod} onChange={e=>setForm(f=>({...f,lastPeriod:e.target.value}))} style={inp}/></div>
        <div><label style={lbl}>cycle length (days)</label><input type="number" min="21" max="45" value={form.cycleLength} onChange={e=>setForm(f=>({...f,cycleLength:parseInt(e.target.value)||28}))} style={inp}/></div>
        <div><label style={lbl}>period length (days)</label><input type="number" min="2" max="10" value={form.periodLength} onChange={e=>setForm(f=>({...f,periodLength:parseInt(e.target.value)||5}))} style={inp}/></div>
        <button onClick={save} style={btn}>save</button>
      </div>
    </div>
  );
  const ph=PHASES[info.phase], pct=(info.dayInCycle/info.cycleLen)*100;
  return (
    <div>
      <div style={{background:`linear-gradient(135deg,${ph.color}1A,${C.card})`,border:`1px solid ${ph.color}35`,borderRadius:18,padding:"26px 22px",marginBottom:18,textAlign:"center",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:18,right:18,width:78,height:78,borderRadius:20,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(220,228,240,0.18)",display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(2px)"}}>
          <div style={{position:"relative",width:58,height:58,borderRadius:"50%",background:"radial-gradient(circle at 32% 30%, rgba(255,255,255,1), rgba(237,241,247,0.98) 35%, rgba(203,211,224,0.88) 68%, rgba(203,211,224,0.72) 100%)",boxShadow:"0 0 26px rgba(226, 232, 244, 0.38), inset 0 0 12px rgba(255,255,255,0.28)"}}>
            <div style={{position:"absolute",top:3,left:19,width:52,height:52,borderRadius:"50%",background:`linear-gradient(135deg,${ph.color}20,${C.card})`}} />
          </div>
        </div>
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

// ── ROOT ──────────────────────────────────────────────────────────────────
const TABS = [
  {id:"breathe", icon:"❄", label:"breathe" },
  {id:"today",   icon:"◎", label:"today"   },
  {id:"focus",   icon:"⊙", label:"focus"   },
  {id:"schedule",icon:"☷", label:"schedule" },
  {id:"journal", icon:"✦", label:"gratitude" },
  {id:"grocery", icon:"◻", label:"grocery" },
  {id:"recipes", icon:"✿", label:"recipes" },
  {id:"goals",   icon:"△", label:"dreams"  },
  {id:"cycle",   icon:"◑", label:"cycle"   },
];

function LoginScreen({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email || !password) return setError('enter email and password');
    setLoading(true); setError('');
    const res = mode === 'login' ? await api.login(email, password) : await api.signup(email, password);
    setLoading(false);
    if (res.error) return setError(res.error);
    localStorage.setItem('token', res.token);
    localStorage.setItem('email', res.email);
    onAuth(res.token, res.email);
  };

  return (
    <div style={{ minHeight:'100vh', background:'#0D0A06', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ width:'100%', maxWidth:430, background:C.surface, border:`1px solid ${C.border}`, borderRadius:24, padding:'32px 28px', boxShadow:'0 28px 80px rgba(0,0,0,0.32)' }}>
        <div style={{ fontFamily:"'Cormorant Garamond',serif", fontStyle:'italic', fontSize:36, fontWeight:300, color:'#EDE6D0', textAlign:'center', marginBottom:8 }}>Held</div>
        <div style={{ fontFamily:"'Outfit',sans-serif", fontSize:12, color:'#5A5040', textAlign:'center', letterSpacing:'0.1em', marginBottom:40 }}>daily anchor app</div>
        <div style={{ display:'flex', gap:8, marginBottom:24 }}>
          {['login','signup'].map(m => (
            <button key={m} onClick={() => setMode(m)} style={{ flex:1, padding:'10px', borderRadius:10, border:`1px solid ${mode===m ? '#C4694A' : '#342C1E'}`, background:'none', color: mode===m ? '#C4694A' : '#5A5040', fontFamily:"'Outfit',sans-serif", fontSize:13, cursor:'pointer' }}>{m}</button>
          ))}
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="email" type="email"
            style={{ width:'100%', background:'#1B1510', border:'1px solid #342C1E', borderRadius:10, padding:'12px 14px', color:'#EDE6D0', fontFamily:"'Outfit',sans-serif", fontSize:14, outline:'none', boxSizing:'border-box' }} />
          <input value={password} onChange={e => setPassword(e.target.value)} placeholder="password" type="password"
            onKeyDown={e => e.key === 'Enter' && submit()}
            style={{ width:'100%', background:'#1B1510', border:'1px solid #342C1E', borderRadius:10, padding:'12px 14px', color:'#EDE6D0', fontFamily:"'Outfit',sans-serif", fontSize:14, outline:'none', boxSizing:'border-box' }} />
          {error && <p style={{ color:'#C47A8A', fontFamily:"'Outfit',sans-serif", fontSize:12, margin:0 }}>{error}</p>}
          <button onClick={submit} disabled={loading}
            style={{ background:'#C4694A', border:'none', borderRadius:10, padding:'13px', color:'#fff', fontFamily:"'Outfit',sans-serif", fontSize:14, fontWeight:500, cursor:'pointer', marginTop:4 }}>
            {loading ? '...' : mode === 'login' ? 'log in' : 'create account'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const viewportWidth = useViewportWidth();
  const isDesktop = viewportWidth >= 1080;
  const isWideContent = viewportWidth >= 1280;
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [userEmail, setUserEmail] = useState(() => localStorage.getItem('email'));
  const [tab,setTab]               = useState(() => localStorage.getItem('tab') || "today");
  const [anchors,setAnchors]       = useState(DEFAULT_ANCHORS);
  const [anchorDone,setAnchorDone] = useState([]);
  const [focusTasks,setFocusTasks] = useState(DEFAULT_FOCUS);
  const [focusDone,setFocusDone]   = useState([]);
  const [grocery,setGrocery]       = useState([]);
  const [recipes,setRecipes]       = useState([]);
  const [journal,setJournal]       = useState([]);
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
    document.body.style.background=C.bg;
  },[]);

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
    if (remote[`adone-${tk}`]) setAnchorDone(remote[`adone-${tk}`]);
    if (remote.focusTasks) setFocusTasks(remote.focusTasks);
    if (remote[`fdone-${tk}`]) setFocusDone(remote[`fdone-${tk}`]);
    if (remote.grocery) setGrocery(remote.grocery);
    if (remote.recipes) setRecipes(remote.recipes);
    if (remote.journal) setJournal(remote.journal);
    if (remote.goals) setGoals(remote.goals);
    if (remote.schedule) setSchedule(sortSchedule(remote.schedule));
    if (remote.cycle) setCycleData(remote.cycle);
    setLoaded(true);
  })();
}, [token]);

  useEffect(() => {
  if (!loaded || !token) return;
  const tk = todayKey();
  const data = { anchors, [`adone-${tk}`]: anchorDone, focusTasks, [`fdone-${tk}`]: focusDone, grocery, recipes, journal, goals, schedule, cycle: cycleData };
  api.save(token, data);
}, [anchors, anchorDone, focusTasks, focusDone, grocery, recipes, journal, goals, schedule, cycleData, loaded]);

  const cycleInfo = getCycleInfo(cycleData.lastPeriod,cycleData.cycleLength,cycleData.periodLength);
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('email');
    setToken(null);
  };

  if (!token) return <LoginScreen onAuth={(t, e) => { setToken(t); setUserEmail(e); }} />;
  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",justifyContent:"center",fontFamily:"'Outfit',sans-serif",padding:isDesktop ? "24px" : 0}}>
      <div style={{width:"100%",maxWidth:isDesktop ? 1380 : 520,display:isDesktop ? "grid" : "flex",flexDirection:isDesktop ? undefined : "column",gridTemplateColumns:isDesktop ? "280px minmax(0, 1fr)" : undefined,gap:isDesktop ? 24 : 0,minHeight:"100vh"}}>

        <aside style={{background:C.surface,border:isDesktop ? `1px solid ${C.border}` : "none",borderRadius:isDesktop ? 28 : 0,display:"flex",flexDirection:"column",overflow:"hidden",minHeight:isDesktop ? "calc(100vh - 48px)" : "auto",position:isDesktop ? "sticky" : "relative",top:isDesktop ? 24 : 0,alignSelf:isDesktop ? "start" : "stretch"}}>
          <div style={{padding:isDesktop ? "30px 24px 22px" : "28px 24px 16px",borderBottom:`1px solid ${C.border}`}}>
            <div style={{fontFamily:"'Outfit',sans-serif",fontSize:10,color:C.textDim,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:4}}>{fmtFull()}</div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:isDesktop ? 36 : 30,fontWeight:300,color:C.text,lineHeight:1.1}}>Held</div>
            <p style={{fontFamily:"'Outfit',sans-serif",fontSize:12,color:C.textDim,lineHeight:1.6,margin:"10px 0 0"}}>
              A single place for anchors, work, reflection, and long-range planning.
            </p>
            {cycleInfo&&(
              <div style={{display:"inline-flex",alignItems:"center",gap:6,marginTop:14,background:`${PHASES[cycleInfo.phase].color}18`,border:`1px solid ${PHASES[cycleInfo.phase].color}25`,borderRadius:20,padding:"4px 12px"}}>
                <span style={{fontSize:11}}>{PHASES[cycleInfo.phase].moon}</span>
                <span style={{fontFamily:"'Outfit',sans-serif",fontSize:10,color:PHASES[cycleInfo.phase].color,letterSpacing:"0.06em"}}>{PHASES[cycleInfo.phase].label} · day {cycleInfo.dayInCycle}</span>
              </div>
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
                  minWidth:isDesktop ? "100%" : 54,
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
                <p style={{ fontFamily:"'Cormorant Garamond',serif", fontStyle:'italic', fontSize:12, color:'#5A5040', margin:0, overflow:"hidden", textOverflow:"ellipsis" }}>{typeof userEmail === "string" ? userEmail : ""}</p>
                <button onClick={logout} style={{ background:'none', border:'none', color:'#5A5040', fontFamily:"'Outfit',sans-serif", fontSize:11, cursor:'pointer', padding:0 }}>log out</button>
              </div>
            </div>
          )}
        </aside>

        <main style={{display:"flex",flexDirection:"column",minWidth:0}}>
          <div style={{background:C.surface,border:isDesktop ? `1px solid ${C.border}` : "none",borderRadius:isDesktop ? 28 : 0,display:"flex",flexDirection:"column",minHeight:isDesktop ? "calc(100vh - 48px)" : "auto",overflow:"hidden"}}>
            <div style={{padding:isDesktop ? "30px 30px 18px" : "22px 18px 0",borderBottom:`1px solid ${C.border}`}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:isDesktop ? 38 : 30,color:C.text,lineHeight:1}}>
                {TABS.find((item) => item.id === tab)?.label || "today"}
              </div>
            </div>

            <div style={{flex:1,padding:isDesktop ? "28px 30px 34px" : "22px 18px 40px",overflowY:"auto"}}>
              {tab==="today"    && <TodayTab habits={anchors} doneIds={anchorDone} setDoneIds={setAnchorDone} setHabits={setAnchors}/>}
              {tab==="breathe"  && <WimHofTab/>}
              {tab==="focus"    && <FocusTab tasks={focusTasks} doneIds={focusDone} setDoneIds={setFocusDone} setTasks={setFocusTasks}/>}
              {tab==="schedule" && <ScheduleTab events={schedule} setEvents={setSchedule} wide={isWideContent}/>}
              {tab==="grocery"  && <GroceryTab items={grocery} setItems={setGrocery}/>}
              {tab==="recipes"  && <RecipesTab recipes={recipes} setRecipes={setRecipes}/>}
              {tab==="journal"  && <JournalTab entries={journal} setEntries={setJournal}/>}
              {tab==="goals"    && <GoalsTab goals={goals} setGoals={setGoals}/>}
              {tab==="cycle"    && <CycleTab cycleData={cycleData} setCycleData={setCycleData} info={cycleInfo}/>}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
