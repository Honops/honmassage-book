// speech.js
// Lecture à voix haute du contenu d'un chapitre via la Web Speech API native.
// Le texte est découpé en segments courts pour éviter le bug connu de Chrome
// qui interrompt silencieusement les utterances trop longues (~15s), et le
// pause/reprise est piloté manuellement plutôt que via speechSynthesis.pause()/
// resume(), peu fiables sur Android.
// Gère aussi une vitesse de lecture réglable et une musique d'ambiance
// optionnelle, synchronisées avec l'état de la voix.

const HONOMASSAGE_RATE_KEY = 'honomassage-speech-rate';
const HONOMASSAGE_MUSIC_KEY = 'honomassage-music-enabled';

let honomassageSegments = [];
let honomassageIndexSegment = 0;
let honomassageEtatLecture = 'arret'; // 'arret' | 'lecture' | 'pause'
let honomassageRate = 1;
let honomassageMusicEnabled = false;
let honomassageAudio = null;

function texteLisibleDepuisContenu(elementContenu) {
  const clone = elementContenu.cloneNode(true);
  clone.querySelectorAll('.image-placeholder').forEach((el) => el.remove());
  return clone.textContent.replace(/\s+/g, ' ').trim();
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
    // Pas grave : la vitesse fonctionnera pour la session en cours seulement.
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
  if (honomassageAudio) {
    honomassageAudio.pause();
  }
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
      if (honomassageEtatLecture === 'pause') {
        document.getElementById('speech-btn').click();
      }
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      if (honomassageEtatLecture === 'lecture') {
        document.getElementById('speech-btn').click();
      }
    });
  } catch (e) {
    // API non supportée ou navigateur restrictif : on ignore silencieusement.
  }
}

function initLectureVoixHaute(titreChapitre, elementContenu) {
  const boutonPrincipal = document.getElementById('speech-btn');
  const boutonArret = document.getElementById('speech-stop-btn');
  const selecteurVitesse = document.getElementById('speech-rate');
  const boutonMusique = document.getElementById('music-toggle-btn');
  honomassageAudio = document.getElementById('ambient-audio');

  if (!boutonPrincipal || !boutonArret) return;

  if (!('speechSynthesis' in window)) {
    boutonPrincipal.style.display = 'none';
    boutonArret.style.display = 'none';
    if (selecteurVitesse) selecteurVitesse.style.display = 'none';
    if (boutonMusique) boutonMusique.style.display = 'none';
    return;
  }

  window.speechSynthesis.cancel();
  honomassageSegments = [];
  honomassageIndexSegment = 0;
  honomassageEtatLecture = 'arret';
  honomassageRate = lireVitesseMemorisee();
  honomassageMusicEnabled = lireMusiquePreference();

  boutonPrincipal.disabled = false;
  mettreAJourBoutons(boutonPrincipal, boutonArret);
  initMediaSession(titreChapitre);

  if (selecteurVitesse) {
    selecteurVitesse.value = String(honomassageRate);
    selecteurVitesse.addEventListener('change', () => {
      honomassageRate = parseFloat(selecteurVitesse.value);
      sauvegarderVitesse(honomassageRate);

      // Si la lecture est en cours, on interrompt proprement le segment
      // courant et on le relance à la nouvelle vitesse, sans avancer dans
      // le texte, pour éviter toute incohérence de file SpeechSynthesis.
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
        if (honomassageMusicEnabled) {
          demarrerMusiqueSiActive();
        } else {
          mettreEnPauseMusique();
        }
      }
    });
  }

  function parlerSegment(index) {
    if (index >= honomassageSegments.length) {
      honomassageEtatLecture = 'arret';
      honomassageIndexSegment = 0;
      mettreAJourBoutons(boutonPrincipal, boutonArret);
      arreterMusique();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(honomassageSegments[index]);
    utterance.lang = 'fr-FR';
    utterance.rate = honomassageRate;

    utterance.onend = () => {
      if (honomassageEtatLecture !== 'lecture') return;
      honomassageIndexSegment = index + 1;
      parlerSegment(honomassageIndexSegment);
    };

    window.speechSynthesis.speak(utterance);
  }

  boutonPrincipal.addEventListener('click', () => {
    if (honomassageEtatLecture === 'arret') {
      if (honomassageSegments.length === 0) {
        const texteComplet = titreChapitre + '. ' + texteLisibleDepuisContenu(elementContenu);
        honomassageSegments = decouperEnSegments(texteComplet);
      }
      honomassageIndexSegment = 0;
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
    honomassageIndexSegment = 0;
    mettreAJourBoutons(boutonPrincipal, boutonArret);
  });

  window.addEventListener('beforeunload', () => {
    window.speechSynthesis.cancel();
    arreterMusique();
  });
}
