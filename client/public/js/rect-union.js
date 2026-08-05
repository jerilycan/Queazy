// Calcule le(s) contour(s) extérieur(s) de l'union de plusieurs rectangles
// axis-aligned (coordonnées normalisées 0-1) — utilisé pour afficher les
// zones de bonne réponse du type "image" comme UNE forme fusionnée (y
// compris en L/T si les rectangles ne s'alignent pas entre eux), plutôt que
// des rectangles empilés avec des bordures qui se chevauchent visuellement.
// Fichier partagé entre l'éditeur (editor.js) et le jeu (index.js), chargé
// via <script> classique (pas de module) — d'où la fonction exposée en
// global plutôt qu'un export.
//
// Ne touche JAMAIS aux données stockées (toujours une liste de rectangles,
// voir q.correct) ni au scoring serveur (distance au rectangle le plus
// proche) : uniquement l'affichage.
//
// Principe : les bords de tous les rectangles découpent le plan en une
// grille de petites cellules ; on marque les cellules couvertes par au
// moins un rectangle, puis on suit le contour de la zone couverte (chaque
// bord de cellule entre "couvert" et "non couvert" fait partie du contour).
// Gère nativement plusieurs zones disjointes (plusieurs contours en sortie)
// et les trous éventuels (rectangles disposés en anneau) — le rendu SVG doit
// utiliser fill-rule="evenodd" pour que ces trous s'affichent correctement.
function computeRectUnionContours(rects) {
  const list = (Array.isArray(rects) ? rects : []).filter(r => r && typeof r.x0 === 'number' && r.x1 > r.x0 && r.y1 > r.y0)
  if (list.length === 0) return []

  // Précision limitée avant dédoublonnage : deux bords issus d'un même
  // glisser-déposer peuvent différer de quelques poussières de flottant sans
  // être "vraiment" différents.
  const round = (v) => Math.round(v * 1e6) / 1e6
  const xsSet = new Set(), ysSet = new Set()
  list.forEach(r => { xsSet.add(round(r.x0)); xsSet.add(round(r.x1)); ysSet.add(round(r.y0)); ysSet.add(round(r.y1)) })
  const xs = Array.from(xsSet).sort((a, b) => a - b)
  const ys = Array.from(ysSet).sort((a, b) => a - b)
  const nx = xs.length - 1, ny = ys.length - 1
  if (nx <= 0 || ny <= 0) return []

  // covered[i][j] : la cellule [xs[i],xs[i+1]] x [ys[j],ys[j+1]] est-elle
  // recouverte par au moins un rectangle ? Le centre de la cellule suffit :
  // les bords de grille viennent exactement des bords des rectangles, donc
  // le centre d'une cellule est toujours strictement dedans ou dehors,
  // jamais pile sur un bord (pas d'ambiguïté flottante à gérer ici).
  const covered = []
  for (let i = 0; i < nx; i++) {
    const cx = (xs[i] + xs[i + 1]) / 2
    const col = []
    for (let j = 0; j < ny; j++) {
      const cy = (ys[j] + ys[j + 1]) / 2
      col.push(list.some(r => cx > r.x0 && cx < r.x1 && cy > r.y0 && cy < r.y1))
    }
    covered.push(col)
  }
  const isCovered = (i, j) => i >= 0 && i < nx && j >= 0 && j < ny && covered[i][j]

  // Bords de contour : pour chaque cellule couverte, chaque côté dont le
  // voisin n'est PAS couvert est un segment de contour (un bord interne entre
  // deux cellules toutes deux couvertes est donc invisible dans le résultat —
  // c'est précisément ce qui fait disparaître la "couture" entre rectangles
  // adjacents). Un bord = point de départ -> point d'arrivée (indices de
  // grille), orienté de façon cohérente pour permettre le chaînage ; le sens
  // de rotation final n'a pas d'importance pour un remplissage evenodd.
  const edges = new Map()
  const addEdge = (x1, y1, x2, y2) => { edges.set(`${x1},${y1}`, [x2, y2]) }
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      if (!covered[i][j]) continue
      if (!isCovered(i, j - 1)) addEdge(i, j, i + 1, j)         // haut
      if (!isCovered(i, j + 1)) addEdge(i + 1, j + 1, i, j + 1) // bas
      if (!isCovered(i - 1, j)) addEdge(i, j + 1, i, j)         // gauche
      if (!isCovered(i + 1, j)) addEdge(i + 1, j, i + 1, j + 1) // droite
    }
  }

  // Chaînage des segments en boucles fermées. Un point de grille n'a
  // normalement qu'UN bord sortant non utilisé à la fois (région simple) ;
  // aux rares points de pincement en diagonale (deux rectangles qui ne se
  // touchent qu'à un coin), le Map ne garde que le dernier bord enregistré
  // pour ce point — cas limite accepté (survient très rarement avec des
  // rectangles dessinés à la main, sans jamais faire planter le calcul).
  const used = new Set()
  const loops = []
  for (const startKey of edges.keys()) {
    if (used.has(startKey)) continue
    const loopIdx = []
    let currentKey = startKey
    let guard = 0
    while (!used.has(currentKey) && guard++ < 10000) {
      used.add(currentKey)
      const [xi, yi] = currentKey.split(',').map(Number)
      loopIdx.push([xi, yi])
      const next = edges.get(currentKey)
      if (!next) break
      currentKey = `${next[0]},${next[1]}`
      if (currentKey === startKey) break
    }
    if (loopIdx.length >= 3) loops.push(loopIdx)
  }

  // Reconvertit les indices de grille en coordonnées réelles (0-1), et
  // simplifie en retirant les points intermédiaires alignés (3 points
  // consécutifs colinéaires) pour ne garder que les vrais coins du contour.
  return loops.map(loop => {
    const pts = loop.map(([xi, yi]) => [xs[xi], ys[yi]])
    const simplified = []
    for (let k = 0; k < pts.length; k++) {
      const prev = pts[(k - 1 + pts.length) % pts.length]
      const cur = pts[k]
      const next = pts[(k + 1) % pts.length]
      const collinear = (Math.abs(prev[0] - cur[0]) < 1e-9 && Math.abs(cur[0] - next[0]) < 1e-9) ||
                         (Math.abs(prev[1] - cur[1]) < 1e-9 && Math.abs(cur[1] - next[1]) < 1e-9)
      if (!collinear) simplified.push(cur)
    }
    return simplified.length >= 3 ? simplified : pts
  })
}

// Construit l'attribut "d" d'un <path> SVG à partir des contours (voir
// computeRectUnionContours), coordonnées mises à l'échelle 0-100 (cohérent
// avec un viewBox="0 0 100 100" et le positionnement en % utilisé ailleurs).
function rectUnionContoursToSvgPath(rects) {
  const loops = computeRectUnionContours(rects)
  return loops.map(loop => {
    const [first, ...rest] = loop
    const toStr = ([x, y]) => `${(x * 100).toFixed(3)},${(y * 100).toFixed(3)}`
    return `M ${toStr(first)} L ${rest.map(toStr).join(' ')} Z`
  }).join(' ')
}
