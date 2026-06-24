// "Before" screen recreations — minimal fidelity to the current app so we
// can pin critiques on them. Kept deliberately simple.

// Current dashboard (BIG12)
function BeforeDashboard() {
  return (
    <PhoneShell navTitle={<span style={{ display:'inline-flex', alignItems:'center', gap:4 }}>BIG12 <svg width="10" height="6" viewBox="0 0 10 6"><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg></span>} activeTab="Dashboard">
      <div style={{ padding: '8px 16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* league chip card */}
        <Card pad={16}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.3 }}>BIG12</div>
            <div style={{ fontSize: 10, fontWeight: 600, padding: '3px 9px', borderRadius: 999, background: FH.goldFaint, color: FH.gold }}>Sleeper</div>
          </div>
          <div style={{ display: 'flex', gap: 20, marginTop: 12 }}>
            <div><div style={{ fontSize: 18, fontWeight: 700 }}>12</div><div style={{ fontSize: 10, color: FH.creamDim }}>Teams</div></div>
            <div><div style={{ fontSize: 18, fontWeight: 700 }}>4</div><div style={{ fontSize: 10, color: FH.creamDim }}>Seasons</div></div>
            <div><div style={{ fontSize: 18, fontWeight: 700 }}>HALF_PPR</div><div style={{ fontSize: 10, color: FH.creamDim }}>Scoring</div></div>
          </div>
        </Card>

        {/* streak card with left gold border */}
        <Card pad={14} style={{ borderLeft: `3px solid ${FH.gold}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <Eyebrow icon={<svg width="11" height="11" viewBox="0 0 11 11" fill={FH.gold}><path d="M5.5 1C3 3 2 5 2 7a3.5 3.5 0 107 0c0-1-1-2-1-3 0 2-1 2-1 2s0-2-1.5-5z"/></svg>}>STREAK</Eyebrow>
              <div style={{ marginTop: 6, fontSize: 14, color: FH.cream, lineHeight: 1.35 }}>You've won <span style={{ color: FH.gold, fontWeight: 700 }}>6 straight</span><br/>against kozmania</div>
              <div style={{ marginTop: 4, fontSize: 11, color: FH.creamDim }}>Active winning streak</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ ...T.num(22), color: FH.gold }}>6–0</div>
              <div style={{ fontSize: 10, color: FH.creamDim, marginTop: 2 }}>Last 6</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 12 }}>
            {[0,1,2,3,4,5,6,7].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: 3, background: i === 0 ? FH.gold : FH.creamFaint }}/>)}
          </div>
        </Card>

        {/* record block */}
        <Card pad={16}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ ...T.num(24) }}>30–26–0</div>
              <div style={{ fontSize: 10, color: FH.creamDim, marginTop: 2 }}>All-Time Record</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ ...T.num(22), color: FH.creamFaint }}>54%</div>
              <div style={{ fontSize: 10, color: FH.creamFaint, marginTop: 2 }}>Win Rate</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 20, marginTop: 14 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ color: FH.gold, fontSize: 14 }}>🏆🏆</span>
              <div><div style={{ ...T.num(15) }}>2</div><div style={{ fontSize: 10, color: FH.creamDim }}>Championships</div></div>
            </div>
            <div><div style={{ ...T.num(15) }}>4</div><div style={{ fontSize: 10, color: FH.creamDim }}>Playoff Apps</div></div>
          </div>
          <div style={{ display: 'flex', gap: 20, marginTop: 10 }}>
            <div><div style={{ ...T.num(22), color: FH.win }}>103.0</div><div style={{ fontSize: 10, color: FH.creamDim }}>Your PPG</div></div>
            <div><div style={{ ...T.num(18), color: FH.creamFaint }}>95.1</div><div style={{ fontSize: 10, color: FH.creamFaint }}>League Avg</div></div>
            <div><div style={{ ...T.num(18), color: FH.win }}>+7.8</div><div style={{ fontSize: 10, color: FH.creamDim }}>vs Avg</div></div>
          </div>
          <div style={{ marginTop: 10 }}>
            <Sparkline data={[80,92,101,88,95,110,102,86,98,112,104,90,99,108,103,89,96,111,102,107]} w={322} h={34} color={FH.loss} fill/>
            <div style={{ textAlign: 'center', fontSize: 10, color: FH.creamFaint, marginTop: -14 }}>Last 20 weeks</div>
          </div>
        </Card>

        <Eyebrow>YOUR LEGACY</Eyebrow>
        <div style={{ display: 'flex', gap: 10, overflow: 'hidden' }}>
          {['BOOM OR BUST', 'PLAYOFF MACHINE', 'DYNASTY'].map((t, i) => (
            <Card key={t} pad={12} style={{ minWidth: 130 }}>
              <div style={{ fontSize: 10, color: FH.gold, fontWeight: 700, letterSpacing: 0.8 }}>{t}</div>
              <div style={{ ...T.num(18), marginTop: 6, color: FH.creamFaint }}>σ = 24.8</div>
            </Card>
          ))}
        </div>
      </div>
    </PhoneShell>
  );
}

// Current analytics (All-Time)
function BeforeAnalytics() {
  const kpis = [
    { icon:'📅', v:'4', l:'Seasons' },
    { icon:'🏟', v:'784', l:'Total Games' },
    { icon:'🔥', v:'175.9', l:'All-Time High' },
    { icon:'📊', v:'95.1', l:'Avg PPG' },
  ];
  const standings = [
    ['1','JimmyTea','12–2'],['2','Alxrao','11–3'],['3','bdel4','9–5'],['4','Jahelbeatz5','8–6'],['5','klensch9','7–7']
  ];
  return (
    <PhoneShell navTitle="Analytics" activeTab="Analytics">
      <div style={{ padding: '4px 16px 20px', display:'flex', flexDirection:'column', gap: 14 }}>
        <div style={{ display:'flex', gap: 8, overflow:'hidden' }}>
          {['All-Time','2025','2024','2023','2022'].map((y, i) => (
            <div key={y} style={{
              padding: '7px 14px', borderRadius: 999,
              background: i === 0 ? FH.gold : 'transparent',
              color: i === 0 ? '#1A1A1A' : FH.creamDim,
              border: i === 0 ? 'none' : `0.5px solid ${FH.hairlineStrong}`,
              fontSize: 12, fontWeight: 700, letterSpacing: 0.2,
            }}>{y}</div>
          ))}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 10 }}>
          {kpis.map(k => (
            <Card key={k.l} pad={16} style={{ textAlign:'center' }}>
              <div style={{ fontSize: 18, color: FH.gold, opacity: .8 }}>{k.icon}</div>
              <div style={{ ...T.num(30), marginTop: 10 }}>{k.v}</div>
              <div style={{ fontSize: 11, color: FH.creamDim, marginTop: 4 }}>{k.l}</div>
            </Card>
          ))}
        </div>

        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingBottom: 8, borderBottom: `0.5px solid ${FH.gold}40` }}>
            <Eyebrow icon={<svg width="12" height="12" viewBox="0 0 12 12" stroke={FH.gold} strokeWidth="1.6" fill="none"><path d="M2 3h8M2 6h5M2 9h7"/></svg>}>STANDINGS &amp; RANKINGS</Eyebrow>
            <div style={{ fontSize: 11, color: FH.gold, fontWeight: 600 }}>See All</div>
          </div>
          <Card pad={0} style={{ marginTop: 8 }}>
            {standings.map((r, i) => (
              <div key={r[1]} style={{ display:'flex', alignItems:'center', padding:'12px 14px', borderBottom: i < 4 ? `0.5px solid ${FH.hairline}` : 'none' }}>
                <div style={{ width: 20, color: FH.creamDim, fontSize: 13 }}>{r[0]}</div>
                <div style={{ flex: 1, fontSize: 14 }}>{r[1]}</div>
                <div style={{ ...T.num(14) }}>{r[2]}</div>
              </div>
            ))}
          </Card>
        </div>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingBottom: 8, borderBottom: `0.5px solid ${FH.gold}40` }}>
          <Eyebrow icon={<svg width="12" height="12" viewBox="0 0 12 12" stroke={FH.gold} strokeWidth="1.6" fill="none"><path d="M2 4h7l-1.5-1.5M10 8H3l1.5 1.5"/></svg>}>HEAD-TO-HEAD</Eyebrow>
          <div style={{ fontSize: 11, color: FH.gold, fontWeight: 600 }}>See All</div>
        </div>
      </div>
    </PhoneShell>
  );
}

// Current standings
function BeforeStandings() {
  const rows = [
    ['1','T','tyler','9–5–0','1500.1','1346.4',FH.win],
    ['2','B','Blake','8–6–0','1563.5','1441.0',FH.win],
    ['3','E','efuego93','9–5–0','1529.3','1426.5',FH.win],
    ['4','F','Frankie N.','9–5–0','1481.3','1331.7',FH.win],
    ['5','M','matt','8–6–0','1469.4','1550.5',FH.win],
    ['6','J','jake','7–7–0','1508.9','1574.7',FH.creamDim],
    ['7','B','Bryan Yat.','6–8–0','1586.9','1496.5',FH.loss],
    ['8','R','Ryan Curr.','6–8–0','1447.7','1618.0',FH.loss],
    ['9','P','Peter','5–9–0','1354.3','1502.9',FH.loss],
    ['10','A','AB','6–8–0','1348.0','1413.0',FH.loss],
    ['11','R','Ryan','2–12–0','1243.7','1518.9',FH.loss],
  ];
  return (
    <PhoneShell navTitle="Standings" activeTab="Analytics" navLeft={
      <div style={{ width: 32, height: 32, borderRadius: 16, background: FH.bgElev1, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <svg width="12" height="12" viewBox="0 0 12 12" stroke={FH.cream} strokeWidth="1.8" fill="none" strokeLinecap="round"><path d="M8 2L3 6l5 4"/></svg>
      </div>
    }>
      <div style={{ padding: '8px 16px 0' }}>
        <div style={{ display:'flex', background: FH.bgElev1, borderRadius: 10, padding: 3, gap: 3 }}>
          <div style={{ flex:1, textAlign:'center', padding:'9px 10px', borderRadius: 8, background:'#fff', color:'#1A1A1A', fontSize: 13, fontWeight: 600 }}>Standings</div>
          <div style={{ flex:1, textAlign:'center', padding:'9px 10px', fontSize: 13, color: FH.creamDim, fontWeight: 600 }}>Power Rankings</div>
        </div>
        <div style={{ display:'flex', padding:'18px 4px 8px', fontSize: 10, color: FH.creamFaint, fontWeight: 600, letterSpacing: 1 }}>
          <div style={{ width: 20 }}>#</div>
          <div style={{ flex: 1, paddingLeft: 30 }}>MANAGER</div>
          <div style={{ width: 56 }}>W-L-T</div>
          <div style={{ width: 46, textAlign:'right' }}>PF</div>
          <div style={{ width: 46, textAlign:'right' }}>PA</div>
        </div>
        {rows.map((r, i) => (
          <div key={r[2]} style={{
            display:'flex', alignItems:'center', padding:'10px 4px',
            borderBottom: `0.5px solid ${FH.hairline}`,
            position:'relative',
          }}>
            {i === 4 && <div style={{ position:'absolute', bottom: -1, right: 0, fontSize: 8, color: FH.gold, fontWeight: 700, letterSpacing: 1 }}>PLAYOFF LINE</div>}
            <div style={{ width: 20, color: FH.creamDim, fontSize: 13 }}>{r[0]}</div>
            <Avatar initial={r[1]} size={26}/>
            <div style={{ flex:1, paddingLeft: 8, fontSize: 14 }}>{r[2]}</div>
            <div style={{ width: 56, fontSize: 13, color: r[6], fontWeight: 600 }}>{r[3]}</div>
            <div style={{ width: 46, fontSize: 13, color: FH.cream, textAlign:'right', fontVariantNumeric:'tabular-nums' }}>{r[4]}</div>
            <div style={{ width: 46, fontSize: 13, color: FH.creamDim, textAlign:'right', fontVariantNumeric:'tabular-nums' }}>{r[5]}</div>
          </div>
        ))}
      </div>
    </PhoneShell>
  );
}

// Current intel (across the league - empty state)
function BeforeIntel() {
  return (
    <PhoneShell navTitle={<span style={{ display:'inline-flex', alignItems:'center', gap:4 }}>BIG12 <svg width="10" height="6" viewBox="0 0 10 6"><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg></span>}
      activeTab="Intel" navRight={
        <div style={{ width: 32, height: 32, borderRadius: 16, border: `0.5px solid ${FH.hairlineStrong}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" stroke={FH.cream} strokeWidth="1.6" fill="none" strokeLinecap="round"><circle cx="6" cy="6" r="4"/><path d="M9 9l3 3"/></svg>
        </div>
      }>
      <div style={{ padding: '8px 16px 20px' }}>
        <div style={{ display:'flex', background: FH.bgElev1, borderRadius: 10, padding: 3, gap: 3 }}>
          <div style={{ flex:1, textAlign:'center', padding:'9px 10px', fontSize: 11, color: FH.creamDim, letterSpacing: 1.5, fontWeight: 700 }}>MY TEAM</div>
          <div style={{ flex:1, textAlign:'center', padding:'9px 10px', borderRadius: 8, background: FH.gold, color:'#1A1A1A', fontSize: 11, letterSpacing: 1.5, fontWeight: 700 }}>ACROSS THE LEAGUE</div>
        </div>
        <div style={{ display:'flex', gap: 8, marginTop: 14, overflow:'hidden' }}>
          {[{l:'My Team',on:true},{l:'QB',on:true},{l:'RB'},{l:'WR'},{l:'TE'},{l:'K'},{l:'Rankin'}].map(f => (
            <div key={f.l} style={{
              padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600,
              background: f.on ? FH.goldFaint : 'transparent',
              color: f.on ? FH.gold : FH.creamDim,
              border: f.on ? 'none' : `0.5px solid ${FH.hairlineStrong}`,
            }}>{f.l}</div>
          ))}
        </div>
        <Card pad={16} style={{ marginTop: 14, display:'flex', alignItems:'center', gap: 10 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" stroke={FH.creamDim} strokeWidth="1.5" fill="none" strokeLinecap="round"><path d="M5 5c-1 1-1.5 2-1.5 3s.5 2 1.5 3M11 5c1 1 1.5 2 1.5 3s-.5 2-1.5 3"/><circle cx="8" cy="8" r="1" fill={FH.creamDim}/></svg>
          <div style={{ fontSize: 13, color: FH.creamDim }}>No signals match your filters</div>
        </Card>
        <div style={{ height: 380 }}/>
      </div>
    </PhoneShell>
  );
}

Object.assign(window, { BeforeDashboard, BeforeAnalytics, BeforeStandings, BeforeIntel });
