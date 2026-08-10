---
title: 'Benutzer'
description: 'Benutzerverwaltung für Admins.'
---

Um sich beim Eventhub zu authentifizieren und mit der API zu arbeiten, benötigst du ein gültiges Benutzerkonto. Die Logins sind derzeit von der ARD Core API getrennt, nutzen aber ein ähnliches Verfahren. Diese Seite beschreibt die Verwaltung von Benutzern.

## Allow-List

Zur Laufzeit liest der Ingest-Service `src/config/users.json` (gitignored; in Kubernetes oft als Volume gemountet).

Quellen in Git (verschlüsselt):

- `users-test.sops.json` — Vorlagen/Quelle für Test/Dev
- `users-prod.sops.json` — Vorlagen/Quelle für Prod

Lokal erzeugen z. B. mit:

```sh
just decrypt-key src/config/users-test.sops.json
# bzw. für den Laufzeit-Pfad:
sops decrypt src/config/users-test.sops.json > src/config/users.json
```

Jeder Eintrag hat die Form:

```json
{
	"email": "name@example.de",
	"institution": "SWR",
	"institutionId": "urn:ard:institution:hex"
}
```

E‑Mail-Adressen müssen exakt mit dem Firebase-Login übereinstimmen (kein Trim/Lowercase). Wer in der Datei steht, gilt als aktiv.

## Neue Benutzer anlegen

Neue Benutzer können sich nicht selbst registrieren; der Zugang wird über das ARD Online Team gewährt.

- Öffne die passende `users-*.sops.json` (`just edit-key src/config/users-test.sops.json` bzw. `users-prod`)
- Prüfe, ob die E‑Mail noch nicht existiert, und füge einen neuen Eintrag mit `institution` + `institutionId` hinzu
- Committe die aktualisierte `.sops.json` und stelle sicher, dass Deployments `users.json` bereitstellen (Decrypt oder Mount)
- Registriere den Benutzer in Firebase: [Firebase Console](https://console.firebase.google.com/) unter _Build_ → _Authentication_
  - _Add user_ mit derselben E‑Mail; Passwort kann temporär zufällig sein
  - Danach im Dropdown _Reset password_ auslösen
- Der Benutzer erhält eine E‑Mail zum Setzen des Passworts und kann anschließend die API nutzen

## Benutzer entfernen

- Prüfe, ob der Benutzer Subscriptions angelegt hat, die eventuell entfernt werden müssen (Pub/Sub und Datastore)
  - Hinweis: Zugriffsrechte für Subscriptions gelten institutionsweit; beim Entfernen eines Benutzers bleiben die Rechte ggf. für die Kollegen bestehen
- Entferne den Eintrag aus der passenden `users-*.sops.json` und aktualisiere das gemountete/`users.json`
- Entferne anschließend das Benutzerprofil in der Firebase Console
