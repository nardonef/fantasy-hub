// "After" — redesigned screens.

// ─── Helper: gold divider that doesn't run the whole width
const GoldRule = () => <div style={{ width: 28, height: 2, background: FH.gold, borderRadius: 1 }}/>;

// ────────────────────────────────────────────────
// AFTER · Dashboard — "Week at a glance"
// Fix: lead with the ONE thing that matters this week. Demote import logs.
// ────────────────────────────────────────────────
function AfterDashboard() {
  return (
    <PhoneShell
      navTitle={<span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
        <span style={{ color: FH.creamDim, fontSize: 11, fontWeight: 600, letterSpacing: 1 }}>LEAGUE</span>
        <span style={{ fontSize: 16, fontWeight: 700 }}>BIG12</span>
        <svg width="9" height="6" viewBox="0 0 9 6"><path d="M1 1l3.5 3.5L8 1" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
      </span>}
      activeTab="Dashboard">

      <div style={{ padding: '0 16px 20px', overflow:'auto', height:'100%', display:'flex', flexDirection:'column', gap: 14 }}>

        {/* Hero: Week 14, your matchup — THE moment, not a tile */}
        <div style={{ padding: '18px 4px 4px' }}>
          <div style={{ fontSize: 10, color: FH.gold, fontWeight: 700, letterSpacing: 1.4 }}>WEEK 14 · SUN 1:00 PM</div>
          <div style={{ display:'flex', alignItems:'baseline', gap: 8, marginTop: 8 }}>
            <span style={{ ...T.h1(), fontSize: 26 }}>You vs kozmania</span>
          </div>
          <div style={{ marginTop: 6, fontSize: 13, color: FH.creamDim, lineHeight: 1.4 }}>
            A loss ends your <span style={{ color: FH.gold, fontWeight: 600 }}>6-game</span> win streak and costs you the #2 seed.
          </div>
        </div>

        {/* Matchup card */}
        <Card pad={0} style={{ overflow:'hidden' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 44px 1fr', alignItems:'center', padding: '18px 20px' }}>
            <div>
              <div style={{ fontSize: 10, color: FH.gold, fontWeight: 700, letterSpacing: 1 }}>YOU</div>
              <div style={{ ...T.num(28), marginTop: 6 }}>114.2</div>
              <div style={{ fontSize: 11, color: FH.creamDim, marginTop: 2 }}>proj · 78% win</div>
            </div>
            <div style={{ textAlign:'center', fontSize: 11, color: FH.creamFaint, fontWeight: 700, letterSpacing: 1.5 }}>VS</div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize: 10, color: FH.creamDim, fontWeight: 700, letterSpacing: 1 }}>KOZMANIA</div>
              <div style={{ ...T.num(28), color: FH.creamDim, marginTop: 6 }}>98.6</div>
              <div style={{ fontSize: 11, color: FH.creamFaint, marginTop: 2 }}>proj</div>
            </div>
          </div>
          {/* win prob bar */}
          <div style={{ height: 3, display:'flex' }}>
            <div style={{ flex: 78, background: FH.gold }}/>
            <div style={{ flex: 22, background: FH.hairlineStrong }}/>
          </div>
          <div style={{ padding: '12px 20px', display:'flex', gap: 16, fontSize: 11, color: FH.creamDim }}>
            <span>H2H <span style={{ color: FH.cream, fontWeight: 600 }}>6–0</span></span>
            <span>Avg margin <span style={{ color: FH.win, fontWeight: 600 }}>+18.4</span></span>
            <span style={{ marginLeft:'auto', color: FH.gold, fontWeight: 600 }}>Preview →</span>
          </div>
        </Card>

        {/* Three-across: things that need your attention THIS week */}
        <div>
          <Eyebrow style={{ marginBottom: 8 }}>NEEDS YOUR ATTENTION</Eyebrow>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap: 8 }}>
            {[
              { n:'2',  l:'Lineup gaps', sub:'FLEX · D/ST', color: FH.loss },
              { n:'4',  l:'Waiver adds', sub:'trending up',  color: FH.win  },
              { n:'1',  l:'Trade offer', sub:'from @jake',   color: FH.gold },
            ].map(c => (
              <Card key={c.l} pad={12}>
                <div style={{ ...T.num(26), color: c.color }}>{c.n}</div>
                <div style={{ fontSize: 11, color: FH.cream, marginTop: 6, fontWeight: 600 }}>{c.l}</div>
                <div style={{ fontSize: 10, color: FH.creamFaint, marginTop: 1 }}>{c.sub}</div>
              </Card>
            ))}
          </div>
        </div>

        {/* All-time strip — single row, scannable, tabular */}
        <Card pad={14}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <Eyebrow>ALL-TIME · 4 SEASONS</Eyebrow>
            <span style={{ fontSize: 11, color: FH.gold, fontWeight: 600 }}>Full stats →</span>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginTop: 12 }}>
            <div>
              <div style={{ ...T.num(28) }}>30–26</div>
              <div style={{ fontSize: 10, color: FH.creamDim, marginTop: 3 }}>Record · 54%</div>
            </div>
            <div>
              <div style={{ ...T.num(22), color: FH.win }}>103.0</div>
              <div style={{ fontSize: 10, color: FH.creamDim, marginTop: 3 }}>PPG · <span style={{ color: FH.win }}>+7.8</span> vs avg</div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ display:'flex', gap: 5, justifyContent:'flex-end', alignItems:'center' }}>
                <span style={{ ...T.num(22), color: FH.gold }}>2</span>
                <svg width="16" height="16" viewBox="0 0 16 16" fill={FH.gold}><path d="M4 2h8v3a4 4 0 01-4 4 4 4 0 01-4-4V2zM2 3h2v2H2zM12 3h2v2h-2zM6 10h4v3H6z"/></svg>
              </div>
              <div style={{ fontSize: 10, color: FH.creamDim, marginTop: 3 }}>Titles · 4 POs</div>
            </div>
          </div>
          {/* weekly PPG chart, clean */}
          <div style={{ marginTop: 14, position: 'relative' }}>
            <Sparkline data={[80,92,101,88,95,110,102,86,98,112,104,90,99,108,103,89,96,111,102,107]} w={322} h={42} color={FH.gold} fill/>
            <div style={{ position:'absolute', left: 0, bottom: -2, fontSize: 9, color: FH.creamFaint, letterSpacing: 0.5 }}>W1</div>
            <div style={{ position:'absolute', right: 0, bottom: -2, fontSize: 9, color: FH.creamFaint, letterSpacing: 0.5 }}>W20</div>
          </div>
        </Card>

        {/* League pulse — replace activity log with something actually useful */}
        <div>
          <Eyebrow style={{ marginBottom: 8 }}>LEAGUE PULSE · THIS WEEK</Eyebrow>
          <Card pad={0}>
            {[
              { who:'Blake', what:'just set his lineup',              when:'2h ago', c: FH.info },
              { who:'efuego93', what:'accepted a trade — gave up R. Jones', when:'5h ago', c: FH.gold },
              { who:'JimmyTea', what:'claimed B. Aubrey off waivers',  when:'1d ago', c: FH.win  },
              { who:'jake', what:'dropped S. Diggs · hasn\'t logged in 6d', when:'2d ago', c: FH.loss },
            ].map((r, i, a) => (
              <div key={i} style={{ display:'flex', alignItems:'center', padding:'12px 14px', borderBottom: i < a.length - 1 ? `0.5px solid ${FH.hairline}` : 'none' }}>
                <div style={{ width: 6, height: 6, borderRadius: 3, background: r.c, marginRight: 10 }}/>
                <div style={{ flex: 1, fontSize: 13, color: FH.cream, lineHeight: 1.35 }}>
                  <span style={{ fontWeight: 700 }}>{r.who}</span>
                  <span style={{ color: FH.creamDim }}> {r.what}</span>
                </div>
                <div style={{ fontSize: 10, color: FH.creamFaint }}>{r.when}</div>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </PhoneShell>
  );
}

// ────────────────────────────────────────────────
// AFTER · Analytics — Lead with insight, not KPI tiles
// ────────────────────────────────────────────────
function AfterAnalytics() {
  return (
    <PhoneShell navTitle="Analytics" activeTab="Analytics" navRight={
      <div style={{ fontSize: 13, color: FH.gold, fontWeight: 600 }}>BIG12 ↓</div>
    }>
      <div style={{ padding: '0 16px 20px', overflow:'auto', height:'100%', display:'flex', flexDirection:'column', gap: 14 }}>
        {/* segmented range */}
        <div style={{ display:'flex', background: FH.bgElev1, borderRadius: 10, padding: 3, gap: 2, marginTop: 4 }}>
          {['All-time','2025','2024','2023','2022'].map((y, i) => (
            <div key={y} style={{
              flex: 1, textAlign:'center', padding:'8px 6px',
              borderRadius: 7, fontSize: 11, fontWeight: 600, letterSpacing: 0.2,
              background: i === 0 ? FH.bgElev2 : 'transparent',
              color: i === 0 ? FH.cream : FH.creamDim,
              border: i === 0 ? `0.5px solid ${FH.hairlineStrong}` : 'none',
            }}>{y}</div>
          ))}
        </div>

        {/* Headline insight */}
        <Card pad={16} style={{ background: `linear-gradient(180deg, ${FH.bgElev1} 0%, ${FH.bgElev1} 70%, rgba(201,169,110,0.06) 100%)` }}>
          <Eyebrow>INSIGHT · UPDATED 2H AGO</Eyebrow>
          <div style={{ marginTop: 10, fontSize: 17, color: FH.cream, fontWeight: 600, lineHeight: 1.3, letterSpacing: -0.3 }}>
            Your team overperforms in <span style={{ color: FH.gold }}>weeks 10–14</span>, averaging <span style={{ color: FH.win }}>+12.4</span> over season pace.
          </div>
          <div style={{ marginTop: 12 }}>
            {/* season-shape line */}
            <svg width="100%" height="70" viewBox="0 0 322 70" preserveAspectRatio="none">
              <defs>
                <linearGradient id="aa" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor={FH.gold} stopOpacity="0.3"/>
                  <stop offset="1" stopColor={FH.gold} stopOpacity="0"/>
                </linearGradient>
              </defs>
              <path d="M0 40 L18 42 L36 38 L54 44 L72 41 L90 35 L108 38 L126 34 L144 36 L162 28 L180 22 L198 18 L216 14 L234 20 L252 16 L270 10 L288 16 L306 12 L322 18 L322 70 L0 70Z" fill="url(#aa)"/>
              <path d="M0 40 L18 42 L36 38 L54 44 L72 41 L90 35 L108 38 L126 34 L144 36 L162 28 L180 22 L198 18 L216 14 L234 20 L252 16 L270 10 L288 16 L306 12 L322 18" fill="none" stroke={FH.gold} strokeWidth="1.8"/>
              <line x1="180" y1="0" x2="180" y2="70" stroke={FH.creamFaint} strokeDasharray="2 3" strokeWidth="0.5"/>
              <text x="185" y="12" fontSize="9" fill={FH.creamDim} fontFamily={FH.sans}>W10</text>
            </svg>
          </div>
        </Card>

        {/* KPI mini-strip (one row, less noisy) */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 8 }}>
          {[['4','Seasons'],['784','Games'],['175.9','Season hi'],['95.1','Avg PPG']].map(([v, l]) => (
            <div key={l} style={{ textAlign:'center', padding: 10, borderRadius: 12, background: FH.bgElev1, border: `0.5px solid ${FH.hairline}` }}>
              <div style={{ ...T.num(17) }}>{v}</div>
              <div style={{ fontSize: 9, color: FH.creamDim, marginTop: 4, letterSpacing: 0.3 }}>{l}</div>
            </div>
          ))}
        </div>

        {/* Section directory — one card per analytic */}
        <div>
          <div style={{ display:'flex', alignItems:'center', gap: 10, marginBottom: 10 }}>
            <GoldRule/>
            <Eyebrow>DRILL DOWN</Eyebrow>
          </div>
          {[
            { k:'Standings & power',    stat:'JimmyTea 12–2', arrow:'#1 ↑1', spark:[7,8,9,10,11,12,12], color: FH.win },
            { k:'Head-to-head',         stat:'You vs Blake',  arrow:'6-3',   spark:[1,0,1,1,0,1,1],     color: FH.gold },
            { k:'Draft efficiency',     stat:'+34 pts above ADP', arrow:'Top 3', spark:[3,5,4,7,9,8,10], color: FH.win },
            { k:'Bench scoring',        stat:'62 pts left on bench', arrow:'Wk 11', spark:[3,6,4,9,12,5,8], color: FH.loss },
            { k:'Position performance', stat:'RB group +18%',  arrow:'best',  spark:[2,3,5,4,6,7,8],     color: FH.gold },
            { k:'Playoff success',      stat:'2 titles · 4 apps', arrow:'50%', spark:[1,0,1,0,1,1,1],    color: FH.gold },
          ].map((r, i, a) => (
            <div key={r.k} style={{
              display:'flex', alignItems:'center', gap: 12,
              padding: '14px 2px', borderBottom: i < a.length - 1 ? `0.5px solid ${FH.hairline}` : 'none',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: FH.cream, fontWeight: 600 }}>{r.k}</div>
                <div style={{ fontSize: 11, color: FH.creamDim, marginTop: 2 }}>{r.stat}</div>
              </div>
              <Sparkline data={r.spark} w={60} h={20} color={r.color} fill={false}/>
              <div style={{ fontSize: 11, color: FH.creamDim, fontVariantNumeric: 'tabular-nums', minWidth: 48, textAlign:'right' }}>{r.arrow}</div>
              <svg width="6" height="10" viewBox="0 0 6 10" stroke={FH.creamFaint} strokeWidth="1.5" fill="none" strokeLinecap="round"><path d="M1 1l4 4-4 4"/></svg>
            </div>
          ))}
        </div>
      </div>
    </PhoneShell>
  );
}

// ────────────────────────────────────────────────
// AFTER · Standings — Denser, more signal per row
// ────────────────────────────────────────────────
function AfterStandings() {
  const rows = [
    { r:1, i:'T', n:'tyler',      w:'9–5', pf:1500.1, pa:1346.4, diff:'+153.7', streak:'WWWLW', form:[108,94,112,101,118] },
    { r:2, i:'B', n:'Blake',      w:'8–6', pf:1563.5, pa:1441.0, diff:'+122.5', streak:'WLWWL', form:[98,110,106,115,88] },
    { r:3, i:'E', n:'efuego93',   w:'9–5', pf:1529.3, pa:1426.5, diff:'+102.8', streak:'LWWWW', form:[92,104,117,112,108] },
    { r:4, i:'F', n:'Frankie N.', w:'9–5', pf:1481.3, pa:1331.7, diff:'+149.6', streak:'WWWWL', form:[105,109,118,113,89] },
    { r:5, i:'M', n:'matt',       w:'8–6', pf:1469.4, pa:1550.5, diff:'−81.1',  streak:'WLWLW', form:[94,102,86,113,99] },
    { r:6, i:'J', n:'jake',       w:'7–7', pf:1508.9, pa:1574.7, diff:'−65.8',  streak:'LLWLW', form:[88,92,98,87,112] },
    { r:7, i:'B', n:'Bryan Y.',   w:'6–8', pf:1586.9, pa:1496.5, diff:'+90.4',  streak:'WWLLL', form:[118,114,96,88,78] },
    { r:8, i:'R', n:'Ryan C.',    w:'6–8', pf:1447.7, pa:1618.0, diff:'−170.3', streak:'LLLWW', form:[78,84,82,96,103] },
    { r:9, i:'P', n:'Peter',      w:'5–9', pf:1354.3, pa:1502.9, diff:'−148.6', streak:'LLWLL', form:[82,76,88,74,80] },
    { r:10,i:'A', n:'AB',         w:'6–8', pf:1348.0, pa:1413.0, diff:'−65.0',  streak:'LWLLL', form:[76,92,78,82,74] },
    { r:11,i:'R', n:'Ryan',       w:'2–12',pf:1243.7, pa:1518.9, diff:'−275.2', streak:'LLLLL', form:[68,74,62,70,66] },
  ];
  const color = (w) => parseInt(w.split('–')[0]) > 7 ? FH.win : parseInt(w.split('–')[0]) < 6 ? FH.loss : FH.creamDim;
  return (
    <PhoneShell navTitle="Standings" activeTab="Analytics" navLeft={
      <div style={{ width: 32, height: 32, borderRadius: 16, background: FH.bgElev1, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <svg width="12" height="12" viewBox="0 0 12 12" stroke={FH.cream} strokeWidth="1.8" fill="none" strokeLinecap="round"><path d="M8 2L3 6l5 4"/></svg>
      </div>
    }>
      <div style={{ padding: '0 12px 0' }}>
        <div style={{ display:'flex', background: FH.bgElev1, borderRadius: 10, padding: 3, gap: 2, margin: '6px 4px 12px' }}>
          {['Standings','Power','vs ADP','Luck'].map((t, i) => (
            <div key={t} style={{
              flex:1, textAlign:'center', padding:'8px 6px', borderRadius: 7,
              fontSize: 12, fontWeight: 600,
              background: i === 0 ? FH.bgElev2 : 'transparent',
              color: i === 0 ? FH.cream : FH.creamDim,
              border: i === 0 ? `0.5px solid ${FH.hairlineStrong}` : 'none',
            }}>{t}</div>
          ))}
        </div>
        <div style={{ display:'flex', padding:'0 8px 8px', fontSize: 10, color: FH.creamFaint, fontWeight: 600, letterSpacing: 0.8 }}>
          <div style={{ width: 20 }}>#</div>
          <div style={{ width: 34 }}/>
          <div style={{ flex: 1 }}>MANAGER</div>
          <div style={{ width: 44 }}>REC</div>
          <div style={{ width: 60, textAlign:'right' }}>DIFF</div>
          <div style={{ width: 56, textAlign:'center' }}>FORM</div>
        </div>
        {rows.map((row, i) => (
          <React.Fragment key={row.n}>
            {row.r === 7 && (
              <div style={{ display:'flex', alignItems:'center', gap: 8, padding: '8px 8px 6px' }}>
                <div style={{ flex: 1, height: 1, background: `repeating-linear-gradient(to right, ${FH.gold} 0 4px, transparent 4px 8px)`, opacity: 0.6 }}/>
                <div style={{ fontSize: 9, color: FH.gold, fontWeight: 700, letterSpacing: 1.5 }}>PLAYOFF LINE</div>
                <div style={{ flex: 1, height: 1, background: `repeating-linear-gradient(to right, ${FH.gold} 0 4px, transparent 4px 8px)`, opacity: 0.6 }}/>
              </div>
            )}
            <div style={{
              display:'flex', alignItems:'center', padding:'10px 8px', gap: 0,
              background: row.n === 'Frankie N.' ? 'rgba(201,169,110,0.06)' : 'transparent',
              borderLeft: row.n === 'Frankie N.' ? `2px solid ${FH.gold}` : '2px solid transparent',
              borderBottom: `0.5px solid ${FH.hairline}`,
            }}>
              <div style={{ width: 20, ...T.num(13), color: row.r <= 3 ? FH.gold : FH.creamDim }}>{row.r}</div>
              <div style={{ width: 34 }}><Avatar initial={row.i} size={26}/></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: FH.cream, fontWeight: 600 }}>{row.n}</div>
                <div style={{ fontSize: 10, color: FH.creamFaint, marginTop: 1, fontVariantNumeric:'tabular-nums', letterSpacing: 0.5 }}>
                  PF {row.pf.toFixed(1)} · PA {row.pa.toFixed(1)}
                </div>
              </div>
              <div style={{ width: 44, fontSize: 13, color: color(row.w), fontWeight: 700, fontVariantNumeric:'tabular-nums' }}>{row.w}</div>
              <div style={{ width: 60, textAlign:'right', fontSize: 12, color: row.diff.startsWith('+') ? FH.win : FH.loss, fontVariantNumeric:'tabular-nums', fontWeight: 600 }}>{row.diff}</div>
              <div style={{ width: 56, display:'flex', justifyContent:'center' }}>
                <Sparkline data={row.form} w={48} h={14} color={color(row.w)} fill={false}/>
              </div>
            </div>
          </React.Fragment>
        ))}
      </div>
    </PhoneShell>
  );
}

// ────────────────────────────────────────────────
// AFTER · Intel — filled state with real signal
// ────────────────────────────────────────────────
function AfterIntel() {
  const signals = [
    { who:'tyler', roster:'QB', name:'J. Allen', change:'−3 ranks',  src:'FantasyPros', time:'2h',  tone: FH.loss, note:'QB7 → QB10 · shoulder' },
    { who:'Blake', roster:'RB', name:'B. Robinson', change:'+2 ranks', src:'Rotoworld',  time:'4h',  tone: FH.win,  note:'RB12 → RB10 · expanded role' },
    { who:'jake',  roster:'WR', name:'S. Diggs',   change:'dropped',  src:'Transaction', time:'2d',  tone: FH.loss, note:'Jake dropped him — ghost manager' },
    { who:'efuego93', roster:'TE', name:'T. Kelce', change:'TNF alert', src:'FantasyPros', time:'5h', tone: FH.tie,  note:'Expected to play limited' },
    { who:'matt', roster:'RB', name:'K. Williams', change:'+5 ranks', src:'PFF',        time:'1d',  tone: FH.win,  note:'Moved to RB1 workload' },
  ];
  return (
    <PhoneShell
      navTitle={<span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
        <span style={{ color: FH.creamDim, fontSize: 11, fontWeight: 600, letterSpacing: 1 }}>INTEL</span>
        <span style={{ fontSize: 16, fontWeight: 700 }}>BIG12</span>
        <svg width="9" height="6" viewBox="0 0 9 6"><path d="M1 1l3.5 3.5L8 1" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
      </span>}
      activeTab="Intel"
      navRight={
        <div style={{ width: 32, height: 32, borderRadius: 16, border: `0.5px solid ${FH.hairlineStrong}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" stroke={FH.cream} strokeWidth="1.6" fill="none" strokeLinecap="round"><circle cx="6" cy="6" r="4"/><path d="M9 9l3 3"/></svg>
        </div>
      }>
      <div style={{ padding: '0 16px 20px', overflow:'auto', height:'100%' }}>
        {/* better two-tab pattern */}
        <div style={{ display:'flex', gap: 24, padding: '8px 4px 14px', borderBottom: `0.5px solid ${FH.hairline}` }}>
          <div style={{ fontSize: 14, color: FH.creamDim, fontWeight: 600 }}>My team</div>
          <div style={{ fontSize: 14, color: FH.cream, fontWeight: 700, position:'relative' }}>
            Across the league
            <div style={{ position:'absolute', bottom: -14, left: 0, right: 0, height: 2, background: FH.gold }}/>
          </div>
        </div>

        {/* filter row */}
        <div style={{ display:'flex', gap: 6, padding: '14px 0 12px', overflow:'hidden' }}>
          {[{l:'All',on:true,n:12},{l:'Injuries',n:3},{l:'Waivers',n:5},{l:'Trades',n:2},{l:'Drops',n:2}].map(f => (
            <div key={f.l} style={{
              display:'flex', alignItems:'center', gap: 6,
              padding: '6px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
              background: f.on ? FH.goldFaint : 'transparent',
              color: f.on ? FH.gold : FH.creamDim,
              border: f.on ? 'none' : `0.5px solid ${FH.hairlineStrong}`,
            }}>
              {f.l}
              <span style={{ fontSize: 10, fontWeight: 700, color: f.on ? FH.gold : FH.creamFaint }}>{f.n}</span>
            </div>
          ))}
        </div>

        {/* grouped date headers */}
        <div style={{ fontSize: 10, color: FH.creamFaint, fontWeight: 700, letterSpacing: 1.2, padding: '6px 0' }}>TODAY</div>
        <div style={{ display:'flex', flexDirection:'column', gap: 8 }}>
          {signals.slice(0, 2).map((s, i) => <SignalRow key={i} s={s}/>)}
        </div>
        <div style={{ fontSize: 10, color: FH.creamFaint, fontWeight: 700, letterSpacing: 1.2, padding: '16px 0 6px' }}>EARLIER THIS WEEK</div>
        <div style={{ display:'flex', flexDirection:'column', gap: 8 }}>
          {signals.slice(2).map((s, i) => <SignalRow key={i} s={s}/>)}
        </div>
      </div>
    </PhoneShell>
  );
}

function SignalRow({ s }) {
  return (
    <Card pad={14} style={{ borderLeft: `2px solid ${s.tone}` }}>
      <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: FH.creamFaint }}>{s.roster}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: FH.cream }}>{s.name}</span>
        <span style={{ fontSize: 11, color: s.tone, fontWeight: 600 }}>· {s.change}</span>
        <span style={{ marginLeft:'auto', fontSize: 10, color: FH.creamFaint }}>{s.time}</span>
      </div>
      <div style={{ fontSize: 12, color: FH.creamDim, marginTop: 6, lineHeight: 1.4 }}>{s.note}</div>
      <div style={{ marginTop: 8, display:'flex', alignItems:'center', gap: 6 }}>
        <Avatar initial={s.who[0].toUpperCase()} size={16}/>
        <span style={{ fontSize: 10, color: FH.creamDim }}>on <span style={{ color: FH.cream, fontWeight: 600 }}>{s.who}</span>'s roster · {s.src}</span>
      </div>
    </Card>
  );
}

// ────────────────────────────────────────────────
// AFTER · AI Chat — league-aware suggestions grouped
// ────────────────────────────────────────────────
function AfterAIChat() {
  return (
    <PhoneShell navTitle="AI Chat" activeTab="AI Chat"
      navLeft={
        <div style={{ padding: '5px 10px', borderRadius: 999, background: FH.bgElev1, fontSize: 11, fontWeight: 600, color: FH.cream, display:'flex', alignItems:'center', gap: 4 }}>
          BIG12 <svg width="8" height="5" viewBox="0 0 8 5"><path d="M1 1l3 3 3-3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
        </div>
      }
      navRight={
        <div style={{ width: 32, height: 32, borderRadius: 16, border: `0.5px solid ${FH.hairlineStrong}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" stroke={FH.cream} strokeWidth="1.5" fill="none" strokeLinecap="round"><path d="M7 3v4l2.5 1.5"/><circle cx="7" cy="7" r="5"/></svg>
        </div>
      }>
      <div style={{ padding: '0 16px 20px', display:'flex', flexDirection:'column', height:'100%' }}>
        {/* hero */}
        <div style={{ textAlign:'center', padding: '18px 0 22px' }}>
          <div style={{ width: 44, height: 44, margin: '0 auto', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="34" height="34" viewBox="0 0 34 34" fill={FH.gold}>
              <path d="M17 3l2.2 5.8L25 11l-5.8 2.2L17 19l-2.2-5.8L9 11l5.8-2.2z" opacity="0.9"/>
              <path d="M26 18l1 2.5 2.5 1-2.5 1L26 25l-1-2.5-2.5-1 2.5-1z" opacity="0.6"/>
            </svg>
          </div>
          <div style={{ ...T.h1(), fontSize: 20, marginTop: 4 }}>Ask about BIG12</div>
          <div style={{ fontSize: 12, color: FH.creamDim, marginTop: 4 }}>4 seasons · 56 weeks · 12 managers indexed</div>
        </div>

        {/* category groups */}
        {[
          { t:'THIS WEEK',       c: FH.gold, q:['Should I start Jacoby Brissett or Mac Jones?', 'Who on waivers fits my RB gap?'] },
          { t:'LEAGUE HISTORY',  c: FH.info, q:['Who had the best draft ever?', 'Show the all-time records'] },
          { t:'HEAD-TO-HEAD',    c: FH.win,  q:['Compare me vs kozmania', 'Toughest opponent in 2024?'] },
        ].map((g, gi) => (
          <div key={g.t} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: g.c, fontWeight: 700, letterSpacing: 1.2, marginBottom: 8 }}>{g.t}</div>
            <div style={{ display:'flex', flexDirection:'column', gap: 6 }}>
              {g.q.map(q => (
                <div key={q} style={{
                  background: FH.bgElev1,
                  border: `0.5px solid ${FH.hairline}`,
                  padding: '11px 14px', borderRadius: 12,
                  display:'flex', alignItems:'center', gap: 10,
                }}>
                  <div style={{ flex: 1, fontSize: 13, color: FH.cream, lineHeight: 1.35 }}>{q}</div>
                  <svg width="12" height="12" viewBox="0 0 12 12" stroke={FH.gold} strokeWidth="1.6" fill="none" strokeLinecap="round"><path d="M1 6h10M7 2l4 4-4 4"/></svg>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* composer stuck to bottom */}
        <div style={{ marginTop:'auto', display:'flex', alignItems:'center', gap: 8, padding: '10px 12px', background: FH.bgElev2, borderRadius: 999, border: `0.5px solid ${FH.hairlineStrong}` }}>
          <div style={{ flex: 1, fontSize: 13, color: FH.creamFaint }}>Ask anything about your league…</div>
          <div style={{ width: 30, height: 30, borderRadius: 15, background: FH.gold, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" stroke="#1A1A1A" strokeWidth="2" fill="none" strokeLinecap="round"><path d="M7 11V3M3 7l4-4 4 4"/></svg>
          </div>
        </div>
      </div>
    </PhoneShell>
  );
}

// ────────────────────────────────────────────────
// AFTER · Profile — useful content in empty space
// ────────────────────────────────────────────────
function AfterProfile() {
  return (
    <PhoneShell navTitle="Profile" activeTab="Profile" navRight={
      <svg width="20" height="20" viewBox="0 0 20 20" stroke={FH.cream} strokeWidth="1.6" fill="none" strokeLinecap="round"><circle cx="10" cy="10" r="1.2"/><path d="M10 3.5v2M10 14.5v2M3.5 10h2M14.5 10h2M5.5 5.5l1.5 1.5M13 13l1.5 1.5M5.5 14.5L7 13M13 7l1.5-1.5"/></svg>
    }>
      <div style={{ padding: '0 16px 20px', overflow:'auto', height:'100%' }}>
        <div style={{ textAlign:'center', padding: '10px 0 18px' }}>
          <div style={{ width: 72, height: 72, borderRadius: 36, margin: '0 auto',
            background: `radial-gradient(circle at 30% 30%, rgba(201,169,110,0.35), rgba(201,169,110,0.08))`,
            display:'flex', alignItems:'center', justifyContent:'center',
            border: `1px solid ${FH.hairlineStrong}` }}>
            <span style={{ ...T.num(28), color: FH.gold }}>FN</span>
          </div>
          <div style={{ ...T.h1(), fontSize: 20, marginTop: 10 }}>Frank Nardone</div>
          <div style={{ fontSize: 12, color: FH.creamDim, marginTop: 2 }}>Commissioner · joined March 2026</div>
        </div>

        {/* career stats strip */}
        <Card pad={14}>
          <Eyebrow>CAREER · ACROSS 4 LEAGUES</Eyebrow>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 8, marginTop: 12 }}>
            {[['127–94','Record'],['57%','Win rate'],['3','Titles'],['6','Playoff apps']].map(([v, l]) => (
              <div key={l}>
                <div style={{ ...T.num(18) }}>{v}</div>
                <div style={{ fontSize: 10, color: FH.creamDim, marginTop: 3 }}>{l}</div>
              </div>
            ))}
          </div>
        </Card>

        <div style={{ marginTop: 18, display:'flex', alignItems:'center', gap: 10, marginBottom: 8 }}>
          <GoldRule/>
          <Eyebrow>CONNECTED ACCOUNTS</Eyebrow>
        </div>
        <Card pad={0}>
          {[
            { l:'Sleeper', s:'Frank · 3 leagues',  ok:true, i:'S' },
            { l:'Yahoo',   s:'fnardone@… · 1 league', ok:true, i:'Y' },
            { l:'ESPN',    s:'Coming in V2',    ok:false, i:'E' },
          ].map((a, i, arr) => (
            <div key={a.l} style={{ display:'flex', alignItems:'center', padding:'12px 14px', borderBottom: i < arr.length -1 ? `0.5px solid ${FH.hairline}` : 'none' }}>
              <Avatar initial={a.i} size={28}/>
              <div style={{ flex: 1, marginLeft: 10 }}>
                <div style={{ fontSize: 14, color: FH.cream, fontWeight: 600 }}>{a.l}</div>
                <div style={{ fontSize: 11, color: FH.creamDim, marginTop: 1 }}>{a.s}</div>
              </div>
              <div style={{ fontSize: 11, color: a.ok ? FH.win : FH.creamFaint, fontWeight: 600,
                padding: '4px 9px', borderRadius: 999,
                background: a.ok ? 'rgba(111,191,138,0.1)' : FH.bgElev2 }}>
                {a.ok ? 'Connected' : 'Soon'}
              </div>
            </div>
          ))}
        </Card>

        <div style={{ marginTop: 18, display:'flex', alignItems:'center', gap: 10, marginBottom: 8 }}>
          <GoldRule/>
          <Eyebrow>MY LEAGUES</Eyebrow>
        </div>
        {[
          { n:'BIG12',        p:'Sleeper', y:4, rec:'30–26', active:true },
          { n:'JGFF',         p:'Sleeper', y:7, rec:'56–42', active:false },
          { n:'Blakes Shoes', p:'Sleeper', y:5, rec:'38–32', active:false },
          { n:'Blake\'s Shoes', p:'Yahoo', y:14, rec:'102–96', active:false },
        ].map((lg, i, a) => (
          <div key={lg.n} style={{
            display:'flex', alignItems:'center', padding: '12px 2px',
            borderBottom: i < a.length -1 ? `0.5px solid ${FH.hairline}` : 'none',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
                <div style={{ fontSize: 14, color: FH.cream, fontWeight: 700 }}>{lg.n}</div>
                {lg.active && <span style={{ fontSize: 9, fontWeight: 700, color: FH.gold, letterSpacing: 1, padding:'2px 6px', background: FH.goldFaint, borderRadius: 999 }}>ACTIVE</span>}
              </div>
              <div style={{ fontSize: 11, color: FH.creamDim, marginTop: 2, letterSpacing: 0.2 }}>{lg.p} · {lg.y} seasons · {lg.rec}</div>
            </div>
            <svg width="7" height="12" viewBox="0 0 7 12" stroke={FH.creamFaint} strokeWidth="1.5" fill="none" strokeLinecap="round"><path d="M1 1l5 5-5 5"/></svg>
          </div>
        ))}
      </div>
    </PhoneShell>
  );
}

Object.assign(window, { AfterDashboard, AfterAnalytics, AfterStandings, AfterIntel, AfterAIChat, AfterProfile });
