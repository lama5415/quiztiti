/* QuizTiti — fiches question/réponse et énigmes à indices progressifs.
   Application 100 % statique : les données vivent dans le localStorage. */

(function () {
  "use strict";

  var STORAGE_KEY = "quiztiti.decks.v1";
  var EXPORT_FORMAT = "quiztiti-deck";
  var EXPORT_VERSION = 1;

  var appEl = document.getElementById("app");
  var fileInput = document.getElementById("import-file");

  var decks = load();
  var session = null; // session d'étude ou d'énigmes en cours
  var view = "home"; // vue affichée, pour savoir si on peut rafraîchir l'accueil
  var examples = null; // manifeste des paquets d'exemple, chargé en arrière-plan

  /* ---------------- Persistance ---------------- */

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* stockage corrompu : on repart de zéro */ }
    return null;
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(decks));
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* ---------------- Paquet de démonstration ---------------- */

  function demoDeck() {
    return {
      id: uid(),
      name: "Découverte de QuizTiti",
      description: "Un petit paquet d'exemple : des fiches classiques et des énigmes.",
      cards: [
        { id: uid(), type: "classic", question: "Quelle est la capitale de l'Australie ?", answer: "Canberra" },
        { id: uid(), type: "classic", question: "En quelle année a eu lieu la Révolution française ?", answer: "1789" },
        { id: uid(), type: "classic", question: "Combien de côtés a un hexagone ?", answer: "Six" },
        {
          id: uid(), type: "riddle", answer: "Volcan",
          clues: [
            "Je suis une montagne, mais pas comme les autres.",
            "Je peux dormir pendant des siècles.",
            "Quand je me réveille, tout le monde s'enfuit.",
            "Je crache de la fumée et des cendres.",
            "De la lave coule de mon sommet."
          ]
        },
        {
          id: uid(), type: "riddle", answer: "Miroir",
          clues: [
            "Je n'ai pas de visage, mais j'en montre beaucoup.",
            "Je répète tout sans jamais parler.",
            "On me consulte chaque matin.",
            "Me briser porterait malheur, dit-on.",
            "Je vous renvoie votre image."
          ]
        }
      ]
    };
  }

  if (!decks) {
    decks = [demoDeck()];
    save();
  }

  /* ---------------- Utilitaires ---------------- */

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function findDeck(id) {
    for (var i = 0; i < decks.length; i++) if (decks[i].id === id) return decks[i];
    return null;
  }

  function findCard(deck, cardId) {
    for (var i = 0; i < deck.cards.length; i++) if (deck.cards[i].id === cardId) return deck.cards[i];
    return null;
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // Normalise une réponse : minuscules, sans accents, espaces/tirets réduits.
  function normalize(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[\s\-'\u2019_.]+/g, " ")
      .trim();
  }

  function cardsOfType(deck, type) {
    return deck.cards.filter(function (c) { return c.type === type; });
  }

  function toast(msg) {
    var t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2600);
  }

  function plural(n, word) {
    return n + " " + word + (n > 1 ? "s" : "");
  }

  /* ---------------- Révision espacée (Leitner) ---------------- */

  // Intervalle (en jours) associé à chaque boîte : une fiche réussie monte de
  // boîte et réapparaît de moins en moins souvent ; une fiche ratée revient vite.
  var LEITNER_DAYS = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16 };
  var LEITNER_MAX_BOX = 5;

  function dateStr(d) {
    var m = String(d.getMonth() + 1), day = String(d.getDate());
    return d.getFullYear() + "-" + (m.length < 2 ? "0" + m : m) + "-" + (day.length < 2 ? "0" + day : day);
  }

  function todayStr() {
    var d = new Date(); d.setHours(0, 0, 0, 0);
    return dateStr(d);
  }

  function addDays(str, n) {
    var p = str.split("-");
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    d.setDate(d.getDate() + n);
    return dateStr(d);
  }

  function daysBetween(fromStr, toStr) {
    var a = fromStr.split("-"), b = toStr.split("-");
    var da = new Date(+a[0], +a[1] - 1, +a[2]), db = new Date(+b[0], +b[1] - 1, +b[2]);
    return Math.round((db - da) / 86400000);
  }

  function isLeitner(deck) {
    return !!deck && deck.srsMode === "leitner";
  }

  // Dote chaque fiche classique d'un état Leitner (boîte 1, à réviser aujourd'hui).
  function ensureSrs(deck) {
    var today = todayStr();
    deck.cards.forEach(function (c) {
      if (c.type === "classic" && !c.srs) c.srs = { box: 1, due: today };
    });
  }

  function dueCards(deck) {
    if (!isLeitner(deck)) return [];
    ensureSrs(deck);
    var today = todayStr();
    return deck.cards.filter(function (c) {
      return c.type === "classic" && c.srs && c.srs.due <= today;
    });
  }

  function dueCount(deck) {
    return dueCards(deck).length;
  }

  function totalDue() {
    return decks.reduce(function (n, d) { return n + (isLeitner(d) ? dueCount(d) : 0); }, 0);
  }

  // Applique le résultat d'une révision : réussite → boîte suivante ; échec → boîte 1.
  function applyLeitner(card, known) {
    if (!card.srs) card.srs = { box: 1, due: todayStr() };
    card.srs.box = known ? Math.min(card.srs.box + 1, LEITNER_MAX_BOX) : 1;
    card.srs.due = addDays(todayStr(), LEITNER_DAYS[card.srs.box]);
  }

  function boxDistribution(deck) {
    var dist = [0, 0, 0, 0, 0]; // boîtes 1 à 5
    deck.cards.forEach(function (c) {
      if (c.type === "classic" && c.srs) dist[c.srs.box - 1]++;
    });
    return dist;
  }

  // Date d'échéance la plus proche parmi les fiches non encore dues (pour l'accueil).
  function nextDueStr(deck) {
    var today = todayStr(), best = null;
    deck.cards.forEach(function (c) {
      if (c.type === "classic" && c.srs && c.srs.due > today) {
        if (!best || c.srs.due < best) best = c.srs.due;
      }
    });
    return best;
  }

  function humanDelay(fromStr, toStr) {
    var n = daysBetween(fromStr, toStr);
    if (n <= 0) return "aujourd'hui";
    if (n === 1) return "demain";
    return "dans " + n + " jours";
  }

  /* ---------------- Rappels (notifications locales) ---------------- */

  var REMINDER_KEY = "quiztiti.reminders";

  function remindersOn() {
    return localStorage.getItem(REMINDER_KEY) === "1" &&
      ("Notification" in window) && Notification.permission === "granted";
  }

  function enableReminders() {
    if (!("Notification" in window)) { toast("Ce navigateur ne gère pas les notifications."); return; }
    Notification.requestPermission().then(function (p) {
      if (p === "granted") {
        localStorage.setItem(REMINDER_KEY, "1");
        toast("Rappels activés 🔔");
        maybeNotifyDue();
      } else {
        toast("Les rappels ont été refusés.");
      }
      if (view === "home") renderHome();
    });
  }

  function disableReminders() {
    localStorage.removeItem(REMINDER_KEY);
    toast("Rappels désactivés.");
    if (view === "home") renderHome();
  }

  // Notifie le nombre de fiches à réviser — au lancement de l'app si des rappels
  // sont activés. (Le web statique ne permet pas de notifier appli fermée ;
  // c'est un rappel « à l'ouverture », fiable partout, iPhone compris en mode PWA.)
  function maybeNotifyDue() {
    if (!remindersOn()) return;
    var total = totalDue();
    if (total <= 0) return;
    try {
      new Notification("QuizTiti 🦉", {
        body: total + " fiche" + (total > 1 ? "s" : "") + " à réviser aujourd'hui !",
        icon: "img/icon-192.png"
      });
    } catch (e) { /* ignore */ }
  }

  /* ---------------- Export / Import ---------------- */

  function downloadJson(filename, data) {
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function slugify(name) {
    return normalize(name).replace(/ /g, "-").replace(/[^a-z0-9\-]/g, "") || "paquet";
  }

  function exportDeck(deckId) {
    var deck = findDeck(deckId);
    if (!deck) return;
    downloadJson("quiztiti-" + slugify(deck.name) + ".json", {
      format: EXPORT_FORMAT,
      version: EXPORT_VERSION,
      decks: [deck]
    });
    toast("Paquet « " + deck.name + " » exporté.");
  }

  function exportAll() {
    if (!decks.length) { toast("Aucun paquet à exporter."); return; }
    downloadJson("quiztiti-tous-les-paquets.json", {
      format: EXPORT_FORMAT,
      version: EXPORT_VERSION,
      decks: decks
    });
    toast(plural(decks.length, "paquet") + " exporté" + (decks.length > 1 ? "s" : "") + ".");
  }

  function askImport() {
    fileInput.value = "";
    fileInput.click();
  }

  fileInput.addEventListener("change", function () {
    var file = fileInput.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        importData(JSON.parse(reader.result));
      } catch (e) {
        toast("Fichier illisible : ce n'est pas un JSON valide.");
      }
    };
    reader.readAsText(file);
  });

  function importData(data) {
    // Accepte : le format QuizTiti, un paquet seul, ou un tableau de paquets.
    var list;
    if (data && data.format === EXPORT_FORMAT && Array.isArray(data.decks)) list = data.decks;
    else if (Array.isArray(data)) list = data;
    else if (data && Array.isArray(data.cards)) list = [data];
    else { toast("Format non reconnu : il faut un export QuizTiti."); return; }

    var imported = 0, cardsCount = 0;
    list.forEach(function (raw) {
      var deck = sanitizeDeck(raw);
      if (!deck) return;
      // Nouveaux identifiants pour éviter toute collision avec l'existant.
      deck.id = uid();
      deck.cards.forEach(function (c) { c.id = uid(); });
      if (findDeckByName(deck.name)) deck.name += " (importé)";
      decks.push(deck);
      imported++;
      cardsCount += deck.cards.length;
    });

    if (!imported) { toast("Aucun paquet valide dans ce fichier."); return; }
    save();
    toast(plural(imported, "paquet") + " importé" + (imported > 1 ? "s" : "") + " (" + plural(cardsCount, "fiche") + ").");
    renderHome();
  }

  function findDeckByName(name) {
    for (var i = 0; i < decks.length; i++) if (decks[i].name === name) return decks[i];
    return null;
  }

  function sanitizeDeck(raw) {
    if (!raw || typeof raw !== "object" || typeof raw.name !== "string") return null;
    var cards = Array.isArray(raw.cards) ? raw.cards : [];
    var clean = [];
    cards.forEach(function (c) {
      if (!c || typeof c !== "object") return;
      if (c.type === "riddle") {
        var clues = Array.isArray(c.clues)
          ? c.clues.map(String).filter(function (x) { return x.trim(); })
          : [];
        if (clues.length && typeof c.answer === "string" && c.answer.trim()) {
          clean.push({ id: uid(), type: "riddle", answer: c.answer.trim(), clues: clues });
        }
      } else {
        if (typeof c.question === "string" && c.question.trim() &&
            typeof c.answer === "string" && c.answer.trim()) {
          var card = { id: uid(), type: "classic", question: c.question.trim(), answer: c.answer.trim() };
          // Conserve la progression Leitner si le fichier importé en contient.
          if (c.srs && typeof c.srs === "object" &&
              typeof c.srs.box === "number" && typeof c.srs.due === "string") {
            card.srs = { box: Math.min(Math.max(Math.round(c.srs.box), 1), LEITNER_MAX_BOX), due: c.srs.due };
          }
          clean.push(card);
        }
      }
    });
    return {
      id: uid(),
      name: raw.name.trim() || "Paquet importé",
      description: typeof raw.description === "string" ? raw.description.trim() : "",
      srsMode: raw.srsMode === "leitner" ? "leitner" : "none",
      cards: clean
    };
  }

  /* ---------------- Vue : accueil ---------------- */

  function renderHome() {
    session = null;
    view = "home";
    var html = '<div class="row spread">' +
      '<div><h1>Mes paquets</h1><p class="subtitle">Créez des fiches, révisez-les, résolvez des énigmes.</p></div>' +
      '<div class="row">' +
      '<button class="btn primary" onclick="App.newDeck()">➕ Nouveau paquet</button>' +
      '<button class="btn" onclick="App.askImport()">📥 Importer</button>' +
      '<button class="btn" onclick="App.exportAll()">📤 Tout exporter</button>' +
      '</div></div>';

    // Bannière de révision : nombre total de fiches dues + gestion des rappels.
    var total = totalDue();
    var hasLeitner = decks.some(isLeitner);
    if (hasLeitner || total > 0) {
      html += '<div class="banner">' +
        '<div class="banner-text">' +
        (total > 0
          ? '📌 <strong>' + plural(total, "fiche") + '</strong> à réviser aujourd\'hui.'
          : '✅ Tout est à jour : rien à réviser aujourd\'hui, bravo !') +
        '</div><div class="row">' +
        (remindersOn()
          ? '<button class="btn small ghost" onclick="App.disableReminders()">🔕 Rappels activés</button>'
          : '<button class="btn small" onclick="App.enableReminders()">🔔 Activer les rappels</button>') +
        '</div></div>';
    }

    if (!decks.length) {
      html += '<div class="empty"><div class="big">🦉</div>' +
        '<p>Aucun paquet pour le moment.<br>Créez-en un ou importez un fichier JSON.</p></div>';
    } else {
      html += '<div class="deck-grid">';
      decks.forEach(function (d) {
        var nClassic = cardsOfType(d, "classic").length;
        var nRiddle = cardsOfType(d, "riddle").length;
        var due = isLeitner(d) ? dueCount(d) : 0;
        html += '<div class="deck-card" onclick="App.openDeck(\'' + d.id + '\')">' +
          '<h3>' + esc(d.name) + '</h3>' +
          '<p class="desc">' + esc(d.description) + '</p>' +
          '<div class="row">' +
          (nClassic ? '<span class="badge classic">' + plural(nClassic, "fiche") + '</span>' : '') +
          (nRiddle ? '<span class="badge riddle">' + plural(nRiddle, "énigme") + '</span>' : '') +
          (!d.cards.length ? '<span class="badge classic">vide</span>' : '') +
          (isLeitner(d)
            ? (due > 0
                ? '<span class="badge due">' + due + ' à réviser</span>'
                : (nClassic ? '<span class="badge ok">à jour ✓</span>' : '')) +
              '<span class="badge leitner">Leitner</span>'
            : '') +
          '</div></div>';
      });
      html += '</div>';
    }

    if (examples && examples.length) {
      html += '<h2 style="margin-top:40px">📚 Paquets d&#39;exemple</h2>' +
        '<p class="subtitle">Cliquez pour les ajouter à votre collection, puis modifiez-les à votre guise.</p>' +
        '<div class="deck-grid">';
      examples.forEach(function (ex, i) {
        html += '<div class="deck-card" onclick="App.importExample(' + i + ')">' +
          '<h3>' + esc(ex.name) + '</h3>' +
          '<p class="desc">' + esc(ex.description || "") + '</p>' +
          '<div class="row">' +
          '<span class="badge riddle">' + esc(ex.badge || "exemple") + '</span>' +
          '<span class="badge classic">➕ Ajouter</span>' +
          '</div></div>';
      });
      html += '</div>';
    }

    appEl.innerHTML = html;
    window.scrollTo(0, 0);
  }

  function importExample(idx) {
    var ex = examples && examples[idx];
    if (!ex) return;
    fetch("exemples/" + ex.file)
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(importData)
      .catch(function () { toast("Impossible de charger ce paquet d'exemple."); });
  }

  /* ---------------- Vue : formulaire de paquet ---------------- */

  function renderDeckForm(deckId) {
    view = "deck-form";
    var deck = deckId ? findDeck(deckId) : null;
    var mode = deck && deck.srsMode === "leitner" ? "leitner" : "none";
    appEl.innerHTML =
      '<h1>' + (deck ? "Modifier le paquet" : "Nouveau paquet") + '</h1>' +
      '<div class="card mt">' +
      '<label for="deck-name">Nom du paquet</label>' +
      '<input type="text" id="deck-name" value="' + esc(deck ? deck.name : "") + '" placeholder="Ex. : Histoire de France">' +
      '<label for="deck-desc">Description (facultatif)</label>' +
      '<input type="text" id="deck-desc" value="' + esc(deck ? deck.description : "") + '" placeholder="Ex. : Dates et personnages clés">' +
      '<label for="deck-srs">Mode de révision</label>' +
      '<select id="deck-srs">' +
      '<option value="none"' + (mode === "none" ? " selected" : "") + '>Révision libre (pas d\'espacement)</option>' +
      '<option value="leitner"' + (mode === "leitner" ? " selected" : "") + '>Révision espacée — méthode de Leitner</option>' +
      '</select>' +
      '<p class="hint">En mode Leitner, une fiche réussie réapparaît de plus en plus tard (1, 2, 4, 8 puis 16 jours) ; une fiche ratée revient dès le lendemain. L\'accueil indique alors les fiches « à réviser ».</p>' +
      '<div class="row mt">' +
      '<button class="btn primary" onclick="App.saveDeck(' + (deck ? "'" + deck.id + "'" : "null") + ')">💾 Enregistrer</button>' +
      '<button class="btn ghost" onclick="' + (deck ? "App.openDeck('" + deck.id + "')" : "App.goHome()") + '">Annuler</button>' +
      '</div></div>';
    document.getElementById("deck-name").focus();
  }

  function saveDeck(deckId) {
    var name = document.getElementById("deck-name").value.trim();
    var desc = document.getElementById("deck-desc").value.trim();
    var mode = document.getElementById("deck-srs").value === "leitner" ? "leitner" : "none";
    if (!name) { toast("Donnez un nom au paquet."); return; }
    if (deckId) {
      var deck = findDeck(deckId);
      deck.name = name;
      deck.description = desc;
      deck.srsMode = mode;
      if (mode === "leitner") ensureSrs(deck);
      save();
      renderDeck(deckId);
    } else {
      var d = { id: uid(), name: name, description: desc, srsMode: mode, cards: [] };
      decks.push(d);
      save();
      renderDeck(d.id);
    }
  }

  function deleteDeck(deckId) {
    var deck = findDeck(deckId);
    if (!deck) return;
    if (!confirm("Supprimer le paquet « " + deck.name + " » et ses " + deck.cards.length + " fiches ?")) return;
    decks = decks.filter(function (d) { return d.id !== deckId; });
    save();
    toast("Paquet supprimé.");
    renderHome();
  }

  /* ---------------- Vue : détail d'un paquet ---------------- */

  function renderDeck(deckId) {
    var deck = findDeck(deckId);
    if (!deck) { renderHome(); return; }
    session = null;
    view = "deck";

    var classics = cardsOfType(deck, "classic");
    var riddles = cardsOfType(deck, "riddle");

    var leitner = isLeitner(deck);
    var due = leitner ? dueCount(deck) : 0;

    var html =
      '<button class="btn ghost small" onclick="App.goHome()">← Mes paquets</button>' +
      '<div class="row spread mt">' +
      '<div><h1>' + esc(deck.name) + '</h1>' +
      (deck.description ? '<p class="subtitle">' + esc(deck.description) + '</p>' : '') + '</div>' +
      '<div class="row">' +
      '<button class="btn small" onclick="App.editDeck(\'' + deck.id + '\')">✏️ Modifier</button>' +
      '<button class="btn small" onclick="App.exportDeck(\'' + deck.id + '\')">📤 Exporter</button>' +
      '<button class="btn small danger" onclick="App.deleteDeck(\'' + deck.id + '\')">🗑️ Supprimer</button>' +
      '</div></div>';

    // Boutons de révision, adaptés au mode du paquet.
    html += '<div class="row mt">';
    if (leitner) {
      html += '<button class="btn primary" onclick="App.startStudy(\'' + deck.id + '\')"' + (due ? "" : " disabled") + '>🎓 Réviser (' + due + ' due' + (due > 1 ? "s" : "") + ')</button>';
      if (classics.length) {
        html += '<button class="btn" onclick="App.studyAhead(\'' + deck.id + '\')">⏩ Réviser en avance</button>';
      }
    } else {
      html += '<button class="btn primary" onclick="App.startStudy(\'' + deck.id + '\')"' + (classics.length ? "" : " disabled") + '>🎓 Réviser (' + classics.length + ')</button>';
    }
    html += '<button class="btn primary" onclick="App.startRiddles(\'' + deck.id + '\')"' + (riddles.length ? "" : " disabled") + '>🕵️ Énigmes (' + riddles.length + ')</button>' +
      '<button class="btn success" onclick="App.newCard(\'' + deck.id + '\')">➕ Ajouter une fiche</button>' +
      '</div>';

    // Récapitulatif Leitner : répartition des fiches dans les boîtes.
    if (leitner && classics.length) {
      var dist = boxDistribution(deck);
      var next = nextDueStr(deck);
      html += '<div class="card mt srs-panel">' +
        '<div class="row spread"><strong>📦 Révision espacée (Leitner)</strong>' +
        (due ? '<span class="badge due">' + due + ' à réviser</span>'
             : '<span class="badge ok">à jour ✓' + (next ? ' — prochaine ' + humanDelay(todayStr(), next) : '') + '</span>') +
        '</div><div class="boxes">';
      for (var b = 0; b < 5; b++) {
        html += '<div class="box"><span class="box-num">Boîte ' + (b + 1) + '</span>' +
          '<span class="box-count">' + dist[b] + '</span></div>';
      }
      html += '</div><p class="hint">Boîte 1 = à revoir souvent · Boîte 5 = bien mémorisée (revue tous les 16 jours).</p></div>';
    }

    if (!deck.cards.length) {
      html += '<div class="empty"><div class="big">📝</div><p>Ce paquet est vide. Ajoutez votre première fiche !</p></div>';
    } else {
      html += '<div class="card-list">';
      deck.cards.forEach(function (c) {
        var front, back;
        if (c.type === "riddle") {
          front = "Énigme : " + c.answer;
          back = plural(c.clues.length, "indice") + " — « " + c.clues[0] + " »";
        } else {
          front = c.question;
          back = c.answer;
        }
        html += '<div class="card-item">' +
          '<span class="badge ' + (c.type === "riddle" ? 'riddle">énigme' : 'classic">fiche') + '</span>' +
          '<div class="content"><div class="q">' + esc(front) + '</div><div class="a">' + esc(back) + '</div></div>' +
          '<div class="actions">' +
          '<button class="btn small" onclick="App.editCard(\'' + deck.id + '\',\'' + c.id + '\')">✏️</button>' +
          '<button class="btn small danger" onclick="App.deleteCard(\'' + deck.id + '\',\'' + c.id + '\')">🗑️</button>' +
          '</div></div>';
      });
      html += '</div>';
    }
    appEl.innerHTML = html;
    window.scrollTo(0, 0);
  }

  /* ---------------- Vue : formulaire de fiche ---------------- */

  function renderCardForm(deckId, cardId) {
    view = "card-form";
    var deck = findDeck(deckId);
    if (!deck) { renderHome(); return; }
    var card = cardId ? findCard(deck, cardId) : null;
    var type = card ? card.type : "classic";

    appEl.innerHTML =
      '<button class="btn ghost small" onclick="App.openDeck(\'' + deck.id + '\')">← ' + esc(deck.name) + '</button>' +
      '<h1 class="mt">' + (card ? "Modifier la fiche" : "Nouvelle fiche") + '</h1>' +
      '<div class="card mt">' +
      '<label for="card-type">Type de fiche</label>' +
      '<select id="card-type" onchange="App.onCardTypeChange()"' + (card ? " disabled" : "") + '>' +
      '<option value="classic"' + (type === "classic" ? " selected" : "") + '>Question / Réponse</option>' +
      '<option value="riddle"' + (type === "riddle" ? " selected" : "") + '>Énigme à indices progressifs</option>' +
      '</select>' +
      '<div id="card-fields"></div>' +
      '<div class="row mt">' +
      '<button class="btn primary" onclick="App.saveCard(\'' + deck.id + '\',' + (card ? "'" + card.id + "'" : "null") + ')">💾 Enregistrer</button>' +
      (card ? '' : '<button class="btn" onclick="App.saveCard(\'' + deck.id + '\', null, true)">💾 Enregistrer et ajouter une autre</button>') +
      '<button class="btn ghost" onclick="App.openDeck(\'' + deck.id + '\')">Annuler</button>' +
      '</div></div>';

    renderCardFields(type, card);
  }

  function renderCardFields(type, card) {
    var el = document.getElementById("card-fields");
    if (type === "riddle") {
      el.innerHTML =
        '<label for="card-answer">Mot ou expression à trouver</label>' +
        '<input type="text" id="card-answer" value="' + esc(card ? card.answer : "") + '" placeholder="Ex. : Volcan">' +
        '<label for="card-clues">Indices (un par ligne, du plus vague au plus évident)</label>' +
        '<textarea id="card-clues" rows="6" placeholder="Indice 1&#10;Indice 2&#10;Indice 3&#10;Indice 4&#10;Indice 5">' +
        esc(card && card.clues ? card.clues.join("\n") : "") + '</textarea>' +
        '<p class="hint">Les indices seront révélés un par un. Cinq indices est un bon format, mais vous pouvez en mettre plus ou moins.</p>';
    } else {
      el.innerHTML =
        '<label for="card-question">Question (recto)</label>' +
        '<textarea id="card-question" rows="3" placeholder="Ex. : Quelle est la capitale de l\'Australie ?">' +
        esc(card ? card.question : "") + '</textarea>' +
        '<label for="card-answer">Réponse (verso)</label>' +
        '<textarea id="card-answer" rows="3" placeholder="Ex. : Canberra">' + esc(card ? card.answer : "") + '</textarea>';
    }
    var first = el.querySelector("input, textarea");
    if (first) first.focus();
  }

  function onCardTypeChange() {
    renderCardFields(document.getElementById("card-type").value, null);
  }

  function saveCard(deckId, cardId, addAnother) {
    var deck = findDeck(deckId);
    if (!deck) return;
    var type = document.getElementById("card-type").value;
    var answer = document.getElementById("card-answer").value.trim();

    var data;
    if (type === "riddle") {
      var clues = document.getElementById("card-clues").value
        .split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
      if (!answer) { toast("Indiquez le mot à trouver."); return; }
      if (!clues.length) { toast("Ajoutez au moins un indice."); return; }
      data = { type: "riddle", answer: answer, clues: clues };
    } else {
      var question = document.getElementById("card-question").value.trim();
      if (!question) { toast("Écrivez la question."); return; }
      if (!answer) { toast("Écrivez la réponse."); return; }
      data = { type: "classic", question: question, answer: answer };
    }

    if (cardId) {
      var card = findCard(deck, cardId);
      Object.assign(card, data);
      toast("Fiche modifiée.");
    } else {
      data.id = uid();
      deck.cards.push(data);
      toast("Fiche ajoutée.");
    }
    save();
    if (addAnother) renderCardForm(deckId, null);
    else renderDeck(deckId);
  }

  function deleteCard(deckId, cardId) {
    var deck = findDeck(deckId);
    if (!deck) return;
    if (!confirm("Supprimer cette fiche ?")) return;
    deck.cards = deck.cards.filter(function (c) { return c.id !== cardId; });
    save();
    renderDeck(deckId);
  }

  /* ---------------- Mode révision (fiches classiques) ---------------- */

  // Démarre une session : en mode Leitner, on ne révise que les fiches dues ;
  // en mode libre, toutes les fiches classiques.
  function startStudy(deckId) {
    var deck = findDeck(deckId);
    if (!deck) return;
    if (isLeitner(deck)) {
      var due = dueCards(deck);
      if (!due.length) { toast("Aucune fiche à réviser aujourd'hui 🎉"); renderDeck(deckId); return; }
      beginStudy(deck, shuffle(due), true);
    } else {
      var pool = cardsOfType(deck, "classic");
      if (!pool.length) return;
      beginStudy(deck, shuffle(pool), false);
    }
  }

  // Mode Leitner : réviser toutes les fiches maintenant, même celles pas encore dues.
  function studyAhead(deckId) {
    var deck = findDeck(deckId);
    if (!deck || !isLeitner(deck)) return;
    var pool = cardsOfType(deck, "classic");
    if (!pool.length) return;
    ensureSrs(deck);
    beginStudy(deck, shuffle(pool), true);
  }

  function beginStudy(deck, cards, srs) {
    session = {
      mode: "study",
      deckId: deck.id,
      cards: cards,
      index: 0,
      revealed: false,
      known: [],
      unknown: [],
      srs: srs // met à jour les boîtes Leitner lors de la notation
    };
    renderStudy();
  }

  function renderStudy() {
    view = "study";
    var s = session;
    var deck = findDeck(s.deckId);
    if (s.index >= s.cards.length) { renderStudySummary(); return; }
    var card = s.cards[s.index];
    var pct = Math.round((s.index / s.cards.length) * 100);
    var boxTag = (s.srs && card.srs) ? '<span class="counter"> · boîte ' + card.srs.box + '/5</span>' : '';

    appEl.innerHTML =
      '<div class="row spread">' +
      '<button class="btn ghost small" onclick="App.openDeck(\'' + deck.id + '\')">✕ Quitter</button>' +
      '<span class="counter">Fiche ' + (s.index + 1) + ' / ' + s.cards.length + boxTag + '</span></div>' +
      '<div class="progress-track"><div class="progress-fill" style="width:' + pct + '%"></div></div>' +
      '<div class="study-card">' +
      '<div class="question">' + esc(card.question) + '</div>' +
      (s.revealed ? '<div class="answer">' + esc(card.answer) + '</div>' : '') +
      '</div>' +
      '<div class="study-actions">' +
      (s.revealed
        ? '<button class="btn danger" onclick="App.gradeCard(false)">❌ Je ne savais pas</button>' +
          '<button class="btn success" onclick="App.gradeCard(true)">✅ Je savais</button>'
        : '<button class="btn primary" onclick="App.revealAnswer()">Voir la réponse</button>') +
      '</div>';
    window.scrollTo(0, 0);
  }

  function revealAnswer() {
    session.revealed = true;
    renderStudy();
  }

  function gradeCard(known) {
    var s = session;
    var card = s.cards[s.index];
    (known ? s.known : s.unknown).push(card);
    if (s.srs && card.type === "classic") {
      applyLeitner(card, known);
      save();
    }
    s.index++;
    s.revealed = false;
    renderStudy();
  }

  function renderStudySummary() {
    var s = session;
    var deck = findDeck(s.deckId);
    var total = s.cards.length;
    var pct = Math.round((s.known.length / total) * 100);
    var emoji = pct === 100 ? "🏆" : pct >= 60 ? "👏" : "💪";

    var html =
      '<div class="card" style="text-align:center">' +
      '<h1>' + emoji + ' Session terminée !</h1>' +
      '<div class="score-big">' + s.known.length + ' / ' + total + '</div>' +
      '<p class="subtitle">' + pct + ' % de bonnes réponses</p>';

    // Message Leitner : quand revoir ces fiches.
    if (s.srs) {
      var next = nextDueStr(deck);
      var remaining = dueCount(deck);
      html += '<p class="subtitle">' +
        (remaining > 0
          ? 'Encore ' + plural(remaining, "fiche") + ' à réviser aujourd\'hui.'
          : (next ? 'Prochaine révision de ce paquet ' + humanDelay(todayStr(), next) + '.' : 'Paquet terminé pour aujourd\'hui !')) +
        '</p>';
    }

    html += '<div class="study-actions">' +
      (s.unknown.length
        ? '<button class="btn primary" onclick="App.retryUnknown()">🔁 Revoir les ' + s.unknown.length + ' ratée' + (s.unknown.length > 1 ? "s" : "") + '</button>'
        : '') +
      '<button class="btn" onclick="App.restartStudy()">🔀 Révision libre</button>' +
      '<button class="btn ghost" onclick="App.openDeck(\'' + deck.id + '\')">Retour au paquet</button>' +
      '</div></div>';

    if (s.unknown.length) {
      html += '<div class="card mt"><h2>À retravailler</h2>';
      s.unknown.forEach(function (c) {
        html += '<div class="summary-line"><span>' + esc(c.question) + '</span><strong>' + esc(c.answer) + '</strong></div>';
      });
      html += '</div>';
    }
    appEl.innerHTML = html;
    window.scrollTo(0, 0);
  }

  // Rejouer les fiches ratées, sans toucher aux boîtes Leitner (pur entraînement).
  function retryUnknown() {
    var deck = findDeck(session.deckId);
    beginStudy(deck, shuffle(session.unknown.slice()), false);
  }

  // Révision libre de toutes les fiches, sans mise à jour des boîtes.
  function restartStudy() {
    var deck = findDeck(session.deckId);
    var pool = cardsOfType(deck, "classic");
    if (!pool.length) { renderDeck(deck.id); return; }
    beginStudy(deck, shuffle(pool), false);
  }

  /* ---------------- Mode énigmes ---------------- */

  function startRiddles(deckId) {
    var deck = findDeck(deckId);
    if (!deck) return;
    var pool = cardsOfType(deck, "riddle");
    if (!pool.length) return;
    session = {
      mode: "riddle",
      deckId: deckId,
      cards: shuffle(pool),
      index: 0,
      cluesShown: 1,
      state: "guessing", // guessing | solved | revealed
      points: 0,
      results: []
    };
    renderRiddle();
  }

  function currentRiddle() {
    return session.cards[session.index];
  }

  // Points : trouvé au 1er indice = nombre d'indices, puis dégressif ; réponse révélée = 0.
  function riddlePoints(card, cluesUsed) {
    return Math.max(card.clues.length - cluesUsed + 1, 1);
  }

  function renderRiddle(feedback) {
    view = "riddle";
    var s = session;
    var deck = findDeck(s.deckId);
    if (s.index >= s.cards.length) { renderRiddleSummary(); return; }
    var card = currentRiddle();
    var pct = Math.round((s.index / s.cards.length) * 100);

    var cluesHtml = "";
    for (var i = 0; i < s.cluesShown && i < card.clues.length; i++) {
      cluesHtml += "<li><strong>Indice " + (i + 1) + " :</strong> " + esc(card.clues[i]) + "</li>";
    }

    var body;
    if (s.state === "guessing") {
      var remaining = card.clues.length - s.cluesShown;
      body =
        '<div class="guess-row">' +
        '<input type="text" id="guess" placeholder="Votre réponse…" autocomplete="off" ' +
        'onkeydown="if(event.key===\'Enter\')App.submitGuess()">' +
        '<button class="btn primary" onclick="App.submitGuess()">Valider</button>' +
        '</div>' +
        '<div class="feedback bad" id="feedback">' + (feedback || "") + '</div>' +
        '<div class="study-actions">' +
        (remaining > 0
          ? '<button class="btn" onclick="App.nextClue()">💡 Indice suivant (' + remaining + ' restant' + (remaining > 1 ? "s" : "") + ')</button>'
          : '<button class="btn danger" onclick="App.giveUp()">🏳️ Voir la réponse</button>') +
        '</div>';
    } else {
      var solved = s.state === "solved";
      var pts = solved ? riddlePoints(card, s.cluesShown) : 0;
      body =
        '<div class="feedback ' + (solved ? "good" : "bad") + '">' +
        (solved ? "🎉 Bravo, trouvé avec " + plural(s.cluesShown, "indice") + " !" : "La réponse était :") +
        '</div>' +
        '<div class="reveal">' + esc(card.answer) + '</div>' +
        '<p class="counter">' + (solved ? "+" + plural(pts, "point") : "0 point") + '</p>' +
        '<div class="study-actions">' +
        '<button class="btn primary" onclick="App.nextRiddle()">' +
        (s.index + 1 < s.cards.length ? "Énigme suivante →" : "Voir le score final") +
        '</button></div>';
    }

    appEl.innerHTML =
      '<div class="row spread">' +
      '<button class="btn ghost small" onclick="App.openDeck(\'' + deck.id + '\')">✕ Quitter</button>' +
      '<span class="counter">Énigme ' + (s.index + 1) + ' / ' + s.cards.length + ' — ' + plural(s.points, "point") + '</span></div>' +
      '<div class="progress-track"><div class="progress-fill" style="width:' + pct + '%"></div></div>' +
      '<div class="study-card">' +
      '<ul class="clue-list">' + cluesHtml + '</ul>' +
      body +
      '</div>';

    var input = document.getElementById("guess");
    if (input) input.focus();
    window.scrollTo(0, 0);
  }

  function submitGuess() {
    var s = session;
    var card = currentRiddle();
    var input = document.getElementById("guess");
    var guess = input.value;
    if (!normalize(guess)) { input.focus(); return; }

    if (normalize(guess) === normalize(card.answer)) {
      s.points += riddlePoints(card, s.cluesShown);
      s.state = "solved";
      s.results.push({ card: card, solved: true, clues: s.cluesShown });
      renderRiddle();
    } else {
      // Mauvaise réponse : petit retour visuel, puis indice suivant s'il en reste.
      var fb = document.getElementById("feedback");
      fb.textContent = "« " + guess.trim() + " » n'est pas la bonne réponse.";
      input.value = "";
      input.classList.add("shake");
      setTimeout(function () { input.classList.remove("shake"); }, 350);
      if (s.cluesShown < card.clues.length) {
        s.cluesShown++;
        renderRiddle("« " + guess.trim() + " » n'est pas la bonne réponse. Voici un nouvel indice !");
      } else {
        input.focus();
      }
    }
  }

  function nextClue() {
    var s = session;
    if (s.cluesShown < currentRiddle().clues.length) {
      s.cluesShown++;
      renderRiddle();
    }
  }

  function giveUp() {
    var s = session;
    s.state = "revealed";
    s.results.push({ card: currentRiddle(), solved: false, clues: s.cluesShown });
    renderRiddle();
  }

  function nextRiddle() {
    var s = session;
    s.index++;
    s.cluesShown = 1;
    s.state = "guessing";
    renderRiddle();
  }

  function renderRiddleSummary() {
    var s = session;
    var deck = findDeck(s.deckId);
    var max = 0;
    s.cards.forEach(function (c) { max += c.clues.length; });
    var solved = s.results.filter(function (r) { return r.solved; }).length;
    var emoji = solved === s.cards.length ? "🏆" : solved > 0 ? "👏" : "💪";

    var html =
      '<div class="card" style="text-align:center">' +
      '<h1>' + emoji + ' Énigmes terminées !</h1>' +
      '<div class="score-big">' + s.points + ' / ' + max + ' pts</div>' +
      '<p class="subtitle">' + solved + ' énigme' + (solved > 1 ? 's' : '') + ' résolue' + (solved > 1 ? 's' : '') + ' sur ' + s.cards.length + '</p>' +
      '<div class="study-actions">' +
      '<button class="btn primary" onclick="App.startRiddles(\'' + deck.id + '\')">🔁 Rejouer</button>' +
      '<button class="btn ghost" onclick="App.openDeck(\'' + deck.id + '\')">Retour au paquet</button>' +
      '</div></div>' +
      '<div class="card mt"><h2>Détail</h2>';

    s.results.forEach(function (r) {
      html += '<div class="summary-line"><span>' + esc(r.card.answer) + '</span>' +
        '<span>' + (r.solved
          ? "✅ trouvé avec " + plural(r.clues, "indice") + " (+" + riddlePoints(r.card, r.clues) + ")"
          : "❌ non trouvé") + '</span></div>';
    });
    html += '</div>';
    appEl.innerHTML = html;
    window.scrollTo(0, 0);
  }

  /* ---------------- API publique (handlers des boutons) ---------------- */

  window.App = {
    goHome: renderHome,
    newDeck: function () { renderDeckForm(null); },
    editDeck: renderDeckForm,
    saveDeck: saveDeck,
    deleteDeck: deleteDeck,
    openDeck: renderDeck,
    newCard: function (deckId) { renderCardForm(deckId, null); },
    editCard: renderCardForm,
    saveCard: saveCard,
    deleteCard: deleteCard,
    onCardTypeChange: onCardTypeChange,
    exportDeck: exportDeck,
    exportAll: exportAll,
    askImport: askImport,
    importExample: importExample,
    startStudy: function (deckId) { startStudy(deckId); },
    studyAhead: studyAhead,
    revealAnswer: revealAnswer,
    gradeCard: gradeCard,
    retryUnknown: retryUnknown,
    restartStudy: restartStudy,
    startRiddles: startRiddles,
    submitGuess: submitGuess,
    nextClue: nextClue,
    giveUp: giveUp,
    nextRiddle: nextRiddle,
    enableReminders: enableReminders,
    disableReminders: disableReminders
  };

  renderHome();

  // Rappel « à l'ouverture » : notifie les fiches dues si les rappels sont activés.
  maybeNotifyDue();

  // Enregistre le service worker (PWA : installable + fonctionne hors-ligne).
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () { /* pas grave */ });
    });
  }

  // Charge la liste des paquets d'exemple embarqués avec le site.
  // Nécessite un serveur HTTP (GitHub Pages, python -m http.server…) ;
  // en ouverture directe du fichier (file://), la section est simplement absente.
  if (window.fetch && location.protocol !== "file:") {
    fetch("exemples/index.json")
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (manifest) {
        if (Array.isArray(manifest) && manifest.length) {
          examples = manifest;
          if (view === "home") renderHome();
        }
      })
      .catch(function () { /* pas d'exemples : tant pis */ });
  }
})();
