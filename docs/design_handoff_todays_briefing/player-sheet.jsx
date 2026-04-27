// Player Detail Sheet — opened from any briefing takeaway or signal card.
// Shows: header · AI summary · signal timeline (grouped by source) · matchup
// · quick actions (start/sit/drop/trade).

function PlayerDetailSheet() {
  return (
    <PhoneShell
      noNav
      showTabBar={false}
    >
      <div style={{ position: 'relative', height: '100%', overflow: 'auto', background: FH.bg }}>

        {/* Sheet grabber + close */}
        <div style={{ position:'sticky', top: 0, zIndex: 20, background: FH.bg, borderBottom: `0.5px solid ${FH.hairline}` }}>
          <div style={{ display:'flex', justifyContent:'center', padding: '8px 0 4px' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: FH.hairlineStrong }}/>
          </div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding: '4px 16px 10px' }}>
            <div style={{ fontSize: 11, color: FH.creamFaint, fontWeight: 600, letterSpacing: 0.5 }}>PLAYER · INTEL</div>
            <div style={{ fontSize: 14, color: FH.cream, fontWeight: 600 }}>Done</div>
          </div>
        </div>

        {/* Header with gradient plate */}
        <div style={{
          padding: '18px 18px 16px',
          background: 'linear-gradient(160deg, rgba(217,107,107,0.12) 0%, rgba(20,19,18,0) 70%)',
        }}>
          <div style={{ display:'flex', alignItems:'flex-start', gap: 12 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 12,
              background: 'linear-gradient(135deg, #AA0000 0%, #B50808 100%)',
              display:'flex', alignItems:'center', justifyContent:'center',
              color:'#FFD89C', fontWeight: 800, fontSize: 16, letterSpacing: 0.4,
              border: `0.5px solid ${FH.hairlineStrong}`,
            }}>SF</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: FH.cream, letterSpacing: -0.3 }}>Mac Jones</div>
              <div style={{ marginTop: 3, fontSize: 12, color: FH.creamDim }}>
                QB · 49ers · #10 · On <span style={{ color: FH.cream, fontWeight: 600 }}>Your Roster</span>
              </div>
              <div style={{ display:'flex', gap: 6, marginTop: 8, flexWrap:'wrap' }}>
                <span style={{
                  fontSize: 9, fontWeight: 800, letterSpacing: 1.2,
                  color: FH.loss, padding:'2px 7px', borderRadius: 3,
                  border: `0.5px solid ${FH.loss}66`,
                }}>AI SAYS SIT</span>
                <span style={{
                  fontSize: 10, fontWeight: 600, color: FH.creamDim,
                  padding:'2px 7px', borderRadius: 3, background: FH.bgElev1, border: `0.5px solid ${FH.hairline}`,
                }}>Week 14 · vs SEA</span>
              </div>
            </div>
          </div>

          {/* Numerals strip */}
          <div style={{
            marginTop: 14, display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap: 1,
            background: FH.hairline, borderRadius: 10, overflow:'hidden',
            border: `0.5px solid ${FH.hairline}`,
          }}>
            {[
              ['PROJ', '11.8', 'pts'],
              ['RANK', 'QB34', '−9'],
              ['OWN%', '62', '−4'],
              ['START%','18', '−22'],
            ].map(([l, v, d]) => (
              <div key={l} style={{ background: FH.bgElev1, padding: '10px 6px', textAlign:'center' }}>
                <div style={{ fontSize: 9, color: FH.creamFaint, letterSpacing: 0.5, fontWeight: 600 }}>{l}</div>
                <div style={{ ...T.num(18), marginTop: 3 }}>{v}</div>
                <div style={{ fontSize: 10, color: d.startsWith('−') ? FH.loss : FH.creamDim, fontVariantNumeric:'tabular-nums', marginTop: 2 }}>{d}</div>
              </div>
            ))}
          </div>
        </div>

        {/* AI SUMMARY */}
        <div style={{ padding: '6px 18px 18px' }}>
          <div style={{ ...T.eyebrow() }}>
            <span style={{ display:'flex', alignItems:'center', gap: 6 }}>
              <span style={{ width: 14, height: 14, borderRadius: 7, background: FH.gold, display:'inline-flex', alignItems:'center', justifyContent:'center' }}>
                <svg width="7" height="7" viewBox="0 0 7 7" fill="#1A1A1A"><path d="M3.5 0L4.4 2.4 7 3.5 4.4 4.6 3.5 7 2.6 4.6 0 3.5 2.6 2.4z"/></svg>
              </span>
              AI SUMMARY
            </span>
          </div>
          <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.55, color: FH.cream }}>
            Jones&apos;s stock cratered Wed–Thu. <strong style={{ color: FH.loss }}>Consensus dropped him 9 spots</strong> to QB34 after Shanahan&apos;s "leash" comment; five of six major outlets now rank Brissett higher. Jones&apos;s Week 14 floor is <strong style={{ color: FH.cream }}>4.2 pts</strong>; he&apos;s exceeded 15 in only 2 of his last 7. <strong style={{ color: FH.cream }}>Sit with confidence.</strong>
          </div>
          <div style={{ display:'flex', gap: 6, marginTop: 10, alignItems:'center' }}>
            <Confidence n={4}/>
            <span style={{ fontSize: 11, color: FH.creamDim, fontWeight: 600 }}>Very high confidence · 47 signals</span>
          </div>
        </div>

        {/* SIGNAL TIMELINE */}
        <div style={{ padding: '0 18px 8px' }}>
          <div style={{ ...T.eyebrow() }}>SIGNAL TIMELINE · 72H</div>
        </div>
        <div style={{ padding: '10px 18px 0' }}>
          {[
            { t:'2h ago', kind:'twitter', src:'@JeffHowe · The Athletic', tone: FH.loss,
              body:'"Shanahan kept Jones on a short leash today. Don&apos;t be surprised to see Brissett for a series or two if it&apos;s bumpy early."' },
            { t:'6h ago', kind:'rank', src:'FantasyPros · ECR', tone: FH.loss,
              body:<>Consensus ranking moved <strong style={{ color: FH.cream }}>QB25 → QB34</strong> overnight. Largest drop of the week at the position.</> },
            { t:'9h ago', kind:'startsit', src:'ESPN Start/Sit', tone: FH.loss,
              body:'Field Yates moved Jones to the Sit list. "I&apos;m off him in all formats this week."' },
            { t:'14h ago', kind:'reddit', src:'r/fantasyfootball · 1.2k ↑', tone: FH.tie,
              body:'Thread "49ers QB situation Week 14" pinned. Community sentiment 71% bearish.' },
            { t:'1d ago', kind:'news', src:'Rotoworld', tone: FH.creamDim,
              body:'Practice report: Full participant. No health concern, but usage in question.' },
            { t:'2d ago', kind:'rank', src:'PFF · Matchup Grades', tone: FH.loss,
              body:<>SEA pass defense graded <strong style={{ color: FH.cream }}>A−</strong> vs QBs in last 4 games. Matchup rating: <strong style={{ color: FH.loss }}>tough</strong>.</> },
          ].map((s, i) => (
            <div key={i} style={{ display:'flex', gap: 10, position:'relative' }}>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', width: 22, flexShrink: 0 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: 11, background: FH.bgElev1,
                  border: `0.5px solid ${FH.hairlineStrong}`, color: s.tone,
                  display:'flex', alignItems:'center', justifyContent:'center',
                }}><SrcGlyph kind={s.kind} size={11}/></div>
                {i < 5 && <div style={{ flex: 1, width: 1, background: FH.hairline, marginTop: 3 }}/>}
              </div>
              <div style={{ flex: 1, paddingBottom: 14 }}>
                <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between' }}>
                  <div style={{ fontSize: 11, color: FH.creamDim, fontWeight: 600 }}>{s.src}</div>
                  <div style={{ fontSize: 10, color: FH.creamFaint, fontVariantNumeric:'tabular-nums' }}>{s.t}</div>
                </div>
                <div style={{ marginTop: 4, fontSize: 12.5, color: FH.cream, lineHeight: 1.5, fontStyle: s.kind === 'twitter' ? 'italic' : 'normal' }}>
                  {s.body}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* MATCHUP quick snapshot */}
        <div style={{ padding: '8px 18px 18px' }}>
          <div style={{ ...T.eyebrow() }}>WEEK 14 MATCHUP</div>
          <Card style={{ marginTop: 10, padding: 14 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>SF</div>
                <div style={{ fontSize: 10, color: FH.creamFaint }}>at</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>SEA</div>
              </div>
              <div style={{ fontSize: 10, color: FH.creamDim }}>Sun · 4:25 PM · Lumen</div>
            </div>
            <div style={{ marginTop: 10, display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap: 8, fontSize: 11 }}>
              <Meta label="SPREAD" v="SEA −3"/>
              <Meta label="O/U" v="43.5"/>
              <Meta label="IMP. TOTAL" v="20.3"/>
            </div>
          </Card>
        </div>

        {/* QUICK ACTIONS — sticky footer */}
        <div style={{ height: 88 }}/>
      </div>

      {/* Sticky action bar */}
      <div style={{
        position:'absolute', bottom: 0, left: 0, right: 0, zIndex: 30,
        padding: '12px 14px 18px',
        background: 'linear-gradient(to top, rgba(20,19,18,1) 65%, rgba(20,19,18,0))',
        borderTop: `0.5px solid ${FH.hairline}`,
      }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap: 8 }}>
          <ActionBtn label="Bench" icon={<IconDown/>} tone={FH.win} primary/>
          <ActionBtn label="Trade" icon={<IconTrade/>}/>
          <ActionBtn label="Drop" icon={<IconDrop/>}/>
          <ActionBtn label="Mute" icon={<IconMute/>}/>
        </div>
      </div>
    </PhoneShell>
  );
}

function Meta({ label, v }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: FH.creamFaint, letterSpacing: 0.5, fontWeight: 600 }}>{label}</div>
      <div style={{ ...T.num(13), marginTop: 3 }}>{v}</div>
    </div>
  );
}

function ActionBtn({ label, icon, tone = FH.cream, primary }) {
  return (
    <div style={{
      padding: '10px 4px', borderRadius: 10, textAlign:'center',
      background: primary ? tone : FH.bgElev1,
      border: primary ? 'none' : `0.5px solid ${FH.hairline}`,
      color: primary ? '#1A1A1A' : tone,
      display:'flex', flexDirection:'column', alignItems:'center', gap: 4,
    }}>
      <div style={{ display:'flex' }}>{icon}</div>
      <div style={{ fontSize: 11, fontWeight: 700 }}>{label}</div>
    </div>
  );
}

const IconDown  = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M7 2v8M3 7l4 4 4-4"/></svg>;
const IconTrade = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4h9l-2-2M12 10H3l2 2"/></svg>;
const IconDrop  = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 4h8M5 4V2h4v2M4 4l1 8h4l1-8"/></svg>;
const IconMute  = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M7 2l-3 3H2v4h2l3 3zM10 5l3 3M13 5l-3 3"/></svg>;

Object.assign(window, { PlayerDetailSheet });
