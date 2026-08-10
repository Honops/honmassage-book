// progress.js
// Mémorise et restaure la progression de lecture (chapitre + position de
// défilement approximative) via localStorage. Aucune donnée envoyée
// à l'extérieur, tout reste sur l'appareil de l'utilisateur.

const HONOMASSAGE_PROGRESS_KEY = 'honomassage-progress';

function sauvegarderProgression(numeroChapitre, positionScroll) {
  const progression = {
    chapter: numeroChapitre,
    scroll: positionScroll,
    updatedAt: Date.now()
  };
  try {
    localStorage.setItem(HONOMASSAGE_PROGRESS_KEY, JSON.stringify(progression));
  } catch (e) {
    // localStorage indisponible (navigation privée, etc.) : on ignore sans casser la lecture.
  }
}

function lireProgression() {
  try {
    const brut = localStorage.getItem(HONOMASSAGE_PROGRESS_KEY);
    return brut ? JSON.parse(brut) : null;
  } catch (e) {
    return null;
  }
}

// Empêche d'écrire dans localStorage à chaque pixel scrollé.
function debounce(fonction, delaiMs) {
  let minuteur = null;
  return function (...args) {
    clearTimeout(minuteur);
    minuteur = setTimeout(() => fonction.apply(this, args), delaiMs);
  };
}

// Point d'entrée appelé par book.js une fois le contenu d'un chapitre affiché.
function suivreProgressionChapitre(numeroChapitre) {
  // Restaure la position si l'utilisateur relit ce même chapitre après une pause.
  const progression = lireProgression();
  if (progression && progression.chapter === numeroChapitre && progression.scroll) {
    // Petit délai pour laisser le contenu (et les images) se mettre en page avant de scroller.
    setTimeout(() => {
      window.scrollTo({ top: progression.scroll, behavior: 'auto' });
    }, 50);
  } else {
    // Nouveau chapitre : on repart du haut et on enregistre immédiatement ce chapitre comme "en cours".
    sauvegarderProgression(numeroChapitre, 0);
  }

  // Enregistre régulièrement la position de scroll pendant la lecture.
  const sauvegardeDifferee = debounce(() => {
    sauvegarderProgression(numeroChapitre, window.scrollY);
  }, 400);

  window.addEventListener('scroll', sauvegardeDifferee);
}
