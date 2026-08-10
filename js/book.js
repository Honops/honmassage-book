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
