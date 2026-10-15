// Accessible SVG/HTML renderings of the structured diagram specs used by questions and
// Science Explorer cards. Every diagram carries a caption and full text alternative.

import type { Diagram as D, RockTexture } from '../../content/schema.ts';

const C = { ink: '#fff7e7', soft: 'rgba(255,247,231,0.7)', gold: '#ffc75b', mint: '#71e3cf', coral: '#ff7f86', blue: '#9fb4ff', bg: 'rgba(255,247,231,0.06)' };

/** Render digits after letters as subscripts: C6H12O6 -> C₆H₁₂O₆ */
export function formula(s: string): string {
  const sub = '₀₁₂₃₄₅₆₇₈₉';
  return s.replace(/([A-Za-z)\]])(\d+)/g, (_m, a: string, d: string) => a + [...d].map((c) => sub[Number(c)]).join(''));
}

const ELEMENT_COLORS: Record<string, string> = {
  H: '#f2f2f2', O: '#ff6b6b', C: '#5a5a66', N: '#6b8cff', Na: '#b58cff', Cl: '#7cf29a', S: '#ffd84d', Fe: '#d9773a',
  Ca: '#9fd3c7', Mg: '#c9b8e8', K: '#c08cff', Cu: '#d98a4e', Si: '#e0c79a', Al: '#c0c8d0', P: '#ff9f43', Zn: '#a8b8c8',
};

function textureFill(t: RockTexture): string {
  return {
    sandstone: '#d9b77a', shale: '#7d7a86', limestone: '#d8d4c4', conglomerate: '#b8906a', coal: '#2c2a30',
    igneous: '#b0485a', metamorphic: '#8a6fa8', soil: '#6b4b2e', 'volcanic-ash': '#a8a29a', basalt: '#3f4048',
  }[t];
}

export function Diagram({ d }: { d: D }) {
  return (
    <figure class="diagram" role="group" aria-label={d.caption}>
      <div class="diagram-art" aria-hidden={d.kind === 'table' ? undefined : 'true'}>
        {renderBody(d)}
      </div>
      <figcaption>
        <strong>{d.caption}</strong>
        <details>
          <summary>Text description</summary>
          <p>{d.alt}</p>
        </details>
      </figcaption>
      {d.kind !== 'table' && <p class="visually-hidden">{d.alt}</p>}
    </figure>
  );
}

function renderBody(d: D) {
  switch (d.kind) {
    case 'table':
      return (
        <table class="data-table">
          <thead>
            <tr>{d.columns.map((c) => <th scope="col">{formula(c)}</th>)}</tr>
          </thead>
          <tbody>
            {d.rows.map((r) => (
              <tr>{r.map((c, i) => (i === 0 ? <th scope="row">{formula(String(c))}</th> : <td>{formula(String(c))}</td>))}</tr>
            ))}
          </tbody>
        </table>
      );
    case 'layers': {
      const h = 34;
      const W = 320;
      const H = d.layers.length * h + 10;
      return (
        <svg viewBox={`0 0 ${W + 150} ${H}`} width="100%" style={{ maxWidth: '520px' }}>
          {d.layers.map((l, i) => (
            <g>
              <rect x="0" y={5 + i * h} width={W} height={h} fill={textureFill(l.texture)} stroke="#1a1030" stroke-width="1" />
              {l.texture === 'conglomerate' && [20, 70, 140, 220, 280].map((x) => <circle cx={x} cy={5 + i * h + h / 2} r="6" fill="rgba(0,0,0,0.25)" />)}
              {l.fossils?.map((_f, k) => <path d={`M${40 + k * 80} ${5 + i * h + h / 2} a6 6 0 1 1 6 6`} stroke="#1a1030" fill="none" stroke-width="2" />)}
              <text x={W + 10} y={5 + i * h + h / 2 + 5} fill={C.ink} font-size="13">{l.label}</text>
            </g>
          ))}
          {d.features?.map((f) => {
            const idx = d.layers.map((l, i) => (f.affects.includes(l.id) ? i : -1)).filter((i) => i >= 0);
            const y0 = 5 + Math.min(...idx) * h;
            const y1 = 5 + (Math.max(...idx) + 1) * h;
            if (f.kind === 'fault') return <g><line x1="210" y1={y0} x2="170" y2={y1} stroke={C.coral} stroke-width="4" /><text x="175" y={y0 + 14} fill={C.coral} font-size="12" font-weight="700">{f.label}</text></g>;
            if (f.kind === 'intrusion') return <g><path d={`M120 ${y1} L130 ${y0} L150 ${y0} L160 ${y1} Z`} fill="#b0485a" stroke={C.gold} stroke-width="2" /><text x="132" y={y0 + 16} fill={C.ink} font-size="12" font-weight="700">{f.label}</text></g>;
            if (f.kind === 'erosion-surface') return <g><path d={`M0 ${y0} Q80 ${y0 - 8} 160 ${y0} T${W} ${y0}`} stroke={C.gold} stroke-width="3" fill="none" stroke-dasharray="6 4" /><text x="8" y={y0 - 4} fill={C.gold} font-size="12">{f.label}</text></g>;
            return <text x="8" y={y0 + 14} fill={C.gold} font-size="12">{f.label}</text>;
          })}
        </svg>
      );
    }
    case 'network': {
      const n = d.nodes.length;
      const W = 460;
      const H = d.layout === 'chain' ? 120 : 300;
      const pos = new Map<string, [number, number]>();
      d.nodes.forEach((node, i) => {
        if (d.layout === 'chain') pos.set(node.id, [40 + (i * (W - 80)) / Math.max(1, n - 1), 60]);
        else if (d.layout === 'pyramid') {
          const groups = [...new Set(d.nodes.map((x) => x.group ?? '0'))];
          const g = groups.indexOf(node.group ?? '0');
          const inG = d.nodes.filter((x) => (x.group ?? '0') === (node.group ?? '0'));
          const k = inG.indexOf(node);
          pos.set(node.id, [W / 2 + (k - (inG.length - 1) / 2) * 110, H - 40 - g * ((H - 80) / Math.max(1, groups.length - 1))]);
        } else if (d.layout === 'cycle') {
          const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
          pos.set(node.id, [W / 2 + Math.cos(a) * 160, H / 2 + Math.sin(a) * 110]);
        } else {
          const groups = [...new Set(d.nodes.map((x) => x.group ?? '0'))];
          const g = groups.indexOf(node.group ?? '0');
          const inG = d.nodes.filter((x) => (x.group ?? '0') === (node.group ?? '0'));
          const k = inG.indexOf(node);
          pos.set(node.id, [((k + 1) * W) / (inG.length + 1), H - 36 - g * ((H - 72) / Math.max(1, groups.length - 1))]);
        }
      });
      return (
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: '560px' }}>
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 Z" fill={C.gold} />
            </marker>
          </defs>
          {d.edges.map((e) => {
            const [x1, y1] = pos.get(e.from)!;
            const [x2, y2] = pos.get(e.to)!;
            const dx = x2 - x1;
            const dy = y2 - y1;
            const l = Math.hypot(dx, dy) || 1;
            const sx = x1 + (dx / l) * 34;
            const sy = y1 + (dy / l) * 18;
            const ex = x2 - (dx / l) * 38;
            const ey = y2 - (dy / l) * 20;
            return (
              <g>
                <line x1={sx} y1={sy} x2={ex} y2={ey} stroke={C.gold} stroke-width="2.5" marker-end="url(#arrow)" />
                {e.label && <text x={(sx + ex) / 2} y={(sy + ey) / 2 - 4} fill={C.soft} font-size="11" text-anchor="middle">{e.label}</text>}
              </g>
            );
          })}
          {d.nodes.map((node) => {
            const [x, y] = pos.get(node.id)!;
            const w = Math.max(64, node.label.length * 7.4 + 16);
            return (
              <g>
                <rect x={x - w / 2} y={y - 15} width={w} height="30" rx="15" fill="#2c1b52" stroke={C.mint} stroke-width="2" />
                <text x={x} y={y + 5} fill={C.ink} font-size="13" text-anchor="middle" font-weight="700">{node.label}</text>
              </g>
            );
          })}
        </svg>
      );
    }
    case 'molecule':
      return (
        <svg viewBox="-1 -1 12 12" width="100%" style={{ maxWidth: '260px' }}>
          {d.bonds.map((b) => {
            const A = d.atoms.find((a) => a.id === b.a)!;
            const B = d.atoms.find((a) => a.id === b.b)!;
            const order = b.order ?? 1;
            const nx = -(B.y - A.y);
            const ny = B.x - A.x;
            const nl = Math.hypot(nx, ny) || 1;
            return (
              <g>
                {Array.from({ length: order }, (_, k) => {
                  const off = (k - (order - 1) / 2) * 0.22;
                  return <line x1={A.x + (nx / nl) * off} y1={A.y + (ny / nl) * off} x2={B.x + (nx / nl) * off} y2={B.y + (ny / nl) * off} stroke="#c9b8e8" stroke-width="0.14" />;
                })}
              </g>
            );
          })}
          {d.atoms.map((a) => (
            <g>
              <circle cx={a.x} cy={a.y} r={a.element === 'H' ? 0.55 : 0.85} fill={ELEMENT_COLORS[a.element] ?? '#c9b8e8'} stroke="#1a1030" stroke-width="0.08" />
              <text x={a.x} y={a.y + 0.3} font-size="0.8" text-anchor="middle" fill="#1a1030" font-weight="700">{a.element}</text>
            </g>
          ))}
        </svg>
      );
    case 'lattice': {
      const cells = [];
      for (let r = 0; r < d.rows; r++) {
        for (let c = 0; c < d.cols; c++) {
          const el = d.elements[(r + c) % d.elements.length];
          const big = d.elements.length > 1 && el === d.elements[1];
          cells.push(
            <g>
              <circle cx={20 + c * 34} cy={20 + r * 34} r={big ? 13 : 9} fill={ELEMENT_COLORS[el] ?? C.mint} stroke="#1a1030" stroke-width="1.5" />
              <text x={20 + c * 34} y={24 + r * 34} font-size="10" text-anchor="middle" fill="#1a1030" font-weight="700">{el}</text>
            </g>,
          );
        }
      }
      return <svg viewBox={`0 0 ${d.cols * 34 + 6} ${d.rows * 34 + 6}`} width="100%" style={{ maxWidth: '300px' }}>{cells}</svg>;
    }
    case 'curve': {
      const all = d.series.flatMap((s) => s.points);
      const xs = all.map((p) => p[0]);
      const ys = all.map((p) => p[1]);
      const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
      const [y0, y1] = [Math.min(0, Math.min(...ys)), Math.max(...ys)];
      const W = 420;
      const H = 240;
      const px = (x: number) => 50 + ((x - x0) / (x1 - x0 || 1)) * (W - 70);
      const py = (y: number) => H - 36 - ((y - y0) / (y1 - y0 || 1)) * (H - 60);
      const colors = [C.gold, C.mint, C.coral, C.blue];
      return (
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: '520px' }}>
          <line x1="50" y1={H - 36} x2={W - 10} y2={H - 36} stroke={C.soft} />
          <line x1="50" y1="10" x2="50" y2={H - 36} stroke={C.soft} />
          <text x={(W + 40) / 2} y={H - 8} fill={C.soft} font-size="12" text-anchor="middle">{d.xLabel}</text>
          <text x="14" y={H / 2} fill={C.soft} font-size="12" text-anchor="middle" transform={`rotate(-90 14 ${H / 2})`}>{d.yLabel}</text>
          {[x0, (x0 + x1) / 2, x1].map((x) => <text x={px(x)} y={H - 22} fill={C.soft} font-size="10" text-anchor="middle">{Math.round(x * 10) / 10}</text>)}
          {[y0, (y0 + y1) / 2, y1].map((y) => <text x="44" y={py(y) + 4} fill={C.soft} font-size="10" text-anchor="end">{Math.round(y * 10) / 10}</text>)}
          {d.series.map((s, i) => (
            <g>
              <polyline points={s.points.map((p) => `${px(p[0])},${py(p[1])}`).join(' ')} fill="none" stroke={colors[i % 4]} stroke-width="3" stroke-linejoin="round" />
              {s.points.map((p) => <circle cx={px(p[0])} cy={py(p[1])} r="3.5" fill={colors[i % 4]} />)}
              {d.series.length > 1 && <text x={W - 14} y={20 + i * 16} fill={colors[i % 4]} font-size="12" text-anchor="end">{s.label}</text>}
            </g>
          ))}
          {d.annotations?.map((a) => <text x={px(a.x)} y={py(a.y) - 10} fill={C.ink} font-size="11" text-anchor="middle">{a.text}</text>)}
        </svg>
      );
    }
    case 'bars': {
      const max = Math.max(...d.bars.map((b) => b.value), 1);
      const W = 420;
      const H = 220;
      const bw = (W - 60) / d.bars.length;
      return (
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: '520px' }}>
          <text x="12" y={H / 2} fill={C.soft} font-size="12" text-anchor="middle" transform={`rotate(-90 12 ${H / 2})`}>{d.yLabel}</text>
          {d.bars.map((b, i) => {
            const h = (b.value / max) * (H - 70);
            return (
              <g>
                <rect x={40 + i * bw + 6} y={H - 40 - h} width={bw - 12} height={h} rx="5" fill={[C.gold, C.mint, C.coral, C.blue][i % 4]} />
                <text x={40 + i * bw + bw / 2} y={H - 44 - h} fill={C.ink} font-size="11" text-anchor="middle">{b.value}</text>
                <text x={40 + i * bw + bw / 2} y={H - 22} fill={C.soft} font-size="11" text-anchor="middle">{b.label}</text>
              </g>
            );
          })}
        </svg>
      );
    }
    case 'particles': {
      return (
        <svg viewBox={`0 0 ${d.panels.length * 150} 170`} width="100%" style={{ maxWidth: '520px' }}>
          {d.panels.map((p, i) => {
            const dots = [];
            for (let k = 0; k < 16; k++) {
              let x: number;
              let y: number;
              if (p.state === 'solid') {
                x = 30 + (k % 4) * 26;
                y = 45 + Math.floor(k / 4) * 26;
              } else if (p.state === 'liquid') {
                x = 25 + ((k * 37) % 90) + (Math.floor(k / 4) % 2) * 8;
                y = 70 + Math.floor(k / 4) * 18 + ((k * 13) % 9);
              } else {
                x = 20 + ((k * 53) % 100);
                y = 30 + ((k * 71) % 100);
              }
              dots.push(<circle cx={i * 150 + x} cy={y} r="8" fill={C.mint} stroke="#1a1030" />);
            }
            return (
              <g>
                <rect x={i * 150 + 8} y="20" width="134" height="124" rx="8" fill={C.bg} stroke={C.soft} />
                {dots}
                <text x={i * 150 + 75} y="162" fill={C.ink} font-size="12" text-anchor="middle">{p.label}</text>
              </g>
            );
          })}
        </svg>
      );
    }
    case 'equation':
      return (
        <div class="equation" aria-hidden="true">
          {d.reactants.map((r, i) => (
            <span>
              {i > 0 && <span class="eq-op"> + </span>}
              <span class="eq-term">{r.coefficient && r.coefficient > 1 ? r.coefficient : ''}{formula(r.formula)}</span>
              {r.label && <small>{r.label}</small>}
            </span>
          ))}
          <span class="eq-arrow">{d.arrowNote ? <small>{d.arrowNote}</small> : null}→</span>
          {d.products.map((r, i) => (
            <span>
              {i > 0 && <span class="eq-op"> + </span>}
              <span class="eq-term">{r.coefficient && r.coefficient > 1 ? r.coefficient : ''}{formula(r.formula)}</span>
              {r.label && <small>{r.label}</small>}
            </span>
          ))}
        </div>
      );
  }
}
