// speech.js
// Lecture à voix haute du contenu d'un chapitre via la Web Speech API native.
// Le texte est segmenté par bloc DOM réel (titres, paragraphes, items de
// liste...) plutôt que comme un flux brut, ce qui permet à l'utilisateur de
// choisir un point de départ en touchant un bloc. Chaque bloc est ensuite
// lui-même découpé en segments courts (~200 caractères) pour éviter le bug
// connu de Chrome qui interrompt silencieusement les utterances trop longues.
// Gère aussi la vitesse de lecture et une musique d'ambiance optionnelle.

const HONOMASSAGE_RATE_KEY = 'honomassage-speech-rate';
const HONOMASSAGE_MUSIC_KEY = 'honomassage-music-enabled';
const HONOMASSAGE_POSITION_KEY = 'honomassage-speech-position';

let honomassageSegments = [];       // [{ text, blockIndex }]
let honomassageBlockStart = [];     // blockStart[i] = index du 1er segment du bloc i
let honomassageBlockElements = [];  // éléments DOM correspondant à chaque bloc
let honomassageIndexSegment = 0;
let honomassageEtatLecture = 'arret'; // 'arret' | 'lecture' | 'pause'
let honomassageRate = 1;
let honomassageMusicEnabled = false;
let honomassageAudio = null;
let honomassageBlocActifEl = null;

function numeroChapitreActuel() {
  const params = new URLSearchParams(window.location.search);
  const numero = parseInt(params.get('chapitre'), 10);
  return Number.isInteger(numero) && numero > 0 ? numero : 1;
}

function decouperEnSegments(texte, longueurMax) {
  longueurMax = longueurMax || 200;
  const phrases = texte.match(/[^.!?]+[.!?]+(\s+|$)/g) || [texte];
  const segments = [];
  let courant = '';

  phrases.forEach((phrase) => {
    if (courant.length > 0 && (courant.length + phrase.length) > longueurMax) {
      segments.push(courant.trim());
      courant = phrase;
    } else {
      courant += phrase;
    }
  });

  if (courant.trim()) {
    segments.push(courant.trim());
  }

  return segments;
}

// Construit la liste des blocs lisibles du chapitre et leur mapping vers
// des segments de synthèse vocale, en conservant l'ordre du document.
function construireBlocsEtSegments(elementContenu) {
  const blocs = Array.from(
    elementContenu.querySelectorAll('h2, h3, p, li, dt, dd, figcaption')
  ).filter((el) => {
    if (el.closest('.image-placeholder')) return false;
    return el.textContent.trim().length > 0;
  });

  honomassageBlockElements = blocs;
  honomassageSegments = [];
  honomassageBlockStart = [];

  blocs.forEach((bloc, index) => {
    honomassageBlockStart[index] = honomassageSegments.length;
    const texte = bloc.textContent.replace(/\s+/g, ' ').trim();
    decouperEnSegments(texte).forEach((segmentTexte) => {
      honomassageSegments.push({ text: segmentTexte, blockIndex: index });
    });
  });

  blocs.forEach((bloc, index) => {
    bloc.classList.add('speech-block');
    bloc.setAttribute('role', 'button');
    bloc.setAttribute('tabindex', '0');
    bloc.addEventListener('click', () => selectionnerBloc(index));
    bloc.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectionnerBloc(index);
      }
    });
  });
}

function indexSegmentPourBloc(blockIndex) {
  if (blockIndex <= 0) return 0;
  return honomassageBlockStart[blockIndex] || 0;
}

function marquerBlocActif(blockIndex) {
  if (honomassageBlocActifEl) {
    honomassageBlocActifEl.classList.remove('speech-block-active');
  }
  const el = honomassageBlockElements[blockIndex];
  if (el) {
    el.classList.add('speech-block-active');
    honomassageBlocActifEl = el;
  } else {
    honomassageBlocActifEl = null;
  }
}

function lirePositionMemorisee(numeroChapitre) {
  try {
    const brut = localStorage.getItem(HONOMASSAGE_POSITION_KEY);
    if (!brut) return null;
    const donnees = JSON.parse(brut);
    if (donnees && donnees.chapitre === numeroChapitre) return donnees;
    return null;
  } catch (e) {
    return null;
  }
}

function sauvegarderPosition(numeroChapitre, blockIndex) {
  try {
    localStorage.setItem(
      HONOMASSAGE_POSITION_KEY,
      JSON.stringify({ chapitre: numeroChapitre, blockIndex: blockIndex })
    );
  } catch (e) {
    // Pas grave : la position ne sera simplement pas mémorisée.
  }
}

function lireVitesseMemorisee() {
  try {
    const valeur = parseFloat(localStorage.getItem(HONOMASSAGE_RATE_KEY));
    return Number.isFinite(valeur) ? valeur : 1;
  } catch (e) {
    return 1;
  }
}

function sauvegarderVitesse(valeur) {
  try {
    localStorage.setItem(HONOMASSAGE_RATE_KEY, String(valeur));
  } catch (e) {
    // Pas grave.
  }
}

function lireMusiquePreference() {
  try {
    return localStorage.getItem(HONOMASSAGE_MUSIC_KEY) === 'on';
  } catch (e) {
    return false;
  }
}

function sauvegarderMusiquePreference(active) {
  try {
    localStorage.setItem(HONOMASSAGE_MUSIC_KEY, active ? 'on' : 'off');
  } catch (e) {
    // Pas grave.
  }
}

function mettreAJourBoutons(boutonPrincipal, boutonArret) {
  if (honomassageEtatLecture === 'lecture') {
    boutonPrincipal.textContent = '⏸ Pause';
    boutonArret.style.display = 'inline-flex';
  } else if (honomassageEtatLecture === 'pause') {
    boutonPrincipal.textContent = '▶ Reprendre';
    boutonArret.style.display = 'inline-flex';
  } else {
    boutonPrincipal.textContent = '🔊 Écouter';
    boutonArret.style.display = 'none';
  }
}

function mettreAJourBoutonMusique(boutonMusique) {
  boutonMusique.textContent = honomassageMusicEnabled ? '🎵 Musique : activée' : '🎵 Musique : désactivée';
  boutonMusique.setAttribute('aria-pressed', honomassageMusicEnabled ? 'true' : 'false');
}

function demarrerMusiqueSiActive() {
  if (!honomassageMusicEnabled || !honomassageAudio) return;
  honomassageAudio.volume = 0.15;
  const tentative = honomassageAudio.play();
  if (tentative && typeof tentative.catch === 'function') {
    tentative.catch(() => {
      // Fichier audio absent ou lecture refusée : la voix continue sans musique.
    });
  }
}

function mettreEnPauseMusique() {
  if (honomassageAudio) honomassageAudio.pause();
}

function arreterMusique() {
  if (honomassageAudio) {
    honomassageAudio.pause();
    honomassageAudio.currentTime = 0;
  }
}

function initMediaSession(titreChapitre) {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: titreChapitre,
      artist: 'HonoMassage — Livre audio',
      album: 'HonoMassage Book'
    });
    navigator.mediaSession.setActionHandler('play', () => {
      if (honomassageEtatLecture === 'pause') document.getElementById('speech-btn').click();
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      if (honomassageEtatLecture === 'lecture') document.getElementById('speech-btn').click();
    });
  } catch (e) {
    // API non supportée : on ignore silencieusement.
  }
}

let parlerSegment; // déclarée en portée large pour être accessible depuis selectionnerBloc
let selectionnerBloc;

function initLectureVoixHaute(titreChapitre, elementContenu) {
  const boutonPrincipal = document.getElementById('speech-btn');
  const boutonArret = document.getElementById('speech-stop-btn');
  const selecteurVitesse = document.getElementById('speech-rate');
  const boutonMusique = document.getElementById('music-toggle-btn');
  honomassageAudio = document.getElementById('ambient-audio');
  const numeroChapitre = numeroChapitreActuel();

  if (!boutonPrincipal || !boutonArret) return;

  if (!('speechSynthesis' in window)) {
    boutonPrincipal.style.display = 'none';
    boutonArret.style.display = 'none';
    if (selecteurVitesse) selecteurVitesse.style.display = 'none';
    if (boutonMusique) boutonMusique.style.display = 'none';
    return;
  }

  window.speechSynthesis.cancel();
  honomassageEtatLecture = 'arret';
  honomassageRate = lireVitesseMemorisee();
  honomassageMusicEnabled = lireMusiquePreference();

  construireBlocsEtSegments(elementContenu);

  // Position de reprise : si un bloc a déjà été atteint dans ce chapitre,
  // on prépare le pointeur dessus et on le signale discrètement, sans
  // démarrer la lecture automatiquement (elle doit toujours être déclenchée
  // par un appui explicite sur le bouton).
  const position = lirePositionMemorisee(numeroChapitre);
  if (position && honomassageBlockElements[position.blockIndex]) {
    honomassageIndexSegment = indexSegmentPourBloc(position.blockIndex);
    marquerBlocActif(position.blockIndex);
  } else {
    honomassageIndexSegment = 0;
  }

  boutonPrincipal.disabled = false;
  mettreAJourBoutons(boutonPrincipal, boutonArret);
  initMediaSession(titreChapitre);

  if (selecteurVitesse) {
    selecteurVitesse.value = String(honomassageRate);
    selecteurVitesse.addEventListener('change', () => {
      honomassageRate = parseFloat(selecteurVitesse.value);
      sauvegarderVitesse(honomassageRate);
      if (honomassageEtatLecture === 'lecture') {
        window.speechSynthesis.cancel();
        parlerSegment(honomassageIndexSegment);
      }
    });
  }

  if (boutonMusique) {
    mettreAJourBoutonMusique(boutonMusique);
    boutonMusique.addEventListener('click', () => {
      honomassageMusicEnabled = !honomassageMusicEnabled;
      sauvegarderMusiquePreference(honomassageMusicEnabled);
      mettreAJourBoutonMusique(boutonMusique);
      if (honomassageEtatLecture === 'lecture') {
        if (honomassageMusicEnabled) demarrerMusiqueSiActive();
        else mettreEnPauseMusique();
      }
    });
  }

  parlerSegment = function (index) {
    if (index >= honomassageSegments.length) {
      honomassageEtatLecture = 'arret';
      honomassageIndexSegment = 0;
      mettreAJourBoutons(boutonPrincipal, boutonArret);
      arreterMusique();
      return;
    }

    const segment = honomassageSegments[index];

    if (segment.blockIndex >= 0) {
      marquerBlocActif(segment.blockIndex);
      sauvegarderPosition(numeroChapitre, segment.blockIndex);
    }

    const utterance = new SpeechSynthesisUtterance(segment.text);
    utterance.lang = 'fr-FR';
    utterance.rate = honomassageRate;

    utterance.onend = () => {
      if (honomassageEtatLecture !== 'lecture') return;
      honomassageIndexSegment = index + 1;
      parlerSegment(honomassageIndexSegment);
    };

    window.speechSynthesis.speak(utterance);
  };

  selectionnerBloc = function (blockIndex) {
    honomassageIndexSegment = indexSegmentPourBloc(blockIndex);
    marquerBlocActif(blockIndex);
    sauvegarderPosition(numeroChapitre, blockIndex);

    if (honomassageEtatLecture === 'lecture') {
      window.speechSynthesis.cancel();
      parlerSegment(honomassageIndexSegment);
    }
    // Si la lecture est en pause ou arrêtée : on met seulement à jour le
    // point de départ, l'utilisateur doit toujours appuyer sur le bouton
    // pour démarrer ou reprendre la lecture.
  };

  boutonPrincipal.addEventListener('click', () => {
    if (honomassageEtatLecture === 'arret') {
      honomassageEtatLecture = 'lecture';
      mettreAJourBoutons(boutonPrincipal, boutonArret);
      demarrerMusiqueSiActive();
      parlerSegment(honomassageIndexSegment);

    } else if (honomassageEtatLecture === 'lecture') {
      honomassageEtatLecture = 'pause';
      window.speechSynthesis.cancel();
      mettreEnPauseMusique();
      mettreAJourBoutons(boutonPrincipal, boutonArret);

    } else if (honomassageEtatLecture === 'pause') {
      honomassageEtatLecture = 'lecture';
      mettreAJourBoutons(boutonPrincipal, boutonArret);
      demarrerMusiqueSiActive();
      parlerSegment(honomassageIndexSegment);
    }
  });

  boutonArret.addEventListener('click', () => {
    window.speechSynthesis.cancel();
    arreterMusique();
    honomassageEtatLecture = 'arret';
    mettreAJourBoutons(boutonPrincipal, boutonArret);
  });

  window.addEventListener('beforeunload', () => {
    window.speechSynthesis.cancel();
    arreterMusique();
  });
}
