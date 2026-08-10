// theme.js
// Bascule manuelle entre thème clair et sombre, mémorisée dans localStorage.
// S'appuie sur les classes .theme-dark / .theme-light déjà définies dans
// css/style.css. Sans choix mémorisé, le thème suit les préférences système
// (comportement déjà actif depuis l'Étape 9a).

const HONOMASSAGE_THEME_KEY = 'honomassage-theme';

function appliquerTheme(theme) {
  const racine = document.documentElement;
  racine.classList.remove('theme-dark', 'theme-light');

  if (theme === 'dark') {
    racine.classList.add('theme-dark');
  } else if (theme === 'light') {
    racine.classList.add('theme-light');
  }
  // Si theme === 'system' (ou valeur inconnue) : aucune classe forcée,
  // on laisse prefers-color-scheme décider.
}

function themeActuel() {
  try {
    return localStorage.getItem(HONOMASSAGE_THEME_KEY) || 'system';
  } catch (e) {
    return 'system';
  }
}

function definirTheme(theme) {
  try {
    localStorage.setItem(HONOMASSAGE_THEME_KEY, theme);
  } catch (e) {
    // localStorage indisponible : la bascule fonctionnera quand même
    // pour la session en cours, simplement sans mémorisation.
  }
  appliquerTheme(theme);
}

function mettreAJourBoutonTheme(bouton, theme) {
  if (theme === 'dark') {
    bouton.textContent = '☀️';
    bouton.setAttribute('aria-label', 'Passer au thème clair');
  } else {
    bouton.textContent = '🌙';
    bouton.setAttribute('aria-label', 'Passer au thème sombre');
  }
}

function initBoutonTheme() {
  // Applique immédiatement le thème mémorisé, avant même le clic.
  const themeInitial = themeActuel();
  appliquerTheme(themeInitial);

  const bouton = document.getElementById('theme-toggle');
  if (!bouton) return;

  // Le libellé du bouton reflète l'état "effectif" actuel (sombre ou non),
  // qu'il vienne d'un choix manuel ou des préférences système.
  const estSombreActuellement = document.documentElement.classList.contains('theme-dark')
    || (themeInitial === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  mettreAJourBoutonTheme(bouton, estSombreActuellement ? 'dark' : 'light');

  bouton.addEventListener('click', () => {
    const sombreMaintenant = document.documentElement.classList.contains('theme-dark')
      || (themeActuel() === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    const nouveauTheme = sombreMaintenant ? 'light' : 'dark';
    definirTheme(nouveauTheme);
    mettreAJourBoutonTheme(bouton, nouveauTheme);
  });
}

initBoutonTheme();
