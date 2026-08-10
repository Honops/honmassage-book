// speech.js
// Lecture à voix haute du contenu d'un chapitre via la Web Speech API
// native du navigateur (aucune dépendance, aucun service externe).

let honomassageUtterance = null;
let honomassageEtatLecture = 'arret'; // 'arret' | 'lecture' | 'pause'

function texteLisibleDepuisContenu(elementContenu) {
  // On clone pour ne pas toucher au DOM affiché, puis on retire les zones
  // qui n'ont pas de sens à voix haute (placeholders d'images, quiz brut).
  const clone = elementContenu.cloneNode(true);
  clone.querySelectorAll('.image-placeholder').forEach((el) => el.remove());
  return clone.textContent.replace(/\s+/g, ' ').trim();
}

function mettreAJourBoutonSpeech(bouton) {
  if (honomassageEtatLecture === 'lecture') {
    bouton.textContent = '⏸ Pause';
  } else if (honomassageEtatLecture === 'pause') {
    bouton.textContent = '▶ Reprendre';
  } else {
    bouton.textContent = '🔊 Écouter';
  }
}

function arreterLecture(bouton) {
  window.speechSynthesis.cancel();
  honomassageEtatLecture = 'arret';
  mettreAJourBoutonSpeech(bouton);
}

function initLectureVoixHaute(titreChapitre, elementContenu) {
  const bouton = document.getElementById('speech-btn');
  if (!bouton) return;

  if (!('speechSynthesis' in window)) {
    bouton.style.display = 'none'; // Navigateur trop ancien : on masque proprement.
    return;
  }

  bouton.disabled = false;
  honomassageEtatLecture = 'arret';
  mettreAJourBoutonSpeech(bouton);

  // On arrête toute lecture en cours si on change de chapitre.
  window.speechSynthesis.cancel();

  bouton.addEventListener('click', () => {
    if (honomassageEtatLecture === 'arret') {
      const texte = titreChapitre + '. ' + texteLisibleDepuisContenu(elementContenu);
      honomassageUtterance = new SpeechSynthesisUtterance(texte);
      honomassageUtterance.lang = 'fr-FR';
      honomassageUtterance.rate = 1;

      honomassageUtterance.onend = () => {
        honomassageEtatLecture = 'arret';
        mettreAJourBoutonSpeech(bouton);
      };

      window.speechSynthesis.speak(honomassageUtterance);
      honomassageEtatLecture = 'lecture';
      mettreAJourBoutonSpeech(bouton);
    } else if (honomassageEtatLecture === 'lecture') {
      window.speechSynthesis.pause();
      honomassageEtatLecture = 'pause';
      mettreAJourBoutonSpeech(bouton);
    } else if (honomassageEtatLecture === 'pause') {
      window.speechSynthesis.resume();
      honomassageEtatLecture = 'lecture';
      mettreAJourBoutonSpeech(bouton);
    }
  });

  // Arrête la lecture si l'utilisateur quitte la page pendant qu'elle parle.
  window.addEventListener('beforeunload', () => {
    window.speechSynthesis.cancel();
  });
}
