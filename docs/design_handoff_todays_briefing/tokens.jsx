// FantasyHub audit — shared design tokens + primitives.
// Keep the current dark charcoal/cream/old-gold system but tighten the scale.

const FH = {
  // Core bg
  bg:        '#141312',   // slightly warmer than #1A1A1A, less blue
  bgElev1:   '#1C1A17',   // cards
  bgElev2:   '#24211D',   // cards on cards
  hairline:  'rgba(232,226,214,0.08)',
  hairlineStrong: 'rgba(232,226,214,0.14)',

  // Text
  cream:     '#E8E2D6',
  creamDim:  'rgba(232,226,214,0.62)',
  creamFaint:'rgba(232,226,214,0.38)',

  // Gold hierarchy — stop using gold for everything.
  gold:      '#C9A96E',   // primary accent only (CTAs, active tab, key numbers)
  goldDim:   'rgba(201,169,110,0.55)',
  goldFaint: 'rgba(201,169,110,0.14)',

  // Semantic
  win:       '#6FBF8A',   // softer than iOS green
  loss:      '#D96B6B',
  tie:       '#D6B461',
  info:      '#7FA8C9',

  // Chart
  chartLine: '#C9A96E',
  chartGrid: 'rgba(232,226,214,0.06)',

  // Type
  display:   "'Fraktion Mono', ui-monospace, 'SF Mono', Menlo, monospace", // numbers
  sans:      "-apple-system, 'SF Pro Text', system-ui, sans-serif",
  heading:   "-apple-system, 'SF Pro Display', system-ui, sans-serif",
};

// ─── Text helpers ───
const T = {
  // Display numerals — tabular, tight, confident.
  num: (size = 32, weight = 600) => ({
    fontFamily: FH.display,
    fontSize: size, fontWeight: weight,
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: -0.5, lineHeight: 1,
    color: FH.cream,
  }),
  // Section eyebrow — tighter than current 13px spaced caps.
  eyebrow: (color = FH.gold) => ({
    fontFamily: FH.sans, fontSize: 11, fontWeight: 600,
    letterSpacing: 1.2, textTransform: 'uppercase', color,
  }),
  label: (color = FH.creamDim, size = 12) => ({
    fontFamily: FH.sans, fontSize: size, fontWeight: 500, color,
    letterSpacing: 0.1,
  }),
  body: (color = FH.cream, size = 15) => ({
    fontFamily: FH.sans, fontSize: size, fontWeight: 500, color,
    letterSpacing: -0.1,
  }),
  h1: () => ({
    fontFamily: FH.heading, fontSize: 22, fontWeight: 700,
    color: FH.cream, letterSpacing: -0.3, lineHeight: 1.15,
  }),
};

// ─── Phone shell ─ a lightweight replacement for IOSDevice when we want
// full control over nav/tab bar chrome and a real tab bar with icons.
function PhoneShell({ children, navTitle, navLeft, navRight, activeTab, showTabBar = true, noNav = false }) {
  return (
    <div style={{
      width: 390, height: 844, borderRadius: 48, overflow: 'hidden',
      position: 'relative', background: FH.bg,
      boxShadow: '0 40px 80px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.4)',
      fontFamily: FH.sans, color: FH.cream,
      WebkitFontSmoothing: 'antialiased',
    }}>
      {/* dynamic island */}
      <div style={{
        position: 'absolute', top: 11, left: '50%', transform: 'translateX(-50%)',
        width: 126, height: 37, borderRadius: 24, background: '#000', zIndex: 50,
      }} />
      {/* status bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 32px 0', height: 54,
      }}>
        <div style={{ fontFamily: FH.sans, fontSize: 17, fontWeight: 600, color: FH.cream, letterSpacing: -0.4 }}>9:41</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', color: FH.cream }}>
          <svg width="18" height="11" viewBox="0 0 18 11"><path d="M1 8h2v2H1zM5 6h2v4H5zM9 3h2v7H9zM13 0h2v10h-2z" fill="currentColor"/></svg>
          <svg width="16" height="11" viewBox="0 0 16 11"><path d="M8 10.5c.7 0 1.3-.6 1.3-1.3S8.7 7.9 8 7.9s-1.3.6-1.3 1.3S7.3 10.5 8 10.5zM3.8 6.5c1.2-1.2 2.7-1.8 4.2-1.8s3 .6 4.2 1.8l1.2-1.2C11.9 3.9 10 3.1 8 3.1S4.1 3.9 2.6 5.3l1.2 1.2z" fill="currentColor"/></svg>
          <svg width="26" height="11" viewBox="0 0 26 11"><rect x="0.5" y="0.5" width="21" height="10" rx="2.5" stroke="currentColor" strokeOpacity=".4" fill="none"/><rect x="2" y="2" width="18" height="7" rx="1.5" fill="currentColor"/><rect x="22.5" y="3.5" width="2" height="4" rx="1" fill="currentColor" fillOpacity=".4"/></svg>
        </div>
      </div>

      {/* nav bar */}
      {!noNav && (
        <div style={{
          position: 'absolute', top: 54, left: 0, right: 0, zIndex: 5,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 16px', height: 44,
        }}>
          <div style={{ width: 44, display: 'flex', alignItems: 'center' }}>{navLeft}</div>
          <div style={{ flex: 1, textAlign: 'center', fontSize: 17, fontWeight: 600, color: FH.cream, letterSpacing: -0.4 }}>
            {navTitle}
          </div>
          <div style={{ width: 44, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>{navRight}</div>
        </div>
      )}

      {/* body */}
      <div style={{
        position: 'absolute', top: noNav ? 54 : 98, bottom: showTabBar ? 92 : 0, left: 0, right: 0,
        overflow: 'hidden',
      }}>
        {children}
      </div>

      {/* tab bar */}
      {showTabBar && <TabBar active={activeTab} />}

      {/* home indicator */}
      <div style={{
        position: 'absolute', bottom: 8, left: 0, right: 0, zIndex: 60,
        display: 'flex', justifyContent: 'center', pointerEvents: 'none',
      }}>
        <div style={{ width: 139, height: 5, borderRadius: 100, background: 'rgba(232,226,214,0.5)' }} />
      </div>
    </div>
  );
}

// ─── Tab bar ─ 5 items, mirrors current app.
function TabBar({ active = 'Dashboard' }) {
  const items = [
    { k: 'Dashboard', icon: <IconDashboard/> },
    { k: 'Analytics', icon: <IconBars/> },
    { k: 'Intel',     icon: <IconSignal/> },
    { k: 'AI Chat',   icon: <IconChat/> },
    { k: 'Profile',   icon: <IconProfile/> },
  ];
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 55,
      height: 92, paddingBottom: 22,
      background: 'linear-gradient(to top, rgba(20,19,18,0.98) 60%, rgba(20,19,18,0))',
      display: 'flex', alignItems: 'center', justifyContent: 'space-around',
      padding: '8px 12px 22px',
    }}>
      {items.map(it => {
        const on = it.k === active;
        return (
          <div key={it.k} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            color: on ? FH.gold : FH.creamFaint,
            flex: 1,
          }}>
            <div style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{it.icon}</div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.2 }}>{it.k}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Icons (stroke, inherit color) ───
const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' };
const IconDashboard = () => <svg width="22" height="22" viewBox="0 0 22 22" {...S}><rect x="3" y="3" width="7" height="10" rx="1.5"/><rect x="12" y="3" width="7" height="6" rx="1.5"/><rect x="12" y="11" width="7" height="8" rx="1.5"/><rect x="3" y="15" width="7" height="4" rx="1.5"/></svg>;
const IconBars = () => <svg width="22" height="22" viewBox="0 0 22 22" {...S}><path d="M4 18V8M11 18V4M18 18v-6"/></svg>;
const IconSignal = () => <svg width="22" height="22" viewBox="0 0 22 22" {...S}><path d="M6 6c-1.5 1.5-2 3-2 5s.5 3.5 2 5M16 6c1.5 1.5 2 3 2 5s-.5 3.5-2 5M8.5 8.5c-.8.8-1 1.6-1 2.5s.2 1.7 1 2.5M13.5 8.5c.8.8 1 1.6 1 2.5s-.2 1.7-1 2.5"/><circle cx="11" cy="11" r="1.2" fill="currentColor" stroke="none"/></svg>;
const IconChat = () => <svg width="22" height="22" viewBox="0 0 22 22" {...S}><path d="M4 6a2 2 0 012-2h7a2 2 0 012 2v5a2 2 0 01-2 2H9l-3 3v-3H6a2 2 0 01-2-2V6z"/><path d="M11 13.5V15a2 2 0 002 2h3l2 2v-2a2 2 0 002-2v-4a2 2 0 00-2-2h-1"/></svg>;
const IconProfile = () => <svg width="22" height="22" viewBox="0 0 22 22" {...S}><circle cx="11" cy="8" r="3.5"/><path d="M4 19c1.2-3.5 4-5 7-5s5.8 1.5 7 5"/></svg>;

// Utility cards
function Card({ children, style = {}, pad = 16, elev = 1 }) {
  return (
    <div style={{
      background: elev === 2 ? FH.bgElev2 : FH.bgElev1,
      borderRadius: 16, padding: pad,
      border: `0.5px solid ${FH.hairline}`,
      ...style,
    }}>{children}</div>
  );
}

function Eyebrow({ children, color = FH.gold, icon, style = {} }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, ...T.eyebrow(color), ...style }}>
      {icon && <span style={{ display: 'flex' }}>{icon}</span>}
      {children}
    </div>
  );
}

// Pin — numbered critique marker
function Pin({ n, x, y, color = '#D96B6B' }) {
  return (
    <div style={{
      position: 'absolute', left: x, top: y, zIndex: 4,
      width: 22, height: 22, borderRadius: 11,
      background: color, color: '#1A1A1A',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: FH.sans, fontSize: 11, fontWeight: 800,
      boxShadow: `0 0 0 3px rgba(217,107,107,0.25), 0 2px 8px rgba(0,0,0,0.4)`,
    }}>{n}</div>
  );
}

// Small sparkline
function Sparkline({ data, w = 80, h = 22, color = FH.gold, fill = true }) {
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 2) - 1;
    return [x, y];
  });
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const fillD = `${d} L${w} ${h} L0 ${h} Z`;
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      {fill && <path d={fillD} fill={color} fillOpacity={0.12}/>}
      <path d={d} fill="none" stroke={color} strokeWidth={1.4} strokeLinejoin="round" strokeLinecap="round"/>
    </svg>
  );
}

// Avatar w/ initial
function Avatar({ initial, size = 28, color = FH.gold, bg }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size / 2,
      background: bg || `rgba(201,169,110,0.18)`,
      color, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: FH.sans, fontWeight: 700, fontSize: size * 0.42,
      letterSpacing: 0, flexShrink: 0,
    }}>{initial}</div>
  );
}

Object.assign(window, { FH, T, PhoneShell, TabBar, Card, Eyebrow, Pin, Sparkline, Avatar,
  IconDashboard, IconBars, IconSignal, IconChat, IconProfile });
