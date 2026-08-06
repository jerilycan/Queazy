// Géométrie des zones de bonne réponse du type "image" — fichier partagé
// entre l'éditeur (editor.js) et le jeu (index.js), chargé via <script>
// classique (pas de module) — d'où des fonctions exposées en global plutôt
// qu'un export. Remplace rect-union.js : les zones sont désormais des formes
// libres tracées à main levée (polygones), plus seulement des rectangles.
//
// Une "zone" stockée (voir q.correct côté éditeur, room.currentQuestion.correct
// côté serveur) est soit :
//   - un polygone      : { points: [{x,y}, ...] }         (nouveau format)
//   - un rectangle legacy : { x0, y0, x1, y1 }             (anciens quiz)
// Toutes les fonctions ci-dessous acceptent les deux formats via
// zoneToPolygonPoints, qui les ramène à une liste de points commune — un
// rectangle legacy devient simplement son polygone à 4 coins. Coordonnées
// toujours normalisées (0-1) par rapport à l'image.

function zoneToPolygonPoints (zone) {
  if (!zone) return []
  if (Array.isArray(zone.points)) return zone.points
  if (typeof zone.x0 === 'number' && typeof zone.y0 === 'number' && typeof zone.x1 === 'number' && typeof zone.y1 === 'number') {
    return [
      { x: zone.x0, y: zone.y0 },
      { x: zone.x1, y: zone.y0 },
      { x: zone.x1, y: zone.y1 },
      { x: zone.x0, y: zone.y1 }
    ]
  }
  return []
}

// Ray-casting standard : pt est-il à l'intérieur du polygone (liste de
// points ordonnés) ? Fonctionne pour n'importe quel polygone simple (convexe
// ou non), ce qui est nécessaire ici puisqu'un tracé à main levée n'a aucune
// raison d'être convexe.
function pointInPolygon (pt, points) {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x, yi = points[i].y
    const xj = points[j].x, yj = points[j].y
    const intersect = ((yi > pt.y) !== (yj > pt.y)) &&
      (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

// Distance minimale d'un point au segment [a,b] (projection clampée).
function pointToSegmentDist (pt, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(pt.x - a.x, pt.y - a.y)
  let t = ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(pt.x - (a.x + t * dx), pt.y - (a.y + t * dy))
}

// Distance point -> polygone : 0 si le point est dedans, sinon distance au
// bord le plus proche. Sert de base au score de proximité ("Presque !"),
// même principe que l'ancienne distance de Chebyshev au rectangle, mais
// applicable à n'importe quelle forme.
function distPointToPolygon (pt, points) {
  if (points.length < 3) return Infinity
  if (pointInPolygon(pt, points)) return 0
  let min = Infinity
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length]
    const d = pointToSegmentDist(pt, a, b)
    if (d < min) min = d
  }
  return min
}

// Construit l'attribut "d" d'un <path> SVG regroupant plusieurs zones,
// chacune en sous-chemin indépendant (pas de fusion façon rect-union — une
// forme libre n'a pas de grille naturelle sur laquelle fusionner ; deux
// formes qui se touchent s'affichent juste superposées, ce qui reste correct
// visuellement). Coordonnées mises à l'échelle 0-100 (viewBox="0 0 100 100").
function zonesToSvgPath (zones) {
  const list = Array.isArray(zones) ? zones : []
  const toStr = (p) => `${(p.x * 100).toFixed(3)},${(p.y * 100).toFixed(3)}`
  return list.map(zone => {
    const pts = zoneToPolygonPoints(zone)
    if (pts.length < 3) return ''
    return `M ${toStr(pts[0])} L ${pts.slice(1).map(toStr).join(' ')} Z`
  }).filter(Boolean).join(' ')
}

// Nœuds Node.js (server/index.js) n'ont pas de scope global partagé avec le
// navigateur : ce fichier n'y est de toute façon jamais chargé (le serveur a
// sa propre copie de ces fonctions). Rien à exporter ici.
