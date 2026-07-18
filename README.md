# 🦉 QuizTiti

Une petite application web pour apprendre à partir de fiches question/réponse (dans l'esprit d'Anki, sans la gestion des fréquences de révision) et de **jeux d'énigmes à indices progressifs**.

100 % statique : pas de serveur, pas de compte. Vos paquets sont enregistrés dans le navigateur (localStorage) et peuvent être **exportés/importés en JSON** pour être partagés ou sauvegardés.

## Fonctionnalités

- **Paquets de fiches** : créez, renommez, supprimez des paquets ; ajoutez des fiches question/réponse.
- **Mode révision** : les fiches défilent dans un ordre aléatoire ; on voit la question, on révèle la réponse, on indique « je savais » ou « je ne savais pas ». En fin de session, un score et la possibilité de revoir uniquement les fiches ratées.
- **Mode énigmes** : chaque énigme est un mot (ou une expression) à deviner. Le 1ᵉʳ indice s'affiche ; une mauvaise réponse (ou un clic sur « Indice suivant ») révèle l'indice suivant, jusqu'à épuisement des indices, puis la réponse. Plus on trouve tôt, plus on marque de points (trouvé au 1ᵉʳ indice sur 5 = 5 points, au 5ᵉ = 1 point, réponse révélée = 0).
- **Export / import JSON** : un paquet seul ou tous les paquets d'un coup. Les réponses aux énigmes sont comparées sans tenir compte de la casse, des accents ni des tirets.
- **Paquets d'exemple** : depuis l'accueil, ajoutez en un clic des paquets prêts à l'emploi (questions sur l'Odyssée, énigmes en anglais sur trois niveaux — débutant, intermédiaire, fluent). Les fichiers sont dans le dossier [`exemples/`](exemples/).

## Format d'export

```json
{
  "format": "quiztiti-deck",
  "version": 1,
  "decks": [
    {
      "name": "Mon paquet",
      "description": "Optionnel",
      "cards": [
        { "type": "classic", "question": "Capitale de l'Australie ?", "answer": "Canberra" },
        {
          "type": "riddle",
          "answer": "Volcan",
          "clues": ["Indice 1", "Indice 2", "Indice 3", "Indice 4", "Indice 5"]
        }
      ]
    }
  ]
}
```

Vous pouvez donc aussi préparer des paquets « à la main » (ou avec un script) et les importer dans l'application.

## Lancer en local

Ouvrez simplement `index.html` dans un navigateur, ou servez le dossier :

```bash
python3 -m http.server 8000
# puis http://localhost:8000
```

## Déploiement sur GitHub Pages

Le dépôt contient un workflow (`.github/workflows/deploy.yml`) qui déploie automatiquement le site à chaque push sur `main`. Il peut aussi être lancé à la main depuis l'onglet **Actions** (bouton « Run workflow »).

Une seule chose à faire une fois, par un admin du dépôt : dans **Settings → Pages**, choisir **Source : GitHub Actions** (la première activation de Pages ne peut pas être faite par le workflow lui-même).

Le site est ensuite disponible sur `https://<votre-utilisateur>.github.io/quiztiti/`.

(Alternative sans workflow : Settings → Pages → « Deploy from a branch » → branche `main`, dossier `/ (root)` — l'application étant statique, ça fonctionne aussi.)
