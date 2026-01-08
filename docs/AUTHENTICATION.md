# ARD Eventhub / Authentifizierung

Um sich bei der Eventhub-API zu authentifizieren und damit zu arbeiten, benötigen Sie einen gültigen Benutzer. Derzeit werden diese Benutzer getrennt von der ARD Core API verwaltet, verwenden jedoch eine ähnliche Anmeldemethode. Auf dieser Seite wird der Prozess der Benutzerverwaltung beschrieben.

## Übersicht über die Authentifizierung

Die App verwendet einen Authentifizierungs-Workflow, der der neuen ARD Core API sehr ähnlich ist, sodass er nach der Live-Schaltung problemlos migriert werden kann (es können Abweichungen auftreten). Die Dokumentation zur ARD API finden Sie im [Entwicklerportal](https://developer.ard.de/core-api-v2-roles-and-access-control).

Insbesondere diese Seite behandelt die Anmeldemethoden für die ARD Eventhub API. Im Vergleich zur ARD Core API wird der Token-Austausch für ARD Eventhub direkt in diesem Dienst und nicht extern abgewickelt, sodass der `API_KEY` nicht gegenüber Clients offengelegt werden muss.

## Anmeldeinformationen gegen Token austauschen

**POST `{HOST}/auth/login`**

```json
{
  "email": "my-email@example.com",
  "password": "my-password"
}
```

Returns `200 OK`

```json
{
  "expiresIn": 3600,
  "expires": "2021-03-12T12:55:22.995Z",
  "token": "eyABCDEF.GHIJKL....",
  "refreshToken": "AOabcdefghijkl",
  "user": {
    "some": "objects"
  },
  "trace": null
}
```

Dieser Endpunkt gibt einen `token` und einen `refreshToken` zusammen mit einer Ablaufdauer und einem Datum zurück. Der `token` kann innerhalb des zurückgegebenen Zeitraums verwendet werden.

## Refresh Token

Während der normale `token` abläuft, kann der `refreshToken` über einen längeren Zeitraum verwendet werden. Daher kann er zum Austausch gegen einen neuen `token` verwendet werden.

**POST `{HOST}/auth/refresh`**

```json
{
  "refreshToken": "abcXYZ..."
}
```

Returns `200 OK`

```json
{
  "expiresIn": 3600,
  "expires": "2021-03-12T12:55:22.995Z",
  "token": "eyABCDEF.GHIJKL....",
  "refreshToken": "AOabcdefghijkl",
  "user": {
    "some": "objects"
  },
  "trace": null
}
```

### Verfall der Refresh Token

> Refresh Token verfallen nur, wenn einer der folgenden Fälle eintritt:
>
> - Der Benutzer gelöscht wird
> - Der Benutzer deaktiviert wird
> - Für den Benutzer wurde eine wesentliche Änderung festgestellt. Dazu gehören Änderungen wie die Aktualisierung des Passworts oder der E-Mail-Adresse.

[Source: Firebase docs](https://firebase.google.com/docs/auth/admin/manage-sessions)

## Passwort Reset

Falls Sie Ihr Passwort verloren haben, können Sie über diesen Endpoint eine Passwort-Reset-E-Mail anfordern. Dieser Endpoint kann künftig einer Drosselung/Rate-Limitierung unterliegen.

**POST `{HOST}/auth/reset`**

```json
{
  "email": "my-email@example.com"
}
```

Returns `200 OK`
