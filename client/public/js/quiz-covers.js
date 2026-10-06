// Bibliothèque des images de couverture des quiz (tâche 051). Pour en ajouter : déposer le fichier dans
// client/public/img/quiz-covers/ puis ajouter une ligne ci-dessous. L'id est ce qui est enregistré avec
// le quiz (colonne quizzes.cover) : ne jamais le changer une fois publié. Un id retiré de la liste
// retombe simplement sur les initiales.
//   { id: 'foot', label: 'Football', src: '/img/quiz-covers/foot.png' },
window.QUIZ_COVERS = [
]

// URL de l'image d'un id, ou null (aucune image choisie / id inconnu).
window.quizCoverSrc = (id) => {
  const found = id ? window.QUIZ_COVERS.find(c => c.id === id) : null
  return found ? found.src : null
}

// Image automatique d'un quiz sans image choisie : initiales du titre sur un dégradé dont la couleur dépend
// de l'identité du quiz (id, ou titre tant qu'il n'est pas enregistré) — la même dans l'éditeur et sur sa carte.
const QUIZ_AUTO_ACCENTS = [
  ['var(--tile-blue)', 'var(--tile-blue-deep)'],
  ['var(--color-accent)', 'var(--color-accent-2)'],
  ['var(--tile-green)', 'var(--tile-green-deep)'],
  ['var(--color-teal)', '#0a7d63'],
  ['var(--tile-bronze)', 'var(--tile-bronze-deep)'],
  ['var(--color-violet)', '#7a2fa8']
]
window.quizAutoTile = (seed, title) => {
  let hash = 0
  for (const c of String(seed || title || '')) hash = (hash * 31 + c.charCodeAt(0)) >>> 0
  const [a, a2] = QUIZ_AUTO_ACCENTS[hash % QUIZ_AUTO_ACCENTS.length]
  const initials = (title || '').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
  return { background: `linear-gradient(135deg, ${a} 0%, ${a2} 100%)`, initials }
}
