// System proposals + findings artboards.

// ────────────────────────────────────────────────
// System proposal — refined design tokens for FantasyHub
// ────────────────────────────────────────────────
function SystemProposal() {
  return (
    <div style={{
      width: 820, height: 1180, background: FH.bg, color: FH.cream,
      fontFamily: FH.sans, padding: 36, boxSizing:'border-box', overflow:'hidden',
    }}>
      <div style={{ fontSize: 11, color: FH.gold, fontWeight: 700, letterSpacing: 1.5 }}>SYSTEM PROPOSAL</div>
      <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5, marginTop: 6 }}>Tighten the palette, recast the gold</div>
      <div style={{ fontSize: 13, color: FH.creamDim, marginTop: 6, maxWidth: 640, lineHeight: 1.5 }}>
        The old-gold accent is the best thing about the current design — it reads editorial, not default dark-mode. But it's currently doing eight jobs.
        Here's a tighter role assignment so it earns its weight.
      </div>

      {/* Color — old & new roles */}
      <div style={{ marginTop: 28 }}>
        <div style={{ fontSize: 11, color: FH.gold, fontWeight: 700, letterSpacing: 1.2, marginBottom: 12 }}>COLOR</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(6, 1fr)', gap: 10 }}>
          {[
            { c: FH.bg, name:'bg', hex:'#141312', note:'warmer charcoal' },
            { c: FH.bgElev1, name:'surface', hex:'#1C1A17', note:'cards' },
            { c: FH.bgElev2, name:'elev', hex:'#24211D', note:'modals' },
            { c: FH.cream, name:'text', hex:'#E8E2D6', note:'primary' },
            { c: FH.creamDim, name:'dim', hex:'62%',     note:'secondary' },
            { c: FH.creamFaint, name:'faint', hex:'38%', note:'tertiary' },
          ].map(s => (
            <div key={s.name}>
              <div style={{ width:'100%', aspectRatio:'1/1', background: s.c, borderRadius: 12, border: `0.5px solid ${FH.hairlineStrong}` }}/>
              <div style={{ fontSize: 11, fontWeight: 600, marginTop: 6 }}>{s.name}</div>
              <div style={{ fontSize: 10, color: FH.creamFaint, fontFamily: FH.display }}>{s.hex}</div>
              <div style={{ fontSize: 10, color: FH.creamDim, marginTop: 2 }}>{s.note}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Gold usage rule */}
      <div style={{ marginTop: 24, display:'grid', gridTemplateColumns:'1fr 1fr', gap: 18 }}>
        <div style={{ background: FH.bgElev1, borderRadius: 14, padding: 18, border: `0.5px solid ${FH.hairline}` }}>
          <div style={{ fontSize: 10, color: FH.loss, fontWeight: 700, letterSpacing: 1.2 }}>GOLD TODAY · 8 JOBS</div>
          <ul style={{ margin: '10px 0 0', paddingLeft: 14, fontSize: 12, color: FH.creamDim, lineHeight: 1.8 }}>
            <li>Section eyebrows (every one)</li>
            <li>"See All" links</li>
            <li>Active tab background</li>
            <li>Active nav-icon tint</li>
            <li>Badge pills (ACTIVE, Sleeper, Yahoo)</li>
            <li>Icon strokes</li>
            <li>Streak color</li>
            <li>Numeric highlight</li>
          </ul>
        </div>
        <div style={{ background: FH.bgElev1, borderRadius: 14, padding: 18, border: `0.5px solid ${FH.gold}40` }}>
          <div style={{ fontSize: 10, color: FH.gold, fontWeight: 700, letterSpacing: 1.2 }}>GOLD PROPOSED · 3 JOBS</div>
          <ul style={{ margin: '10px 0 0', paddingLeft: 14, fontSize: 12, color: FH.cream, lineHeight: 1.8 }}>
            <li><strong>Active nav & tabs.</strong> The single "where am I" cue.</li>
            <li><strong>Key numeric moments.</strong> Streaks, championships, insights.</li>
            <li><strong>Primary CTAs.</strong> Submit, Preview, Send.</li>
          </ul>
          <div style={{ marginTop: 12, fontSize: 11, color: FH.creamDim, borderTop: `0.5px solid ${FH.hairline}`, paddingTop: 10, lineHeight: 1.5 }}>
            Section eyebrows become cream/70%. Provider badges become neutral pills with the provider color as a left dot. "See All" becomes cream/dim with a chevron.
          </div>
        </div>
      </div>

      {/* Typography scale */}
      <div style={{ marginTop: 28 }}>
        <div style={{ fontSize: 11, color: FH.gold, fontWeight: 700, letterSpacing: 1.2, marginBottom: 12 }}>TYPE</div>
        <div style={{ background: FH.bgElev1, borderRadius: 14, padding: 20, border: `0.5px solid ${FH.hairline}` }}>
          <div style={{ display:'grid', gridTemplateColumns:'auto 1fr auto', gap: '14px 24px', alignItems:'baseline' }}>
            {[
              { name:'display.num', demo:<span style={T.num(40)}>103.0</span>, spec:'Fraktion Mono · 40/1 · -0.5' },
              { name:'h1',          demo:<span style={T.h1()}>You vs kozmania</span>, spec:'SF Display · 22/1.15 · 700' },
              { name:'body',        demo:<span style={T.body()}>A loss ends your win streak.</span>, spec:'SF Text · 15/1.4 · 500' },
              { name:'eyebrow',     demo:<span style={T.eyebrow()}>STREAK · ACTIVE</span>, spec:'SF Text · 11/1 · 600 · 1.2 tracking' },
              { name:'label',       demo:<span style={T.label()}>Updated 2h ago</span>, spec:'SF Text · 12/1.4 · 500 · 62% cream' },
              { name:'num.stat',    demo:<span style={{ ...T.num(18), color: FH.win }}>+7.8</span>, spec:'Fraktion Mono · tabular · 18' },
            ].map(r => (
              <React.Fragment key={r.name}>
                <div style={{ fontFamily: FH.display, fontSize: 10, color: FH.creamFaint, textAlign:'right', letterSpacing: 0.3 }}>{r.name}</div>
                <div>{r.demo}</div>
                <div style={{ fontSize: 10, color: FH.creamDim, fontFamily: FH.display }}>{r.spec}</div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Semantic */}
      <div style={{ marginTop: 24, display:'grid', gridTemplateColumns:'2fr 3fr', gap: 18 }}>
        <div>
          <div style={{ fontSize: 11, color: FH.gold, fontWeight: 700, letterSpacing: 1.2, marginBottom: 10 }}>SEMANTIC</div>
          <div style={{ display:'flex', flexDirection:'column', gap: 8 }}>
            {[
              { c: FH.win,  n:'win',  h:'#6FBF8A', note:'softer than iOS green' },
              { c: FH.loss, n:'loss', h:'#D96B6B', note:'warm red, cream-aligned' },
              { c: FH.tie,  n:'tie',  h:'#D6B461', note:'distinct from gold' },
              { c: FH.info, n:'info', h:'#7FA8C9', note:'for transactions' },
            ].map(r => (
              <div key={r.n} style={{ display:'flex', alignItems:'center', gap: 12 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: r.c }}/>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{r.n}</div>
                  <div style={{ fontSize: 10, color: FH.creamDim }}>{r.note}</div>
                </div>
                <div style={{ fontSize: 10, color: FH.creamFaint, fontFamily: FH.display }}>{r.h}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Iconography budget */}
        <div>
          <div style={{ fontSize: 11, color: FH.gold, fontWeight: 700, letterSpacing: 1.2, marginBottom: 10 }}>ICONOGRAPHY BUDGET</div>
          <div style={{ background: FH.bgElev1, borderRadius: 14, padding: 16, border: `0.5px solid ${FH.hairline}`, fontSize: 12, color: FH.creamDim, lineHeight: 1.6 }}>
            <div><strong style={{ color: FH.cream }}>Cut:</strong> emoji in headers (🏆 📅 🔥 🏟 📊), card-ornament icons that duplicate the label.</div>
            <div style={{ marginTop: 8 }}><strong style={{ color: FH.cream }}>Keep:</strong> nav-bar glyphs, semantic state (streak flame, injury cross), directional chevrons.</div>
            <div style={{ marginTop: 8 }}><strong style={{ color: FH.cream }}>Style:</strong> 1.6px stroke, currentColor only, no two-tone, 22px bounding box.</div>
          </div>

          <div style={{ display:'flex', gap: 10, marginTop: 12, color: FH.cream }}>
            {[<IconDashboard/>, <IconBars/>, <IconSignal/>, <IconChat/>, <IconProfile/>].map((ic, i) => (
              <div key={i} style={{ width: 44, height: 44, display:'flex', alignItems:'center', justifyContent:'center', background: FH.bgElev1, borderRadius: 10, border: `0.5px solid ${FH.hairline}` }}>{ic}</div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 28, fontSize: 11, color: FH.creamFaint, letterSpacing: 0.2 }}>
        Audit · April 2026 · applies across Dashboard, Analytics, Intel, AI Chat, Profile
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────
// Findings artboard — numbered critique overview (static text)
// ────────────────────────────────────────────────
function FindingsIndex() {
  const findings = [
    { n:1, s:'Dashboard', t:'No lead story', d:'Three stat cards + an import log ≠ "what happened this week." Lead with a single moment: next matchup, streak, or insight.', imp:'High' },
    { n:2, s:'Dashboard', t:'"Recent Activity" is system noise', d:'Import Complete / Season Imported are operational logs, not league news. Replace with League Pulse (trades, drops, waiver claims, lineup sets).', imp:'High' },
    { n:3, s:'Analytics', t:'KPI tiles are table stakes', d:'Seasons / Games / High / Avg are all filler numbers. Lead with an insight sentence; demote KPIs to a single mini-strip.', imp:'High' },
    { n:4, s:'Analytics', t:'H2H heatmap is cropped', d:'The most interesting visual is peeking below the fold. It deserves a directory-style "drill down" surface, not a See-all link.', imp:'Med' },
    { n:5, s:'Standings', t:'Rows are information-thin', d:'Rank, name, record, PF, PA. No streak, no form sparkline, no delta. A dense fantasy standings row should carry 2–3× the signal.', imp:'High' },
    { n:6, s:'Standings', t:'Decimals unaligned', d:'1500.1 / 1441.0 / 1426.5 don\'t form a column — they wander left/right. Switch the stat column to tabular-nums, right-aligned at the decimal.', imp:'Low' },
    { n:7, s:'Standings', t:'Playoff line is a whisper', d:'Tiny gold text in the corner. Make it a dashed gold rule across the row gap — unmistakable.', imp:'Med' },
    { n:8, s:'Intel',     t:'Empty state = broken state', d:'"Across the league" loads to "No signals match your filters" with default filters. Default filters should always return data.', imp:'Crit' },
    { n:9, s:'Intel',     t:'Filter chips overflow silently', d:'Chips clip at "Rankin" — no overflow affordance. Either horizontal-scroll with a fade, or collapse to a single Filter button.', imp:'Med' },
    { n:10, s:'League',   t:'Page is mostly empty', d:'4 KV rows + empty Managers section. This is the social heart of the product. Managers grid, season timeline, commissioner tools belong here.', imp:'High' },
    { n:11, s:'AI Chat',  t:'Suggestions are generic', d:'"Compare two managers" / "What were the biggest trades?" reads like any LLM zero-state. Use specific names pulled from this league ("Compare me vs kozmania").', imp:'Med' },
    { n:12, s:'Profile',  t:'No career stats', d:'You\'ve indexed 4+ leagues of history for this user but show only avatar + name + connected accounts. Career record across all leagues belongs here.', imp:'Med' },
    { n:13, s:'System',   t:'Gold is overloaded', d:'Section eyebrows + active tab + icon strokes + links + badges + streaks all use gold. When everything is gold, nothing is. Reserve for 3 jobs.', imp:'High' },
    { n:14, s:'System',   t:'Numerals aren\'t tabular', d:'Switch stat columns to a tabular/monospaced variant so rows line up at the decimal.', imp:'Low' },
    { n:15, s:'System',   t:'Emoji leaks into pro UI', d:'🏆📅🔥🏟📊 appear in headers. Replace with the same 1.6px stroke icon set for consistency.', imp:'Low' },
  ];
  const impColor = { Crit: FH.loss, High: FH.gold, Med: FH.info, Low: FH.creamDim };
  return (
    <div style={{
      width: 820, height: 1180, background: FH.bg, color: FH.cream,
      fontFamily: FH.sans, padding: 36, boxSizing:'border-box', overflow:'hidden',
    }}>
      <div style={{ fontSize: 11, color: FH.gold, fontWeight: 700, letterSpacing: 1.5 }}>AUDIT · 15 FINDINGS</div>
      <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5, marginTop: 6 }}>What's holding FantasyHub back</div>
      <div style={{ fontSize: 13, color: FH.creamDim, marginTop: 6, maxWidth: 640, lineHeight: 1.5 }}>
        Grouped by screen then severity. The pins on the "before" artboards above correspond to the numbers here.
      </div>

      <div style={{ marginTop: 24, display:'grid', gridTemplateColumns:'auto 1fr auto', columnGap: 20, rowGap: 0 }}>
        <div style={{ ...T.eyebrow(FH.creamFaint), padding:'8px 0', borderBottom: `0.5px solid ${FH.hairline}` }}>#</div>
        <div style={{ ...T.eyebrow(FH.creamFaint), padding:'8px 0', borderBottom: `0.5px solid ${FH.hairline}` }}>FINDING</div>
        <div style={{ ...T.eyebrow(FH.creamFaint), padding:'8px 0', borderBottom: `0.5px solid ${FH.hairline}`, textAlign:'right' }}>IMPACT</div>
        {findings.map(f => (
          <React.Fragment key={f.n}>
            <div style={{ padding:'14px 0', borderBottom: `0.5px solid ${FH.hairline}`, ...T.num(14), color: FH.creamFaint, alignSelf:'start' }}>{String(f.n).padStart(2,'0')}</div>
            <div style={{ padding:'14px 0', borderBottom: `0.5px solid ${FH.hairline}` }}>
              <div style={{ display:'flex', alignItems:'baseline', gap: 10 }}>
                <div style={{ fontSize: 10, color: FH.gold, fontWeight: 700, letterSpacing: 1, width: 72 }}>{f.s.toUpperCase()}</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: FH.cream }}>{f.t}</div>
              </div>
              <div style={{ fontSize: 12, color: FH.creamDim, marginTop: 4, lineHeight: 1.5, paddingLeft: 82 }}>{f.d}</div>
            </div>
            <div style={{ padding:'14px 0', borderBottom: `0.5px solid ${FH.hairline}`, alignSelf:'start' }}>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: 0.8,
                color: impColor[f.imp], padding:'3px 8px', borderRadius: 999,
                background: `${impColor[f.imp]}1a`, border: `0.5px solid ${impColor[f.imp]}33`,
              }}>{f.imp.toUpperCase()}</span>
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { SystemProposal, FindingsIndex });
