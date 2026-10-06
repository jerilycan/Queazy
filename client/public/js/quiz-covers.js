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
