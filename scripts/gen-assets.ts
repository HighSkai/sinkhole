#!/usr/bin/env node
/**
 * Generate static brand assets from the same geometry the app animates.
 *
 *   node scripts/gen-assets.ts
 *
 * → public/favicon.svg   (mark, tight crop)
 * → docs/logo.svg        (mark, padded, for the README)
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { makeLogo } from '../src/lib/logo/geometry.ts';

function svg(ratio: number, opts: { pad: number; swirl: boolean; cracks: number; id: string }) {
  const g = makeLogo(ratio, { cracks: opts.cracks });
  const d = g.depth;
  const wedges = opts.swirl
    ? `<g clip-path="url(#${opts.id}d)" opacity=".6" style="mix-blend-mode:screen"><g transform="translate(${d.cx} ${(d.cy + d.ry * 0.2).toFixed(2)}) scale(1 ${ratio})">${g.wedges
        .map((w) => `<path d="${w.d}" fill="#fff" fill-opacity="${w.o}"/>`)
        .join('')}</g></g>`
    : '';
  const p = opts.pad;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-p} ${-p} ${g.w + p * 2} ${g.h + p * 2}" width="${g.w + p * 2}" height="${g.h + p * 2}">
<defs>
<radialGradient id="${opts.id}g" cx="50%" cy="96%" r="82%"><stop offset="0" stop-color="#ff6b9d"/><stop offset=".34" stop-color="#8b5cf6" stop-opacity=".85"/><stop offset=".66" stop-color="#4da3ff" stop-opacity=".38"/><stop offset="1" stop-color="#4da3ff" stop-opacity="0"/></radialGradient>
<linearGradient id="${opts.id}w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3a44"/><stop offset=".42" stop-color="#1c1c22"/><stop offset="1" stop-color="#09090c"/></linearGradient>
<linearGradient id="${opts.id}r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".1"/><stop offset=".55" stop-color="#fff" stop-opacity=".2"/><stop offset="1" stop-color="#fff" stop-opacity=".72"/></linearGradient>
<clipPath id="${opts.id}o"><path d="${g.rim}"/></clipPath>
<clipPath id="${opts.id}d"><ellipse cx="${d.cx}" cy="${d.cy.toFixed(2)}" rx="${d.rx.toFixed(2)}" ry="${d.ry.toFixed(2)}"/></clipPath>
</defs>
<path d="${g.lip}" fill="#25252c" stroke="#ffffff" stroke-opacity=".06" stroke-width=".8"/>
${g.cracks.map((c) => `<path d="${c.d}" fill="#5c5c68"/>`).join('')}
<g clip-path="url(#${opts.id}o)">
<path d="${g.rim}" fill="url(#${opts.id}w)"/>
<ellipse cx="${d.cx}" cy="${d.cy.toFixed(2)}" rx="${d.rx.toFixed(2)}" ry="${d.ry.toFixed(2)}" fill="#07070a"/>
<ellipse cx="${d.cx}" cy="${d.cy.toFixed(2)}" rx="${d.rx.toFixed(2)}" ry="${d.ry.toFixed(2)}" fill="url(#${opts.id}g)"/>
${wedges}
</g>
<path d="${g.rim}" fill="none" stroke="url(#${opts.id}r)" stroke-width="1.1"/>
</svg>
`;
}

mkdirSync('public', { recursive: true });
mkdirSync('docs', { recursive: true });
writeFileSync('public/favicon.svg', svg(0.62, { pad: 2, swirl: false, cracks: 5, id: 'f' }));
writeFileSync('docs/logo.svg', svg(0.62, { pad: 12, swirl: true, cracks: 5, id: 'l' }));
console.log('wrote public/favicon.svg, docs/logo.svg');
