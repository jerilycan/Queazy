// Animation de fin de partie (tâche 049) : tous les joueurs (ou équipes) apparaissent en cartes,
// se réordonnent question après question, puis tous sauf les trois premiers sont éliminés en
// rafale — ordre aléatoire, effets qui se chevauchent — avec l'un des 6 effets ci-dessous.
// Le podium actuel (results.js runRace) prend ensuite le relais.
//
// L'effet et l'ordre d'élimination dépendent d'une graine fournie par l'appelant (code de salle) :
// TV, joueurs et MJ voient donc la même animation. Tout est animé en WAAPI (transform / opacity /
// filter / clip-path) ; aucune dépendance.
;(() => {
  const EO = 'cubic-bezier(0.23, 1, 0.32, 1)'
  const IO = 'cubic-bezier(0.77, 0, 0.175, 1)'
  const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)'
  const CW = 112 // taille de base d'une carte (px), mise à l'échelle par layout()
  const CH = 66
  const CANCEL = Symbol('cancel')

  const isAvatarUrl = (s) => typeof s === 'string' && /^(data:|https?:|blob:|\/)/.test(s)
  const mulberry32 = (seed) => {
    let a = seed | 0
    return () => {
      a = (a + 0x6D2B79F5) | 0
      let t = Math.imul(a ^ (a >>> 15), 1 | a)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }
  const h = (cls, html = '') => { const e = document.createElement('div'); e.className = cls; if (html) e.innerHTML = html; return e }

  // ---------------------------------------------------------------- moteur
  const run = ({ stage, entities, raceHistory, seed, canSkip, onDone }) => {
    const tok = { dead: false }
    const rnd = mulberry32(seed)
    const N = entities.length
    const Q = raceHistory.length
    const W = stage.clientWidth, Hh = stage.clientHeight
    const sleep = (ms) => new Promise((res, rej) => setTimeout(() => (tok.dead ? rej(CANCEL) : res()), ms))
    const A = (el, kf, o = {}) => el.animate(kf, { fill: 'forwards', easing: EO, ...o }).finished.catch(() => {})
    const hue = (i) => (i * 360) / N
    const color = (i) => `linear-gradient(135deg, hsl(${hue(i)} 85% 58%), hsl(${(hue(i) + 40) % 360} 80% 46%))`
    const solid = (i) => `hsl(${hue(i)} 82% 62%)`

    // Points cumulés par question (deltas de l'historique) ; le score réel (ajustements du MJ compris)
    // est recalé une fois la course terminée.
    const cum = []
    raceHistory.forEach((hq, q) => cum.push(entities.map((e, i) => (Number(hq.deltas?.[e.id]) || 0) + (q ? cum[q - 1][i] : 0))))
    const maxTotal = Math.max(1, ...entities.map(e => e.score || 0), ...(cum.length ? cum[Q - 1] : [0]))

    const status = h('fin-status')
    stage.appendChild(status)
    const setStatus = (txt) => { status.textContent = txt }
    stage.insertBefore(h('fin-grid'), stage.firstChild)

    const countUp = (el, from, to, ms) => {
      const t0 = performance.now()
      const step = (now) => {
        if (tok.dead) return
        const p = Math.min(1, (now - t0) / ms)
        el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))).toLocaleString('fr-FR') + ' pts'
        if (p < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }

    // m cartes → centre + échelle de chacune ; on retient le nombre de colonnes qui donne les cartes les plus grandes.
    const layout = (m) => {
      const areaW = W * 0.94, areaH = Hh - 118
      let best = null
      for (let cols = 1; cols <= m; cols++) {
        const rows = Math.ceil(m / cols)
        const s = Math.min(2.6, areaW / (cols * (CW + 16)), areaH / (rows * (CH + 16)))
        if (!best || s > best.s + 1e-6) best = { cols, rows, s }
      }
      const { cols, rows, s } = best
      return Array.from({ length: m }, (_, k) => {
        const row = Math.floor(k / cols), inRow = row === rows - 1 ? m - cols * (rows - 1) : cols
        const col = k - row * cols
        return { x: W / 2 + (col - (inRow - 1) / 2) * (CW + 16) * s, y: 74 + areaH / 2 + (row - (rows - 1) / 2) * (CH + 16) * s, s }
      })
    }
    const pose = (x, y, s) => `translate(${x - CW / 2}px, ${y - CH / 2}px) scale(${s})`

    // ---- cartes (noms et avatars posés en textContent : jamais d'HTML venant des joueurs)
    const C = entities.map((e, i) => {
      const el = h('fin-card')
      const rank = h('fin-rank'); rank.textContent = String(i + 1)
      const av = h('fin-av')
      if (isAvatarUrl(e.avatar)) { av.style.backgroundImage = `url(${e.avatar})` } else { av.style.background = color(i); av.textContent = e.avatar || (e.name || '?').slice(0, 2).toUpperCase() }
      const name = h('fin-name'); name.textContent = e.name || ''; name.style.color = solid(i)
      const score = h('fin-score'); score.textContent = '0 pts'
      const bar = h('fin-bar', '<i style="transform:scaleX(.05)"></i>')
      el.append(rank, av, name, score, bar)
      stage.appendChild(el)
      return { i, e, el, rank, score, bar: bar.firstChild, x: W / 2, y: Hh / 2, s: 1, v: 0.05 }
    })
    const place = (p, L, ms) => { A(p.el, [{ transform: pose(p.x, p.y, p.s) }, { transform: pose(L.x, L.y, L.s) }], { duration: ms, easing: IO }); p.x = L.x; p.y = L.y; p.s = L.s }
    const rankOrderAt = (q) => [...Array(N).keys()].sort((a, b) => cum[q][b] - cum[q][a] || a - b)
    const clone = (p) => { const c = p.el.cloneNode(true); c.style.transform = pose(p.x, p.y, p.s); c.style.zIndex = 8; stage.appendChild(c); return c }

    // ---- effets communs
    const flash = (col = '#fff', peak = 0.9, ms = 700) => {
      const f = h('fin-flash'); f.style.background = col
      stage.appendChild(f)
      return A(f, [{ opacity: 0 }, { opacity: peak, offset: 0.25 }, { opacity: 0 }], { duration: ms }).then(() => f.remove())
    }
    const shockwave = (cx, cy, col = 'rgba(255,255,255,.85)', size = 900, ms = 900) => {
      const w = h('fin-wave'); w.style.cssText = `left:${cx}px;top:${cy}px;border-color:${col};box-shadow:0 0 30px ${col}`
      stage.appendChild(w)
      return A(w, [{ opacity: 0.9, transform: 'scale(.3)' }, { opacity: 0, transform: `scale(${size / 60})` }], { duration: ms }).then(() => w.remove())
    }
    const embers = (x, y, n = 12, col = '#7fe6ff') => {
      for (let k = 0; k < n; k++) {
        const e = h('fin-dust'); const s = 4 + (k % 3) * 2
        e.style.cssText = `left:${x}px;top:${y}px;width:${s}px;height:${s}px;background:${col};border-radius:2px;box-shadow:0 0 8px ${col}`
        stage.appendChild(e)
        const ang = (k / n) * Math.PI * 2 + k; const d = 40 + ((k * 17) % 60)
        A(e, [{ opacity: 1, transform: 'translate(0,0)' }, { opacity: 0, transform: `translate(${Math.cos(ang) * d}px, ${Math.sin(ang) * d - 30}px)` }], { duration: 700 }).then(() => e.remove())
      }
    }

    // ---- les 6 effets d'élimination : chacun rend une promesse résolue quand la carte a disparu
    const EFFECTS = [
      { // 0 — corruption : glitch RVB, tranches décalées, parasites
        intro: 'Signal instable…', kill: (nm, rk) => `👾 ${nm} est corrompu·e ! (${rk}ᵉ)`,
        effect: async (p, f) => {
          p.el.classList.add('fin-glitch')
          const j = (dx, dy) => ({ transform: pose(p.x + dx, p.y + dy, p.s) })
          A(p.el, [j(0, 0), j(-7, 1), j(6, -2), j(-4, 2), j(8, 0), j(-9, -1), j(0, 0)], { duration: 520 * f, easing: 'steps(7)' })
          await sleep(540 * f)
          p.el.classList.remove('fin-glitch')
          const strips = 8
          for (let k = 0; k < strips; k++) {
            const cl = clone(p); cl.classList.add('fin-glitch')
            cl.style.clipPath = `inset(${(k * 100) / strips}% -14px ${100 - ((k + 1) * 100) / strips}% -14px)`
            const dir = k % 2 ? 1 : -1; const dx = dir * (30 + ((k * 37) % 70)) * p.s
            A(cl, [
              { transform: pose(p.x, p.y, p.s), opacity: 1 },
              { transform: `${pose(p.x + dx * 0.4, p.y, p.s)} skewX(${dir * 18}deg)`, opacity: 1, offset: 0.35 },
              { transform: `${pose(p.x + dx * 0.4, p.y, p.s)} skewX(${dir * 18}deg)`, opacity: 0.2, offset: 0.5 },
              { transform: `${pose(p.x + dx * 1.4, p.y, p.s)} skewX(${dir * 30}deg)`, opacity: 1, offset: 0.6 },
              { transform: `${pose(p.x + dx * 3, p.y, p.s)} skewX(${dir * 40}deg)`, opacity: 0 }
            ], { duration: 760 * f, delay: k * 35, easing: 'steps(12)', fill: 'both' }).then(() => cl.remove())
          }
          A(p.el, [{ opacity: 1 }, { opacity: 0 }], { duration: 20 })
          for (let k = 0; k < 14; k++) {
            const e = h('fin-dust'); const w = 20 + ((k * 29) % 70) * p.s, hh = 3 + (k % 3) * 2
            e.style.cssText = `left:${p.x - (CW * p.s) / 2 + ((k * 53) % (CW * p.s))}px;top:${p.y - (CH * p.s) / 2 + ((k * 31) % (CH * p.s))}px;width:${w}px;height:${hh}px;background:${k % 2 ? '#ff2fb3' : '#00e5ff'};mix-blend-mode:screen`
            stage.appendChild(e)
            A(e, [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 0, offset: 0.4 }, { opacity: 1, offset: 0.6 }, { opacity: 0 }], { duration: 600 * f, delay: k * 30, easing: 'steps(5)', fill: 'both' }).then(() => e.remove())
          }
          await sleep(900 * f)
        }
      },
      { // 1 — verrouillage : réticule puis éclatement en éclats de verre
        intro: 'Acquisition des cibles…', kill: (nm, rk) => `🎯 ${nm} est verrouillé·e ! (${rk}ᵉ)`,
        effect: async (p, f) => {
          const R = Math.max(CW * p.s * 0.62, 70)
          const ret = h('fin-reticle', '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="38"/><circle cx="50" cy="50" r="22" class="in"/><path d="M50 2v22M50 76v22M2 50h22M76 50h22"/></svg>')
          ret.style.cssText = `left:${p.x}px;top:${p.y}px;width:${R * 1.9}px;height:${R * 1.9}px;margin:${-R * 0.95}px 0 0 ${-R * 0.95}px`
          stage.appendChild(ret)
          await A(ret, [{ opacity: 0, transform: 'scale(3.2) rotate(-120deg)' }, { opacity: 1, transform: 'scale(1) rotate(0deg)' }], { duration: 480 * f })
          await A(ret, [{ opacity: 1 }, { opacity: 0.2 }, { opacity: 1 }, { opacity: 0.2 }, { opacity: 1 }], { duration: 300 * f, easing: 'steps(5)' })
          flash('#fff', 0.25, 260); shockwave(p.x, p.y, 'rgba(255,77,109,.95)', 320, 600 * f)
          const cols = 6, rows = 4
          for (let r2 = 0; r2 < rows; r2++) {
            for (let c2 = 0; c2 < cols; c2++) {
              const cl = clone(p)
              cl.style.clipPath = `inset(${(r2 * 100) / rows}% ${100 - ((c2 + 1) * 100) / cols}% ${100 - ((r2 + 1) * 100) / rows}% ${(c2 * 100) / cols}%)`
              const ux = (c2 + 0.5) / cols - 0.5, uy = (r2 + 0.5) / rows - 0.5
              const vx = ux * 340 + (rnd() - 0.5) * 60, vy = uy * 220 - 90 - rnd() * 70, rot = (rnd() - 0.5) * 420
              const at = (t) => `${pose(p.x + vx * t * p.s, p.y + vy * t + 520 * t * t, p.s)} rotate(${rot * t}deg)`
              A(cl, [{ transform: at(0), opacity: 1 }, { transform: at(0.4), opacity: 1, offset: 0.4 }, { transform: at(1), opacity: 0 }], { duration: 1000 * f, easing: 'linear', fill: 'both' }).then(() => cl.remove())
            }
          }
          A(p.el, [{ opacity: 1 }, { opacity: 0 }], { duration: 20 })
          A(ret, [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.5)' }], { duration: 400 * f })
          embers(p.x, p.y, 14)
          await sleep(1000 * f)
          ret.remove()
        }
      },
      { // 2 — téléportation : faisceau montant, carte dissoute de bas en haut
        intro: 'Faisceau de téléportation prêt…', kill: (nm, rk) => `🛸 ${nm} est téléporté·e ! (${rk}ᵉ)`,
        effect: async (p, f) => {
          const w = CW * p.s, hh = CH * p.s, x0 = p.x - w / 2, y0 = p.y - hh / 2
          const beam = h('fin-beam'); beam.style.cssText = `left:${x0 - 6}px;width:${w + 12}px;top:0;height:${y0 + hh}px`
          stage.appendChild(beam)
          const portal = h('fin-portal'); portal.style.cssText = `left:${p.x - w * 0.62}px;top:${y0 + hh - 8}px;width:${w * 1.24}px;height:22px`
          stage.appendChild(portal)
          A(beam, [{ opacity: 0, transform: 'scaleX(.1)' }, { opacity: 1, transform: 'scaleX(1)' }], { duration: 380 * f, fill: 'both' })
          A(portal, [{ opacity: 0, transform: 'scale(.3)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 380 * f, easing: SPRING, fill: 'both' })
          await sleep(420 * f)
          const dur = 900 * f
          A(p.el, [{ clipPath: 'inset(-12px -12px -12px -12px)' }, { clipPath: 'inset(-12px -12px 100% -12px)' }], { duration: dur, easing: 'linear', fill: 'both' })
          const line = h('fin-dust'); line.style.cssText = `left:${x0 - 8}px;width:${w + 16}px;height:3px;top:${y0 + hh}px;background:#fff;box-shadow:0 0 14px 4px #7fe6ff;z-index:9`
          stage.appendChild(line)
          A(line, [{ transform: 'translateY(0)', opacity: 1 }, { transform: `translateY(${-hh}px)`, opacity: 1, offset: 0.95 }, { transform: `translateY(${-hh}px)`, opacity: 0 }], { duration: dur, easing: 'linear' }).then(() => line.remove())
          for (let k = 0; k < 30; k++) {
            const u = (k % 10) / 10 + 0.04, tt = Math.floor(k / 10) / 3 + (k % 3) * 0.04
            const b = h('fin-dust'); const bh = 14 + ((k * 13) % 30), bw = 2 + (k % 2)
            b.style.cssText = `left:${x0 + u * w}px;top:${y0 + hh * (1 - tt) - bh}px;width:${bw}px;height:${bh}px;background:linear-gradient(0deg,#fff,#7fe6ff 40%,transparent)`
            stage.appendChild(b)
            A(b, [{ opacity: 0, transform: 'translateY(0)' }, { opacity: 1, transform: 'translateY(0)', offset: 0.05 }, { opacity: 0, transform: `translateY(${-(90 + ((k * 23) % 130))}px)` }], { duration: 900 * f, delay: tt * dur, fill: 'both' }).then(() => b.remove())
          }
          await sleep(dur + 150)
          A(beam, [{ opacity: 1 }, { opacity: 0 }], { duration: 300 * f }); A(portal, [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.3)' }], { duration: 300 * f })
          shockwave(p.x, y0 + hh, 'rgba(127,230,255,.9)', 300, 600 * f)
          await sleep(450 * f)
          beam.remove(); portal.remove()
        }
      },
      { // 3 — surcharge : arcs électriques, la carte sature puis éclate
        intro: 'Tension critique…', kill: (nm, rk) => `⚡ ${nm} surcharge ! (${rk}ᵉ)`,
        effect: async (p, f) => {
          const w = CW * p.s, hh = CH * p.s
          const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
          svg.setAttribute('class', 'fin-bolt'); svg.setAttribute('viewBox', `0 0 ${W} ${Hh}`)
          const arcs = []
          for (let k = 0; k < 6; k++) {
            const side = k % 4; const t = rnd()
            const sx = side === 0 ? p.x - w / 2 + t * w : side === 1 ? p.x + w / 2 : side === 2 ? p.x - w / 2 + t * w : p.x - w / 2
            const sy = side === 0 ? p.y - hh / 2 : side === 1 ? p.y - hh / 2 + t * hh : side === 2 ? p.y + hh / 2 : p.y - hh / 2 + t * hh
            const ang = Math.atan2(sy - p.y, sx - p.x) + (rnd() - 0.5) * 0.9; const len = 50 + rnd() * 70
            const pts = []
            for (let j = 0; j <= 7; j++) { const u = j / 7; pts.push(`${sx + Math.cos(ang) * len * u + (j && j < 7 ? (rnd() - 0.5) * 22 : 0)},${sy + Math.sin(ang) * len * u + (j && j < 7 ? (rnd() - 0.5) * 22 : 0)}`) }
            arcs.push(`<polyline points="${pts.join(' ')}"/>`)
          }
          svg.innerHTML = arcs.join('')
          stage.appendChild(svg)
          A(svg, [{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 0.25, offset: 0.25 }, { opacity: 1, offset: 0.4 }, { opacity: 0.3, offset: 0.55 }, { opacity: 1, offset: 0.7 }, { opacity: 0.4, offset: 0.85 }, { opacity: 1 }], { duration: 620 * f, easing: 'steps(8)', fill: 'both' })
          const j = (dx, dy, br) => ({ transform: pose(p.x + dx, p.y + dy, p.s), filter: `brightness(${br}) saturate(${br})` })
          await A(p.el, [j(0, 0, 1), j(-4, 1, 1.8), j(5, -2, 2.4), j(-6, 2, 1.6), j(6, 0, 3), j(-3, -1, 2.2), j(0, 0, 4)], { duration: 620 * f, easing: 'steps(7)' })
          flash('#bfe9ff', 0.3, 260); shockwave(p.x, p.y, 'rgba(160,220,255,.95)', 380, 600 * f)
          embers(p.x, p.y, 20, '#9fe0ff')
          A(svg, [{ opacity: 1 }, { opacity: 0 }], { duration: 160 * f }).then(() => svg.remove())
          await A(p.el, [{ transform: pose(p.x, p.y, p.s), filter: 'brightness(4) saturate(2)', opacity: 1 }, { transform: pose(p.x, p.y, p.s * 1.3), filter: 'brightness(6) saturate(0)', opacity: 0 }], { duration: 260 * f })
        }
      },
      { // 4 — implosion : lignes de force, la carte s'effondre sur elle-même
        intro: 'Champ gravitationnel instable…', kill: (nm, rk) => `🌀 ${nm} implose ! (${rk}ᵉ)`,
        effect: async (p, f) => {
          const R0 = Math.max(110, CW * p.s * 1.1)
          for (let k = 0; k < 16; k++) {
            const ang = (k / 16) * Math.PI * 2 + rnd() * 0.3; const d = R0 * (0.9 + rnd() * 0.5)
            const e = h('fin-dust'); e.style.cssText = `left:${p.x}px;top:${p.y}px;width:34px;height:2px;margin:-1px 0 0 -17px;background:linear-gradient(90deg,transparent,#aef2ff);border-radius:2px`
            stage.appendChild(e)
            const fx = Math.cos(ang) * d, fy = Math.sin(ang) * d
            A(e, [{ opacity: 0, transform: `translate(${fx}px, ${fy}px) rotate(${ang}rad)` }, { opacity: 1, transform: `translate(${fx * 0.7}px, ${fy * 0.7}px) rotate(${ang}rad)`, offset: 0.25 }, { opacity: 0, transform: `translate(0px, 0px) rotate(${ang}rad) scaleX(.2)` }], { duration: 520 * f, delay: k * 18, easing: 'cubic-bezier(0.55, 0, 1, 0.5)', fill: 'both' }).then(() => e.remove())
          }
          A(p.el, [
            { transform: `${pose(p.x, p.y, p.s)} rotate(0deg)`, filter: 'brightness(1)', opacity: 1 },
            { transform: `${pose(p.x, p.y, p.s * 1.12)} rotate(-4deg)`, filter: 'brightness(1.6)', opacity: 1, offset: 0.28 },
            { transform: `${pose(p.x, p.y, 0.02)} rotate(520deg)`, filter: 'brightness(5)', opacity: 1, offset: 0.94 },
            { transform: `${pose(p.x, p.y, 0.02)} rotate(560deg)`, filter: 'brightness(5)', opacity: 0 }
          ], { duration: 640 * f, easing: 'cubic-bezier(0.6, -0.28, 0.74, 0.05)', fill: 'both' })
          await sleep(620 * f)
          flash('#fff', 0.2, 220); shockwave(p.x, p.y, 'rgba(174,242,255,.95)', 300, 520 * f)
          embers(p.x, p.y, 12, '#ffffff')
          await sleep(200 * f)
        }
      },
      { // 5 — effacement pixel : la carte se découpe en dalles qui s'éteignent dans le désordre
        intro: 'Suppression des données…', kill: (nm, rk) => `▦ ${nm} est effacé·e ! (${rk}ᵉ)`,
        effect: async (p, f) => {
          const cols = 8, rows = 4, n = cols * rows
          const order = [...Array(n).keys()].sort(() => rnd() - 0.5)
          const dur = 620 * f
          for (let k = 0; k < n; k++) {
            const r2 = Math.floor(k / cols), c2 = k % cols
            const cl = clone(p)
            cl.style.clipPath = `inset(${(r2 * 100) / rows}% ${100 - ((c2 + 1) * 100) / cols}% ${100 - ((r2 + 1) * 100) / rows}% ${(c2 * 100) / cols}%)`
            const when = (order.indexOf(k) / n) * dur
            A(cl, [
              { opacity: 1, filter: 'none', transform: pose(p.x, p.y, p.s) },
              { opacity: 1, filter: 'brightness(2.2) hue-rotate(160deg)', transform: pose(p.x, p.y, p.s), offset: 0.3 },
              { opacity: 0.2, filter: 'brightness(2.2) hue-rotate(160deg)', transform: pose(p.x, p.y, p.s), offset: 0.5 },
              { opacity: 1, filter: 'brightness(2.6) hue-rotate(160deg)', transform: pose(p.x, p.y - 4, p.s), offset: 0.7 },
              { opacity: 0, filter: 'brightness(3) hue-rotate(160deg)', transform: pose(p.x, p.y - 14, p.s) }
            ], { duration: 260, delay: when, easing: 'steps(6)', fill: 'both' }).then(() => cl.remove())
            if (k % 3 === 0) {
              const sp = h('fin-dust'); const sz = 4 + (k % 3)
              sp.style.cssText = `left:${p.x - (CW * p.s) / 2 + ((c2 + 0.5) / cols) * CW * p.s}px;top:${p.y - (CH * p.s) / 2 + ((r2 + 0.5) / rows) * CH * p.s}px;width:${sz}px;height:${sz}px;background:#aef2ff;box-shadow:0 0 8px #7fe6ff`
              stage.appendChild(sp)
              A(sp, [{ opacity: 0, transform: 'none' }, { opacity: 1, transform: 'none', offset: 0.1 }, { opacity: 0, transform: `translate(${(rnd() - 0.5) * 50}px, ${-30 - rnd() * 60}px)` }], { duration: 600 * f, delay: when + 120, fill: 'both' }).then(() => sp.remove())
            }
          }
          A(p.el, [{ opacity: 1 }, { opacity: 0 }], { duration: 20 })
          await sleep(dur + 300)
        }
      }
    ]
    const FX = EFFECTS[Math.abs(seed) % EFFECTS.length]

    // ---- 3 joueurs ou moins : pas d'élimination, mais une cérémonie de révélation du podium —
    // cartes assombries, compte à rebours, puis un faisceau révèle la 3ᵉ, la 2ᵉ et enfin la 1ʳᵉ place.
    const ceremony = async () => {
      setStatus('Le podium se prépare…')
      C.forEach(p => A(p.el, [{ filter: 'none' }, { filter: 'blur(2.5px) brightness(0.45)' }], { duration: 500 }))
      await sleep(700)
      for (const n of [3, 2, 1]) {
        const t = h('fin-count'); t.textContent = String(n)
        stage.appendChild(t)
        A(t, [{ opacity: 0, transform: 'scale(2.2)' }, { opacity: 1, transform: 'scale(1)', offset: 0.35 }, { opacity: 0, transform: 'scale(0.8)' }], { duration: 800 }).then(() => t.remove())
        shockwave(W / 2, Hh / 2, 'rgba(127,230,255,.8)', 700, 800)
        await sleep(800)
      }
      const MEDAL = ['🥇', '🥈', '🥉']; const TONE = ['fin-gold', 'fin-silver', 'fin-bronze']
      const LABEL = ['🏆 Premier !', '🥈 Deuxième', '🥉 Troisième']
      for (let r = N - 1; r >= 0; r--) {
        const p = C[r]; const w = CW * p.s, hh = CH * p.s, x0 = p.x - w / 2, y0 = p.y - hh / 2
        setStatus(LABEL[r])
        const beam = h('fin-beam'); beam.style.cssText = `left:${x0 - 10}px;width:${w + 20}px;top:0;height:${y0 + hh / 2}px${r === 0 ? ';background:linear-gradient(180deg,transparent,rgba(255,210,74,.18) 30%,rgba(255,236,170,.6))' : ''}`
        stage.appendChild(beam)
        await A(beam, [{ opacity: 0, transform: 'scaleX(.1)' }, { opacity: 1, transform: 'scaleX(1)' }], { duration: 380, fill: 'both' })
        await A(p.el, [{ filter: 'blur(2.5px) brightness(0.45)', transform: pose(p.x, p.y, p.s) }, { filter: 'blur(0) brightness(3)', transform: pose(p.x, p.y, p.s * 1.18), offset: 0.4 }, { filter: 'none', transform: pose(p.x, p.y, p.s * 1.1) }], { duration: 650 })
        p.el.classList.add(TONE[r])
        const medal = h('fin-medal'); medal.textContent = MEDAL[r]; medal.style.cssText = `left:${p.x}px;top:${y0 - 4}px`
        stage.appendChild(medal)
        A(medal, [{ opacity: 0, transform: 'scale(0) rotate(-40deg)' }, { opacity: 1, transform: 'scale(1) rotate(0deg)' }], { duration: 500, easing: SPRING })
        shockwave(p.x, p.y, r === 0 ? 'rgba(255,210,74,.95)' : 'rgba(174,242,255,.9)', r === 0 ? 700 : 420, 700)
        embers(p.x, p.y, r === 0 ? 24 : 14, r === 0 ? '#ffd24a' : '#aef2ff')
        if (r === 0) flash('#fff', 0.55, 700)
        A(beam, [{ opacity: 1 }, { opacity: 0 }], { duration: 500 }).then(() => beam.remove())
        await sleep(r === 0 ? 1500 : 1000)
      }
      await sleep(300)
    }

    let skipBtn = null
    const finish = () => { if (skipBtn) skipBtn.remove(); onDone() }
    const skip = () => { if (tok.dead) return; tok.dead = true; stage.querySelectorAll('*').forEach(el => el.getAnimations?.().forEach(a => a.cancel())); finish() }
    if (canSkip) {
      skipBtn = document.createElement('button')
      skipBtn.type = 'button'; skipBtn.className = 'fin-skip'; skipBtn.textContent = 'Passer ▶'
      skipBtn.onclick = skip
      stage.appendChild(skipBtn)
    }

    const go = async () => {
      // --- arrivée des cartes
      const L0 = layout(N)
      rankOrderAt(0).forEach((i, k) => {
        const p = C[i]; p.x = L0[k].x; p.y = L0[k].y; p.s = L0[k].s; p.rank.textContent = String(k + 1)
        A(p.el, [{ transform: pose(p.x, p.y, 0.3), opacity: 0 }, { transform: pose(p.x, p.y, p.s), opacity: 1 }], { duration: 520, delay: Math.min(k, 40) * 30, easing: SPRING, fill: 'both' })
      })
      await sleep(650 + Math.min(N, 40) * 30)
      // --- la course : classement recalculé à chaque question
      const stepMs = Math.min(620, Math.max(260, 3400 / Q)), move = stepMs * 0.75
      for (let q = 0; q < Q; q++) {
        setStatus(`Question ${q + 1} / ${Q}`)
        rankOrderAt(q).forEach((i, k) => {
          const p = C[i]; const nv = 0.06 + 0.94 * (cum[q][i] / maxTotal)
          place(p, L0[k], move)
          A(p.bar, [{ transform: `scaleX(${p.v})` }, { transform: `scaleX(${nv})` }], { duration: move, easing: IO })
          countUp(p.score, q ? cum[q - 1][i] : 0, cum[q][i], move)
          p.rank.textContent = String(k + 1); p.v = nv
        })
        await sleep(stepMs)
      }
      // --- recalage sur les scores réels et classement final (ajustements manuels du MJ compris)
      entities.forEach((e, i) => { const p = C[i]; const nv = 0.06 + 0.94 * ((e.score || 0) / maxTotal); countUp(p.score, Q ? cum[Q - 1][i] : 0, e.score || 0, 400); A(p.bar, [{ transform: `scaleX(${p.v})` }, { transform: `scaleX(${nv})` }], { duration: 400 }); p.v = nv })
      C.forEach((p, k) => { place(p, L0[k], 500); p.rank.textContent = String(k + 1) }) // `entities` est déjà trié par score final
      await sleep(900)
      if (N <= 3) { await ceremony(); return }
      setStatus(FX.intro)
      await sleep(800)
      // --- rafale : ordre aléatoire (graine partagée) hors podium, intervalle qui raccourcit, effets qui se chevauchent
      const victims = C.slice(3).map(p => p.i).sort(() => rnd() - 0.5)
      const pending = []
      for (let k = 0; k < victims.length; k++) {
        const p = C[victims[k]]
        setStatus(FX.kill(p.e.name || '', p.i + 1))
        pending.push(FX.effect(p, 0.55).then(() => A(p.el, [{ opacity: 0 }, { opacity: 0 }], { duration: 10 })).catch(e => { if (e !== CANCEL) console.error(e) }))
        if (k < victims.length - 1) await sleep((380 - (250 * k) / Math.max(1, victims.length - 1)) * (0.6 + rnd() * 0.8))
      }
      await Promise.all(pending)
      // --- les trois survivants occupent tout le plateau, flash, podium
      const L3 = layout(3)
      C.slice(0, 3).forEach((p, k) => place(p, L3[k], 800))
      setStatus('✨ Les trois premiers')
      await sleep(1500)
      flash('#fff', 0.6, 800)
      await sleep(350)
      C.slice(0, 3).forEach(p => A(p.el, [{ opacity: 1 }, { opacity: 0 }], { duration: 300 }))
      await sleep(400)
    }
    go().then(() => { if (!tok.dead) { tok.dead = true; finish() } }).catch(e => { if (e !== CANCEL) { console.error(e); tok.dead = true; finish() } })
    return { skip }
  }

  window.QzFinale = { run }
})()
