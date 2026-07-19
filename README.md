# 🦉 QuizTiti

Une petite application web pour apprendre à partir de fiches question/réponse (dans l'esprit d'Anki, avec **révision espacée** optionnelle) et de **jeux d'énigmes à indices progressifs**.

100 % statique : pas de serveur, pas de compte. Vos paquets sont enregistrés dans le navigateur (localStorage) et peuvent être **exportés/importés en JSON** pour être partagés ou sauvegardés. L'application est aussi une **PWA installable** (« Ajouter à l'écran d'accueil »), qui fonctionne hors-ligne.

## Fonctionnalités

- **Paquets de fiches** : créez, renommez, supprimez des paquets ; ajoutez des fiches question/réponse. Chaque paquet a un **mode de révision** au choix : *libre* ou *espacée (Leitner)*.
- **Mode révision** : les fiches défilent dans un ordre aléatoire ; on voit la question, on révèle la réponse, on indique « je savais » ou « je ne savais pas ». En fin de session, un score et la possibilité de revoir uniquement les fiches ratées.
- **Révision espacée (Leitner)** : sur un paquet en mode Leitner, chaque fiche progresse dans 5 « boîtes ». Une fiche réussie réapparaît de plus en plus tard (**1, 2, 4, 8 puis 16 jours**) ; une fiche ratée retombe en boîte 1 et revient dès le lendemain. L'accueil affiche le nombre de fiches **à réviser aujourd'hui**, et le paquet montre la répartition dans les boîtes. La progression est sauvegardée et incluse dans l'export.
- **Rappels** : un bouton « Activer les rappels » demande l'autorisation d'envoyer des notifications ; à l'ouverture de l'application, si des fiches sont dues, une notification le signale. *(Le web statique ne permet pas de notifier application fermée : c'est un rappel « à l'ouverture », fiable partout — sur iPhone en installant la PWA sur l'écran d'accueil.)*
- **Mode énigmes** : chaque énigme est un mot (ou une expression) à deviner. Le 1ᵉʳ indice s'affiche ; une mauvaise réponse (ou un clic sur « Indice suivant ») révèle l'indice suivant, jusqu'à épuisement des indices, puis la réponse. Plus on trouve tôt, plus on marque de points (trouvé au 1ᵉʳ indice sur 5 = 5 points, au 5ᵉ = 1 point, réponse révélée = 0).
- **Export / import JSON** : un paquet seul ou tous les paquets d'un coup. Les réponses aux énigmes sont comparées sans tenir compte de la casse, des accents ni des tirets.
- **Paquets d'exemple** : depuis l'accueil, ajoutez en un clic des paquets prêts à l'emploi — l'Odyssée, des énigmes en anglais (3 niveaux), la thermodynamique, une cheatsheet vi/vim complète, les commandes Linux (débutant et avancé), Git (débutant et confirmé), des carnets de révision collège (maths et français de la 6e à la 3e, découpés en paquets par thème), et des carnets de langues (verbes irréguliers anglais, verbes forts allemands). Les fichiers sont dans le dossier [`exemples/`](exemples/).

## Format d'export

```json
{
  "format": "quiztiti-deck",
  "version": 1,
  "decks": [
    {
      "name": "Mon paquet",
      "description": "Optionnel",
      "srsMode": "none",
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

`srsMode` vaut `"none"` (révision libre, par défaut) ou `"leitner"` (révision espacée). Pour un paquet Leitner, chaque fiche classique peut porter un objet `"srs": { "box": 1, "due": "2026-07-19" }` qui mémorise sa boîte et sa date de prochaine révision ; à l'import, une fiche sans cet objet démarre en boîte 1.

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
