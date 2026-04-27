// Today's Briefing — three synthesis-style variations for Intel > My team.
// All share the same top-of-screen shell (league pill, title, tab) so the
// variations are purely about how AI-synthesized takeaways are presented.

// ─── Shared: Intel shell ──────────────────────────────────────────────
function IntelShell({ children, activeTab = 'My team' }) {
  return (
    <PhoneShell
      navTitle={
        <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
          <span style={{ color: FH.creamDim, fontSize: 11, fontWeight: 600, letterSpacing: 1 }}>INTEL</span>
          <span style={{ fontSize: 16, fontWeight: 700 }}>BIG12</span>
          <svg width="9" height="6" viewBox="0 0 9 6"><path d="M1 1l3.5 3.5L8 1" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
        </span>
      }
      activeTab="Intel"
      navRight={
        <div style={{ width: 32, height: 32, borderRadius: 16, border: `0.5px solid ${FH.hairlineStrong}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" stroke={FH.cream} strokeWidth="1.6" fill="none" strokeLinecap="round"><circle cx="6" cy="6" r="4"/><path d="M9 9l3 3"/></svg>
        </div>
      }>
      <div style={{ overflow:'auto', height:'100%' }}>
        {/* under-nav tabs */}
        <div style={{ display:'flex', gap: 24, padding: '6px 20px 14px', borderBottom: `0.5px solid ${FH.hairline}` }}>
          {['My team', 'Across the league'].map(t => (
            <div key={t} style={{ position:'relative', fontSize: 14, fontWeight: 700, color: t === activeTab ? FH.cream : FH.creamDim }}>
              {t}
              {t === activeTab && <div style={{ position:'absolute', left: 0, right: 0, bottom: -14, height: 2, background: FH.gold }}/>}
            </div>
          ))}
        </div>
        {children}
      </div>
    </PhoneShell>
  );
}

// ─── Source glyph (stroke only, inherits color) ───────────────────────
const SrcGlyph = ({ kind, size = 11 }) => {
  const s = { stroke: 'currentColor', strokeWidth: 1.4, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (kind) {
    case 'injury':  return <svg width={size} height={size} viewBox="0 0 12 12" {...s}><path d="M5 1v4H1v2h4v4h2V7h4V5H7V1z"/></svg>;
    case 'rank':    return <svg width={size} height={size} viewBox="0 0 12 12" {...s}><path d="M2 9l3-3 2 2 3-4"/><path d="M9 2h1v2"/></svg>;
    case 'startsit':return <svg width={size} height={size} viewBox="0 0 12 12" {...s}><path d="M2 3h7l-2-2M10 9H3l2 2"/></svg>;
    case 'reddit':  return <svg width={size} height={size} viewBox="0 0 12 12" {...s}><circle cx="6" cy="7" r="4"/><circle cx="3" cy="5" r="1"/><circle cx="9" cy="5" r="1"/><path d="M4 8c.8.7 1.3 1 2 1s1.2-.3 2-1"/></svg>;
    case 'twitter': return <svg width={size} height={size} viewBox="0 0 12 12" {...s}><path d="M1 2l4 5-4 3M5 2h2l4 8h-2z"/></svg>;
    case 'news':    return <svg width={size} height={size} viewBox="0 0 12 12" {...s}><rect x="1" y="2" width="8" height="8" rx="1"/><path d="M3 4h4M3 6h4M3 8h3M9 5h2v4a1 1 0 01-1 1"/></svg>;
    default:        return null;
  }
};

// Source pill: tiny corner tag
function SourcePill({ kind, label, tone = FH.creamDim }) {
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap: 4,
      padding:'2px 7px', borderRadius: 999,
      background: 'rgba(232,226,214,0.06)', border: `0.5px solid ${FH.hairline}`,
      fontSize: 10, fontWeight: 600, color: tone, letterSpacing: 0.2,
    }}>
      <span style={{ display:'flex', color: tone }}><SrcGlyph kind={kind} size={10}/></span>
      {label}
    </span>
  );
}

// Confidence chip (dot scale)
function Confidence({ n, max = 4, tone = FH.gold }) {
  return (
    <span style={{ display:'inline-flex', gap: 2, alignItems:'center' }}>
      {[...Array(max)].map((_, i) => (
        <span key={i} style={{
          width: 5, height: 5, borderRadius: 3,
          background: i < n ? tone : FH.hairlineStrong,
        }}/>
      ))}
    </span>
  );
}

// Consolidated briefing data, shared across variations
const BRIEFING = {
  league: 'BIG12',
  week: 14,
  wx: { kickoff: 'Sun 1:00 PM', matchup: 'kozmania', winProb: 78 },
  items: [
    {
      tag: 'SIT',
      tone: FH.loss,
      player: 'Mac Jones', slot: 'QB', team: 'SF',
      headline: 'Sit Mac Jones — stream Brissett instead',
      why: 'Consensus ranks dropped Mac to QB34 overnight after Shanahan hinted at a shortened leash; Brissett projects +6.2 in a home PPR matchup vs ARI.',
      delta: '−6.2 pts',
      sources: [
        { kind:'rank',    label:'FantasyPros · QB34 (−9)' },
        { kind:'twitter', label:'@JeffHowe · "leashed"' },
        { kind:'startsit',label:'ESPN Start/Sit' },
      ],
      confidence: 4,
      spark: [28, 32, 29, 34, 33, 34, 34],
    },
    {
      tag: 'ADD',
      tone: FH.win,
      player: 'Brandon Aubrey', slot: 'K', team: 'DAL',
      headline: 'Grab Aubrey — streaming K with a Week 14 ceiling',
      why: 'Trending in 47% of Sleeper leagues. Beat writers expect 4+ attempts vs CIN; r/fantasyfootball "waiver darling" post has 3.1k upvotes.',
      delta: '+3.4 pts',
      sources: [
        { kind:'rank',    label:'FantasyPros · K4' },
        { kind:'reddit',  label:'r/ff · 3.1k ↑' },
        { kind:'twitter', label:'@ToddArcher' },
      ],
      confidence: 3,
      spark: [6, 7, 8, 10, 11, 12, 14],
    },
    {
      tag: 'WATCH',
      tone: FH.tie,
      player: 'Garrett Wilson', slot: 'WR', team: 'NYJ',
      headline: 'Garrett Wilson questionable — monitor Friday',
      why: 'Limited Wed/Thu with a hamstring. Practice report expected by 3pm Fri. If out, Allen Lazard absorbs 8+ targets.',
      delta: 'TBD',
      sources: [
        { kind:'injury',  label:'Questionable' },
        { kind:'news',    label:'NFL Network' },
        { kind:'twitter', label:'@RichCimini' },
      ],
      confidence: 2,
      spark: [22, 24, 20, 23, 18, 16, 17],
    },
  ],
};

// ─── Variation A · EDITORIAL ─────────────────────────────────────────
// A sports-section feel. One lead item, then two "briefs" under it.
// Photographic feel via warm gradient plates, serif-ish display via
// large SF Display, calm hierarchy.
function BriefingEditorial() {
  const [lead, ...rest] = BRIEFING.items;
  return (
    <IntelShell>
      <div style={{ padding: '14px 16px 24px' }}>
        {/* masthead */}
        <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
          <div style={{ width: 22, height: 22, borderRadius: 11, background: FH.gold, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="#1A1A1A"><path d="M5 0l1.3 3.4L10 5l-3.7 1.6L5 10 3.7 6.6 0 5l3.7-1.6z"/></svg>
          </div>
          <div style={{ fontSize: 11, color: FH.gold, fontWeight: 700, letterSpacing: 1.4 }}>TODAY&apos;S BRIEFING · THU · WEEK 14</div>
        </div>
        <div style={{ marginTop: 10, fontSize: 24, fontWeight: 700, color: FH.cream, letterSpacing: -0.4, lineHeight: 1.2 }}>
          Three things <span style={{ color: FH.gold }}>your roster</span> needs from you today.
        </div>
        <div style={{ marginTop: 6, fontSize: 12, color: FH.creamDim, lineHeight: 1.5 }}>
          Synthesized at 9:14am from <strong style={{ color: FH.cream, fontWeight: 600 }}>47 signals</strong> across FantasyPros, ESPN, Rotoworld, r/fantasyfootball, and 12 beat reporters.
        </div>

        {/* LEAD item — full-bleed card with headline typography */}
        <div style={{
          marginTop: 20, borderRadius: 20, overflow:'hidden',
          background: `linear-gradient(145deg, rgba(217,107,107,0.16) 0%, rgba(28,26,23,1) 55%)`,
          border: `0.5px solid ${FH.hairlineStrong}`,
        }}>
          <div style={{ padding: '18px 20px 14px' }}>
            <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
              <span style={{
                fontSize: 10, fontWeight: 800, letterSpacing: 1.5,
                color: '#1A1A1A', background: lead.tone, padding:'3px 8px', borderRadius: 4,
              }}>{lead.tag}</span>
              <span style={{ fontSize: 10, color: FH.creamDim, fontWeight: 600, letterSpacing: 0.4 }}>{lead.slot} · {lead.team}</span>
              <span style={{ marginLeft:'auto' }}><Confidence n={lead.confidence}/></span>
            </div>
            <div style={{ marginTop: 10, fontSize: 20, fontWeight: 700, color: FH.cream, letterSpacing: -0.3, lineHeight: 1.25 }}>
              {lead.headline}
            </div>
            <div style={{ marginTop: 8, fontSize: 13, color: FH.creamDim, lineHeight: 1.5 }}>
              {lead.why}
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap: 6, marginTop: 12 }}>
              {lead.sources.map((s, i) => <SourcePill key={i} {...s}/>)}
            </div>
            <div style={{ display:'flex', alignItems:'center', gap: 10, marginTop: 14, paddingTop: 12, borderTop: `0.5px solid ${FH.hairline}` }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: FH.creamFaint, fontWeight: 600, letterSpacing: 0.5 }}>PROJECTED IMPACT</div>
                <div style={{ ...T.num(20), color: lead.tone, marginTop: 3 }}>{lead.delta}</div>
              </div>
              <div style={{ padding: '10px 16px', borderRadius: 10, background: FH.gold, color:'#1A1A1A', fontSize: 12, fontWeight: 700, letterSpacing: 0.2 }}>
                Apply change →
              </div>
            </div>
          </div>
        </div>

        {/* Rest — lighter brief format */}
        {rest.map((it, i) => (
          <div key={it.player} style={{ marginTop: 14, display:'flex', gap: 12 }}>
            <div style={{
              width: 36, flexShrink: 0, display:'flex', flexDirection:'column', alignItems:'center', paddingTop: 2,
            }}>
              <div style={{ ...T.num(26), color: it.tone, fontWeight: 600 }}>{String(i + 2).padStart(2,'0')}</div>
              <div style={{ width: 1, flex: 1, background: FH.hairline, marginTop: 4 }}/>
            </div>
            <div style={{ flex: 1, paddingBottom: 10 }}>
              <div style={{ display:'flex', alignItems:'center', gap: 6 }}>
                <span style={{
                  fontSize: 9, fontWeight: 800, letterSpacing: 1.3,
                  color: it.tone, padding:'1px 6px', borderRadius: 3,
                  border: `0.5px solid ${it.tone}66`,
                }}>{it.tag}</span>
                <span style={{ fontSize: 10, color: FH.creamFaint, fontWeight: 600, letterSpacing: 0.5 }}>{it.slot} · {it.team}</span>
                <span style={{ marginLeft:'auto', fontSize: 11, color: it.tone, fontWeight: 700, fontVariantNumeric:'tabular-nums' }}>{it.delta}</span>
              </div>
              <div style={{ marginTop: 4, fontSize: 15, fontWeight: 600, color: FH.cream, lineHeight: 1.3 }}>
                {it.headline}
              </div>
              <div style={{ marginTop: 4, fontSize: 12, color: FH.creamDim, lineHeight: 1.45 }}>
                {it.why}
              </div>
              <div style={{ display:'flex', gap: 6, marginTop: 8, flexWrap:'wrap' }}>
                {it.sources.slice(0,2).map((s, j) => <SourcePill key={j} {...s}/>)}
                <span style={{ fontSize: 10, color: FH.creamFaint, alignSelf:'center' }}>+{it.sources.length - 2} more</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </IntelShell>
  );
}

// ─── Variation B · SCORECARD ─────────────────────────────────────────
// Dense, numbers-first. Each takeaway is a card with a big delta number,
// a 7-day signal line, and source strips. Feels like a trading dashboard.
function BriefingScorecard() {
  return (
    <IntelShell>
      <div style={{ padding: '14px 16px 24px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize: 10, color: FH.gold, fontWeight: 700, letterSpacing: 1.4 }}>TODAY&apos;S BRIEFING</div>
            <div style={{ marginTop: 4, fontSize: 18, fontWeight: 700, color: FH.cream, letterSpacing: -0.2 }}>
              Your roster in 3 moves
            </div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ ...T.num(22), color: FH.gold }}>+1.6</div>
            <div style={{ fontSize: 9, color: FH.creamFaint, letterSpacing: 0.4, marginTop: 2 }}>NET PROJ. DELTA</div>
          </div>
        </div>

        {/* confidence + sources summary row */}
        <div style={{
          marginTop: 12, padding: '10px 12px',
          background: FH.bgElev1, border: `0.5px solid ${FH.hairline}`, borderRadius: 10,
          display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap: 12,
        }}>
          {[
            ['47', 'signals'],
            ['12', 'sources'],
            ['9:14a','synced'],
          ].map(([v,l]) => (
            <div key={l}>
              <div style={{ ...T.num(14) }}>{v}</div>
              <div style={{ fontSize: 9, color: FH.creamFaint, letterSpacing: 0.5, marginTop: 2 }}>{l.toUpperCase()}</div>
            </div>
          ))}
        </div>

        {BRIEFING.items.map((it) => (
          <Card key={it.player} pad={0} style={{ marginTop: 12, overflow:'hidden' }}>
            {/* top band: tag + player + delta */}
            <div style={{ display:'flex', alignItems:'stretch' }}>
              <div style={{
                width: 52, background: it.tone, color:'#1A1A1A',
                display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                padding: '10px 0',
              }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.2 }}>{it.tag}</div>
                <div style={{ fontSize: 9, fontWeight: 700, marginTop: 2, opacity: 0.8 }}>{it.slot}</div>
              </div>
              <div style={{ flex: 1, padding: '10px 14px' }}>
                <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between' }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: FH.cream, lineHeight: 1.1 }}>{it.player}</div>
                    <div style={{ fontSize: 10, color: FH.creamDim, marginTop: 2, letterSpacing: 0.3 }}>{it.team} · {it.slot}</div>
                  </div>
                  <div style={{ ...T.num(20), color: it.tone }}>{it.delta}</div>
                </div>
              </div>
            </div>

            {/* body: headline + why + spark */}
            <div style={{ padding: '12px 14px 0' }}>
              <div style={{ fontSize: 13, color: FH.cream, fontWeight: 600, lineHeight: 1.35 }}>{it.headline}</div>
              <div style={{ fontSize: 11, color: FH.creamDim, marginTop: 5, lineHeight: 1.45 }}>{it.why}</div>
            </div>

            {/* signal strip — 7 day ranking movement + sources */}
            <div style={{ padding: '12px 14px', display:'flex', alignItems:'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, color: FH.creamFaint, letterSpacing: 0.5, marginBottom: 4 }}>RANK · 7D</div>
                <Sparkline data={it.spark} w={110} h={22} color={it.tone} fill/>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, color: FH.creamFaint, letterSpacing: 0.5, marginBottom: 4 }}>CONFIDENCE</div>
                <div style={{ display:'flex', alignItems:'center', gap: 6 }}>
                  <Confidence n={it.confidence} tone={it.tone}/>
                  <span style={{ fontSize: 11, color: FH.creamDim, fontWeight: 600 }}>{['Low','Low','Med','High','Very high'][it.confidence]}</span>
                </div>
              </div>
            </div>

            {/* sources row */}
            <div style={{ padding: '0 14px 12px', display:'flex', gap: 6, flexWrap:'wrap' }}>
              {it.sources.map((s, i) => <SourcePill key={i} {...s}/>)}
            </div>

            {/* actions footer */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', borderTop: `0.5px solid ${FH.hairline}` }}>
              <div style={{ padding: 11, textAlign:'center', fontSize: 12, color: FH.creamDim, fontWeight: 600 }}>Details</div>
              <div style={{ padding: 11, textAlign:'center', fontSize: 12, color: FH.gold, fontWeight: 700, borderLeft: `0.5px solid ${FH.hairline}` }}>Apply →</div>
            </div>
          </Card>
        ))}
      </div>
    </IntelShell>
  );
}

// ─── Variation C · NARRATIVE STREAM ──────────────────────────────────
// Paragraph-forward. Reads like a manager reviewing your team at a chalkboard.
// Name callouts are inline anchors; source citations sit below each paragraph
// like footnotes.
function BriefingNarrative() {
  return (
    <IntelShell>
      <div style={{ padding: '16px 16px 24px' }}>
        <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
          <div style={{ fontSize: 11, color: FH.gold, fontWeight: 700, letterSpacing: 1.4 }}>TODAY&apos;S BRIEFING · 9:14 AM</div>
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap: 6, fontSize: 10, color: FH.creamDim }}>
            <span style={{ width: 6, height: 6, borderRadius: 3, background: FH.win }}/>
            Fresh
          </div>
        </div>

        <div style={{ marginTop: 12, fontSize: 19, color: FH.cream, fontWeight: 500, letterSpacing: -0.3, lineHeight: 1.4 }}>
          Your week comes down to <InlineRef tone={FH.loss}>Mac Jones</InlineRef>. If you start him, you&apos;re betting on a short leash — if you sit him, <InlineRef tone={FH.gold}>Brissett</InlineRef> is the cleanest stream you&apos;ve had in three weeks.
        </div>

        {/* Paragraph 1 — the Mac Jones verdict */}
        <Paragraph
          badge="SIT"
          tone={FH.loss}
          label="QB · 49ers"
          body={<>The consensus dropped <InlineRef tone={FH.loss}>Mac Jones</InlineRef> to <strong style={{ color: FH.cream }}>QB34</strong> (from QB25) overnight. Beat writers caught Shanahan saying the quiet part out loud: Jones is on a leash Sunday. Against a <strong style={{ color: FH.cream }}>SEA</strong> defense that&apos;s given up top-10 QB numbers twice in the last three weeks, Brissett&apos;s home floor still projects <strong style={{ color: FH.win }}>+6.2 over Jones</strong>.</>}
          sources={BRIEFING.items[0].sources}
          delta="−6.2"
          confidence={4}
        />

        {/* Paragraph 2 — the waiver */}
        <Paragraph
          badge="ADD"
          tone={FH.win}
          label="K · Cowboys"
          body={<>At kicker, the obvious move is <InlineRef tone={FH.win}>Brandon Aubrey</InlineRef>. He&apos;s trending in <strong style={{ color: FH.cream }}>47% of Sleeper leagues</strong> this week, Todd Archer had him at four attempts minimum on Tuesday, and the r/fantasyfootball waiver thread pinned him at <strong style={{ color: FH.cream }}>3.1k upvotes</strong>. That&apos;s rare source agreement.</>}
          sources={BRIEFING.items[1].sources}
          delta="+3.4"
          confidence={3}
        />

        {/* Paragraph 3 — the watch */}
        <Paragraph
          badge="WATCH"
          tone={FH.tie}
          label="WR · Jets"
          body={<><InlineRef tone={FH.tie}>Garrett Wilson</InlineRef> was limited Wed/Thu with a hamstring — Rich Cimini expects a final read by <strong style={{ color: FH.cream }}>Fri 3pm</strong>. If Wilson sits, Allen Lazard absorbs eight-plus targets. Have a Wilson-out plan loaded; don&apos;t wait until Sunday morning.</>}
          sources={BRIEFING.items[2].sources}
          delta="TBD"
          confidence={2}
        />

        {/* footer actions */}
        <div style={{ marginTop: 18, display:'grid', gridTemplateColumns:'1fr 1fr', gap: 8 }}>
          <div style={{ padding: '12px 14px', textAlign:'center', borderRadius: 10, background: FH.bgElev1, border: `0.5px solid ${FH.hairline}`, fontSize: 12, color: FH.cream, fontWeight: 600 }}>Ask follow-ups</div>
          <div style={{ padding: '12px 14px', textAlign:'center', borderRadius: 10, background: FH.gold, color:'#1A1A1A', fontSize: 12, fontWeight: 700 }}>Apply all 3 →</div>
        </div>
        <div style={{ marginTop: 12, fontSize: 10, color: FH.creamFaint, textAlign:'center', lineHeight: 1.5 }}>
          Synthesized from 47 signals · updates Tue Thu Fri Sun
        </div>
      </div>
    </IntelShell>
  );
}

function InlineRef({ tone, children }) {
  return <span style={{
    fontWeight: 700, color: tone,
    borderBottom: `1px dashed ${tone}`, paddingBottom: 1,
  }}>{children}</span>;
}

function Paragraph({ badge, tone, label, body, sources, delta, confidence }) {
  return (
    <div style={{
      marginTop: 14, padding: '14px 0',
      borderTop: `0.5px solid ${FH.hairline}`,
    }}>
      <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
        <span style={{
          fontSize: 9, fontWeight: 800, letterSpacing: 1.3,
          color: tone, padding:'2px 7px', borderRadius: 3,
          border: `0.5px solid ${tone}66`,
        }}>{badge}</span>
        <span style={{ fontSize: 10, color: FH.creamFaint, fontWeight: 600, letterSpacing: 0.3 }}>{label}</span>
        <span style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap: 8 }}>
          <Confidence n={confidence} tone={tone}/>
          <span style={{ ...T.num(13), color: tone }}>{delta}</span>
        </span>
      </div>
      <div style={{ marginTop: 10, fontSize: 13.5, color: FH.cream, lineHeight: 1.55, letterSpacing: -0.05 }}>
        {body}
      </div>
      <div style={{ display:'flex', gap: 6, marginTop: 10, flexWrap:'wrap' }}>
        {sources.map((s, i) => <SourcePill key={i} {...s}/>)}
      </div>
    </div>
  );
}

Object.assign(window, { BriefingEditorial, BriefingScorecard, BriefingNarrative, IntelShell, SrcGlyph, SourcePill, Confidence, BRIEFING });
