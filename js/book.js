// book.js
// Charge content/chapitres.json et construit dynamiquement le sommaire
// sur chapitres.html. Contient aussi des fonctions utilitaires réutilisées
// par lecture.html dans une étape ultérieure.

async function chargerChapitres() {
  const reponse = await fetch('content/chapitres.json');
  if (!reponse.ok) {
    throw new Error('Impossible de charger la liste des chapitres.');
  }
  return reponse.json();
}

function creerElementChapitre(chapitre) {
  const li = document.createElement('li');
  li.className = 'chapitre-item';

  const lien = document.createElement('a');
  lien.href = 'lecture.html?chapitre=' + chapitre.numero;
  lien.className = 'chapitre-link';

  const numero = document.createElement('span');
  numero.className = 'chapitre-numero';
  numero.textContent = String(chapitre.numero).padStart(2, '0');

  const infos = document.createElement('span');
  infos.className = 'chapitre-infos';

  const titre = document.createElement('span');
  titre.className = 'chapitre-titre';
  titre.textContent = chapitre.titre;
  infos.appendChild(titre);

  if (chapitre.resume) {
    const resume = document.createElement('span');
    resume.className = 'chapitre-resume';
    resume.textContent = chapitre.resume;
    infos.appendChild(resume);
  }

  lien.appendChild(numero);
  lien.appendChild(infos);
  li.appendChild(lien);

  return li;
}

async function initSommaire() {
  const liste = document.getElementById('chapitres-list');
  if (!liste) return; // On n'est pas sur chapitres.html

  try {
    const chapitres = await chargerChapitres();
    chapitres
      .sort((a, b) => a.numero - b.numero)
      .forEach((chapitre) => {
        liste.appendChild(creerElementChapitre(chapitre));
      });
  } catch (erreur) {
    liste.innerHTML = '<li class="chapitre-erreur">Erreur de chargement du sommaire.</li>';
    console.error(erreur);
  }
}

initSommaire();
// --------------------------------------------------------------------------
// Fonctions pour lecture.html
// --------------------------------------------------------------------------

function getNumeroChapitreDepuisUrl() {
  const params = new URLSearchParams(window.location.search);
  const numero = parseInt(params.get('chapitre'), 10);
  return Number.isInteger(numero) && numero > 0 ? numero : 1;
}

async function chargerContenuChapitre(numero) {
  const idFichier = String(numero).padStart(2, '0');
  const reponse = await fetch('content/chapitre-' + idFichier + '.html');
  if (!reponse.ok) {
    throw new Error('Chapitre introuvable : ' + numero);
  }
  return reponse.text();
}

function mettreAJourNavigation(numero, chapitres) {
  const total = chapitres.length;
  const precedentLien = document.getElementById('nav-precedent');
  const suivantLien = document.getElementById('nav-suivant');

  if (numero > 1) {
    precedentLien.href = 'lecture.html?chapitre=' + (numero - 1);
    precedentLien.style.display = 'inline-flex';
  }

  if (numero < total) {
    suivantLien.href = 'lecture.html?chapitre=' + (numero + 1);
    suivantLien.style.display = 'inline-flex';
  }
}

async function initLecture() {
  const zoneContenu = document.getElementById('chapitre-contenu');
  if (!zoneContenu) return; // On n'est pas sur lecture.html

  const numero = getNumeroChapitreDepuisUrl();

  try {
    const [chapitres, contenuHtml] = await Promise.all([
      chargerChapitres(),
      chargerContenuChapitre(numero)
    ]);

    const meta = chapitres.find((c) => c.numero === numero);
    const titre = meta ? meta.titre : 'Chapitre ' + numero;

    document.getElementById('page-title').textContent = titre + ' — HonoMassage';
    document.getElementById('chapitre-titre').textContent = titre;
    document.getElementById('chapitre-numero-label').textContent =
      String(numero).padStart(2, '0') + ' / ' + String(chapitres.length).padStart(2, '0');

    zoneContenu.innerHTML = contenuHtml;

    mettreAJourNavigation(numero, chapitres);
  } catch (erreur) {
    zoneContenu.innerHTML = '<p class="chapitre-erreur">Ce chapitre n\'est pas encore disponible.</p>';
    console.error(erreur);
  }
}

initLecture();
