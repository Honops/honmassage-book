// speech.js
// Lecture à voix haute du contenu d'un chapitre via la Web Speech API native.
// Le texte est découpé en segments courts pour éviter le bug connu de Chrome
// qui interrompt silencieusement les utterances trop longues (~15s), et le
// pause/reprise est piloté manuellement plutôt que via speechSynthesis.pause()/
// resume(), peu fiables sur Android.

let honomassageSegments = [];
let honomassageIndexSegment = 0;
let honomassageEtatLecture = 'arret'; // 'arret' | 'lecture' | 'pause'

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

function initLectureVoixHaute(titreChapitre, elementContenu) {
  const boutonPrincipal = document.getElementById('speech-btn');
  const boutonArret = document.getElementById('speech-stop-btn');
  if (!boutonPrincipal || !boutonArret) return;

  if (!('speechSynthesis' in window)) {
    boutonPrincipal.style.display = 'none';
    boutonArret.style.display = 'none';
    return;
  }

  // On repart toujours d'un état propre à chaque chargement de chapitre.
  window.speechSynthesis.cancel();
  honomassageSegments = [];
  honomassageIndexSegment = 0;
  honomassageEtatLecture = 'arret';

  boutonPrincipal.disabled = false;
  mettreAJourBoutons(boutonPrincipal, boutonArret);

  function parlerSegment(index) {
    if (index >= honomassageSegments.length) {
      honomassageEtatLecture = 'arret';
      honomassageIndexSegment = 0;
      mettreAJourBoutons(boutonPrincipal, boutonArret);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(honomassageSegments[index]);
    utterance.lang = 'fr-FR';
    utterance.rate = 1;

    utterance.onend = () => {
      // Si l'arrêt provient d'une pause ou d'un stop volontaire, ne pas enchaîner.
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
      parlerSegment(honomassageIndexSegment);

    } else if (honomassageEtatLecture === 'lecture') {
      // Pause pilotée manuellement : on annule le segment en cours plutôt que
      // d'utiliser speechSynthesis.pause(), peu fiable sur Android.
      honomassageEtatLecture = 'pause';
      window.speechSynthesis.cancel();
      mettreAJourBoutons(boutonPrincipal, boutonArret);

    } else if (honomassageEtatLecture === 'pause') {
      honomassageEtatLecture = 'lecture';
      mettreAJourBoutons(boutonPrincipal, boutonArret);
      parlerSegment(honomassageIndexSegment);
    }
  });

  boutonArret.addEventListener('click', () => {
    window.speechSynthesis.cancel();
    honomassageEtatLecture = 'arret';
    honomassageIndexSegment = 0;
    mettreAJourBoutons(boutonPrincipal, boutonArret);
  });

  window.addEventListener('beforeunload', () => {
    window.speechSynthesis.cancel();
  });
}
