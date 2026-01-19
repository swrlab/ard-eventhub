# ARD Eventhub / Schnellstart

Dieser Leitfaden hilft dir beim Start in den ARD Eventhub.

Egal, ob du Publisher oder Subscriber bist: Du benötigst ein Benutzerkonto, um mit der API zu interagieren. Fordere ein Konto über deinen Ansprechpartner beim SWR Audio Lab oder ARD Online an. Administratoren können die `Users`-Dokumentation für die Registrierung heranziehen.

Nachdem das Konto eingerichtet wurde, lies das Kapitel zur Authentifizierung, um mehr über Login und den Token-Austausch zu erfahren.

## Publisher

Wenn du als Hörfunkanstalt Events in den ARD Eventhub publizieren möchtest, befolge diese einfachen Schritte:

- Richte dein Konto ein, lese und verstehe den Authentifizierungsprozess
- Verwende den POST-Endpoint `/events/{eventName}`, um Events zu senden
- Hinweis: Auch wenn GET `/topics` deine Sender noch nicht auflistet, werden die Topics beim ersten veröffentlichten Event automatisch erstellt (die Antwort enthält z.B.):

```js
{
    "statuses": {
        "published": 0,
        "blocked": 0,
        "failed": 1
    },
    "event": {
        "name": "de.ard.eventhub.v1.radio.track.next",
        // ...
        "services": [
            {
                "type": "PermanentLivestream",
                "externalId": "crid://swr.de/282310/demo7",
                "publisherId": "urn:ard:publisher:75dbb3dace15f610",
                "topic": {
                    "id": "urn:ard:permanent-livestream:234690e18c2c7863",
                    "name": "de.ard.eventhub.dev.urn%3Aard%3Apermanent-livestream%3A234690e18c2c7863",
                    "status": "TOPIC_CREATED",
                    "messageId": null
                }
            }
        ],
        // ...
    }
}
```

Es wird empfohlen, zunächst das `test`-System des Eventhub zu nutzen, um alles zu prüfen, bevor du in die Produktion (`prod`) wechselst. Die Hostnamen findest du im Dokument zu den Stages.

Sicherheits-Hinweis: Jedes Benutzerkonto darf nur zu `publisherId`s seiner eigenen Institution publizieren. Sofern man einen Fehler zurückbekommt kann die ID falsch sein oder das Benutzerkonto wurde durch einen Admin falsch konfiguriert.

### Umgang mit Events aus externen Quellen

Wenn du Eventhub benutzt um Events aus einer anderen Anstalt zu empfangen (z.B. Nightly-Broadcasts) und diese für deinen Sender weiterveröffentlichst, ist es üblich, die empfangenen Events erneut an den Eventhub zu publizieren. 

Das ist wichtig, da deine Abonnenten erwarten alle Events deines Senders zu erhalten – inklusive der von anderen Sendern erneut gesendeten Events. Sie wissen möglicherweise nicht, dass du das Programm von einer anderen Station weiterverbreitest und nutzen lediglich ein Abonnement für deine Station, um alle Events zu empfangen.

Für Dienste wie die ARD Audiothek ist dies wichtig, andernfalls verfügt dein Sender möglicherweise über unvollständige Live-Metadaten, wenn du andere Sender erneut ausstrahlst.

In diesem Fall ist es wichtig, sicherzustellen, dass deine interne Filterung korrekt funktioniert, wenn du Events von anderen Sendern empfängst, und diese nur zu veröffentlichen, wenn der Sender tatsächlich auf Sendung ist. Andernfalls könnte es zu einer Schleife kommen.

### Wichtige Hinweise zu External IDs

Details findest du in [EXTERNAL_IDS.md](./EXTERNAL_IDS.md).

### Beispiel-Workflow

Ein möglicher Ablauf in deinem System für jedes neue Event könnte so aussehen:

1. Prüfe ob dein `token`, den du von einem früheren Aufruf hast, noch gültig ist
2. Falls du keinen Gültigen mehr hast, prüfe ob du noch einen `refreshToken` von einem früheren Aufruf hast
   1. Falls ja, tausche ihn für einen gültigen `token` ein
   2. Falls nein, logge dich über die API erneut an
3. POST das Event im vorgegebenen Format. Das folgende Beispiel kann dir dabei helfen, den Aufbau eines Events zu verstehen:

```js
{
   "type": "music",
   "start": "2021-03-17T10:04:35+01:00",
   "length": 215.2,
   "title": "Save your tears",
   "artist": "The Weeknd",
   "contributors": [
      {
      "name": "The Weeknd",
      "role": "artist",
      "normDb": {
         "type": "Person",
         "id": "12345"
      }
      }
   ],
   "services": [
      {
         "type": "PermanentLivestream",
         "externalId": "crid://swr.de/282310",
         "publisherId": "282310"
      }
   ],
   "playlistItemId": "radiomax:SWR3-BAD-MAX:12569153",
   "externalId": "M0589810001",
   "isrc": null,
   "upc": null,
   "mpn": null,
   "media": [
      {
         "type": "cover",
         "url": "http://my-server/covers/M0589810.001",
         "templateUrl": null,
         "description": "SWR Cover zu Save your tears von The Weeknd",
         "attribution": ""
      }
   ],
   "hfdbIds": [
      "swrhfdb1.KONF.12345"
   ]
}

```

## Subscriber

Wenn du Events anderer Sender empfangen möchtest, trage dich als Subscriber ein und erhalte Echtzeit-POSTs (Webhooks) für alle veröffentlichten Events. Diese können z.B. deine Web- oder App-Angebote während der Wiederholungen in den nächtlichen Sendungen verbessern.

Beachte, dass der Typ der hier veröffentlichten Events in Zukunft erweitert werden kann, filtere deshalb entsprechend. Das Datenformat bleibt abwärtskompatibel, es können jedoch bei Bedarf neue Bereiche zu diesem Dienst hinzugefügt werden.

Bei nächtlichen Wiederholungen solltest du eine permanente Subscription 24/7 betreiben. Der Filter basierend auf dem Programmplan sollte auf deiner Seite durchgeführt werden. Pub/Sub sollte nicht zum wiederholten Erstellen/Löschen von Subscriptions während Start/Ende eines Re-Runs/Wiederholung genutzt werden.

Stelle sicher, dass dein Endpoint aus dem Internet erreichbar ist und ein gültiges SSL-Zertifikat installiert ist. Ist der Endpoint zeitweise nicht erreichbar, sammelt die Subscription vergangene Events und versucht die Zustellung erneut. Siehe dazu auch [`src/utils/pubsub/createSubscription.ts`](../src/utils/pubsub/createSubscription.ts) und [cloud.google.com/pubsub/docs/push](https://cloud.google.com/pubsub/docs/push#push_backoff).

Starte mit diesen Schritten:

- Richte dein Konto ein und verstehe den Authentifizierungsprozess
- Verwende GET `/topics`, um verfügbare Channels (Topics) zu sehen
- Wenn ein Channel nicht sichtbar ist, wurde noch nicht darauf publiziert. Topics entstehen erst beim ersten Senden eines Events.
- Erstelle mit POST `/subscriptions` Ihre Subscription
  - ACHTE darauf keine localhost Adressen als URL anzugeben.
- Lese die Google-Dokumentation ["Receiving messages using Push"](https://cloud.google.com/pubsub/docs/push#receiving_messages) für das Nachrichtenformat
- Verwende GET `/subcriptions`, um Subscriptions zu prüfen

Sicherheits-Hinweis: Ein registrierter Benutzer ist einer Institution (_Landesrundfunkanstalt_ oder _GSEA_) zugeordnet. Benutzer können alle Subscriptions innerhalb ihrer Institution verwalten — lösche keine Produktions-Einträge deiner Kollegen.
Mit dieser Methode hast du weiterhin Zugriff auf alle Abonnements, auch wenn eine Person deine Einrichtung verlässt oder dein Konto deaktiviert wird.

### Sicherheit

Generell empfiehlt es sich, Endpoints nicht öffentlich auffindbar zu machen. Um sicherzustellen, dass ein Event tatsächlich vom Eventhub stammt, verwende das mitgelieferte JWT-Token und den Service Account.

Die Antwort beim Erstellen einer Subscription enthält u.a. das verwendete Service Account-Feld:

```js
{
   ...
   "serviceAccount": "somethin@something-else.iam.gserviceaccount.com",
   ...
}
```

Bitte beachte, dass das Dienstkonto derzeit in der Regel dieselbe Antwort enthält. Bei zukünftigen Abonnements kann es jedoch sein, dass es ein anderes Konto enthält. Konfiguriere deinen Dienst so, dass für jedes Abonnement das entsprechende Konto überprüft wird.

### Beispiel-Receiver

Ein vereinfachtes Beispiel (Node.js mit Express): Die Google Cloud Sektion ["Authentication and authorization by the push endpoint"](https://cloud.google.com/pubsub/docs/push#authentication_and_authorization_by_the_push_endpoint) enthält weiterführende Informationen über diesen Prozess.

```js
// load node packages
const { OAuth2Client } = require('google-auth-library')
const authClient = new OAuth2Client()

// set received serviceAccount
const serviceAccountEmail = 'somethin@something-else.iam.gserviceaccount.com'

module.exports = async (req, res) => {
   try {
      // read token from header
      const bearer = req.header('Authorization')
      const [, idToken] = bearer.match(/Bearer (.*)/)

      // verify token, throws error if invalid
      const verification = await authClient.verifyIdToken({
         idToken,
      })

      // check token email vs. subscription email
      if(verification?.payload?.email === serviceAccountEmail) {
         // get message and metadata from pubsub body
         const { attributes, messageId } = req.body.message
         const { subscription } = req.body
         let data = Buffer.from(req.body.message.data, 'base64').toString()
         data = JSON.parse(data)

         // request successful, you can now use the received data
         console.log({ attributes, messageId, subscription, data })

         // close connection
         return res.sendStatus(201)
      } else {
         // user provided valid token but failed email verification
         return res.sendStatus(204)
      }
   } catch (error) {
      // request failed or invalid token
      return res.sendStatus(204)
   }
}
```
