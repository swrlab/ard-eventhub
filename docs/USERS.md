# ARD Eventhub / Benutzer

Um sich beim Eventhub zu authentifizieren und mit der API zu arbeiten, benötigen Sie ein gültiges Benutzerkonto. Die Logins sind derzeit von der ARD Core API getrennt, nutzen aber ein ähnliches Verfahren. Diese Seite beschreibt die Verwaltung von Benutzern.

## Authentifizierung

Siehe das Kapitel [Authentifizierung](./AUTHENTICATION.md) für Details.

## Neue Benutzer anlegen

Neue Benutzer können sich nicht selbst registrieren; der Zugang wird über das ARD Online Team gewährt. Die folgende Schritt-für-Schritt-Anleitung richtet sich an Admins, die ein neues Konto anlegen möchten.

- Öffnen Sie Datastore im GCP Eventhub-Projekt, wechseln Sie zum passenden Namespace (meist `prod`) und zur Kind-Collection `users`
- Prüfen Sie, ob der Benutzer noch nicht existiert, und legen Sie dann eine neue Entität an
  - Der Entity-Key sollte der `_Custom Name_` sein, als Wert die E‑Mail-Adresse des Benutzers (**in Kleinbuchstaben**)
  - Setzen Sie `active` auf `true`
  - Im Feld `institutionId` tragen Sie die ID ein, die auch im ARD Core genutzt wird, z. B. `urn:ard:institution:hex`
- Nachdem der Benutzer in Datastore angelegt wurde, registrieren Sie ihn in Firebase: Öffnen Sie die [Firebase Console](https://console.firebase.google.com/) unter _Build_ -> _Authentication_
  - Klicken Sie auf _Add user_ und verwenden Sie dieselbe E‑Mail-Adresse (kleingeschrieben). Das Passwort kann temporär zufällig sein.
  - Nach dem Anlegen wählen Sie im Dropdown _Reset password_ und bestätigen die Aktion.
- Der Benutzer erhält nun eine E‑Mail zum Setzen seines Passworts und kann anschließend die API nutzen.

## Benutzer entfernen

Wenn ein Benutzer gelöscht werden soll, gehen Sie wie folgt vor:

- Prüfen Sie, ob der Benutzer Subscriptions angelegt hat, die eventuell entfernt werden müssen (Pub/Sub und Datastore)
  - Hinweis: Zugriffsrechte für Subscriptions gelten institutionsweit; beim Entfernen eines Benutzers bleiben die Rechte ggf. für die Kollegen bestehen.
- Löschen Sie die Benutzer-Entität aus dem Datastore indem sie ihn selektieren und seinen Eintrag löschen
- Entfernen Sie anschließend das Benutzerprofil in der Firebase Console
