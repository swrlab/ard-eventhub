# ARD Eventhub / Schnellstart

Dieser Leitfaden hilft Ihnen beim Start in den ARD Eventhub.

Egal, ob Sie Publisher oder Subscriber sind: Sie benötigen ein Benutzerkonto, um mit der API zu interagieren. Fordern Sie ein Konto über Ihre Ansprechpartner beim SWR Audio Lab oder ARD Online an. Administratoren können die `Users`-Dokumentation für die Registrierung heranziehen.

Nachdem das Konto eingerichtet wurde, lesen Sie das Kapitel zur Authentifizierung, um mehr über Login und Token-Austausch zu erfahren.

## Publisher

Wenn Sie als Hörfunkanstalt Events in den ARD Eventhub publizieren möchten, befolgen Sie diese einfachen Schritte:

- Richten Sie Ihr Konto ein und lesen und verstehen Sie den Authentifizierungsprozess
- Verwenden Sie den POST-Endpoint `/events/{eventName}`, um Events zu senden
- Hinweis: Auch wenn GET `/topics` Ihre Sender noch nicht auflistet, werden die Topics beim ersten veröffentlichten Event automatisch erstellt (die Antwort enthält z.B.):

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

Es wird empfohlen, zunächst das `test`-System des Eventhub zu nutzen, um alles zu prüfen, bevor Sie in die Produktion (`prod`) wechseln. Die Hostnamen finden Sie im Dokument zu den Stages.

Sicherheits-Hinweis: Jedes Benutzerkonto darf nur zu `publisherId`s seiner eigenen Institution publizieren. Sofern man einen Fehler zurückbekommt kann die ID falsch sein oder das Benutzerkonto wurde durch einen Admin falsch konfiguriert.

### Umgang mit Events aus externen Quellen

Wenn Sie Eventhub benutzen um Events aus einer anderen Anstalt empfangen (z.B. Nightly-Broadcasts) und diese für Ihren Sender weiterveröffentlichen, ist es üblich, die empfangenen Events erneut an den Eventhub zu publizieren. 

Das ist wichtig, da Ihre Abonnenten erwarten alle Events Ihres Senders zu erhalten – inklusive der von anderen Sendern erneut gesendeten Events. Sie wissen möglicherweise nicht, dass Sie das Programm von einer anderen Station weiterverbreiten und nutzen lediglich ein Abonnement für Ihre Station, um alle Events zu empfangen.

Für Dienste wie die ARD Audiothek ist dies wichtig, andernfalls verfügt Ihr Sender möglicherweise über unvollständige Live-Metadaten, wenn Sie andere Sender erneut ausstrahlen.

In diesem Fall ist es wichtig, sicherzustellen, dass Ihre interne Filterung korrekt funktioniert, wenn Sie Events von anderen Sendern empfangen, und diese nur zu veröffentlichen, wenn der Sender tatsächlich auf Sendung ist. Andernfalls könnte es zu einer Schleife kommen.

### Wichtige Hinweise zu External IDs

Details finden Sie in [EXTERNAL_IDS.md](./EXTERNAL_IDS.md).

### Beispiel-Workflow

Ein möglicher Ablauf in Ihrem System für jedes neue Event könnte so aussehen:

1. Check if you have `token` from a previous call that has not expired
2. If not found, check if you have a `refreshToken` from a previous call
   1. If found exchange it for a new `token`
   2. If not found, create a new login
3. POST the event using the pre-defined format. The example below might help you understand the different fields:

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

Wenn Sie Events anderer Sender empfangen möchten, tragen Sie sich als Subscriber ein und erhalten Echtzeit-POSTs (Webhooks) für alle veröffentlichten Events. Diese können z.B. Ihre Web- oder App-Angebote während der Wiederholungen in den nächtlichen Sendungen verbessern.

Beachten Sie, dass der Typ der hier veröffentlichten Events in Zukunft erweitert werden kann; filtern Sie deshalb entsprechend. Das Datenformat bleibt abwärtskompatibel, es können jedoch bei Bedarf neue Bereiche zu diesem Dienst hinzugefügt werden.

Bei nächtlichen Wiederholungen sollten Sie eine permanente Subscription 24/7 betreiben. Der Filter basierend auf dem Programmplan sollte auf Ihrer Seite durchgeführt werden. Pub/Sub sollte nicht zum wiederholten Erstellen/Löschen von Subscriptions während Start/Ende eines Re-Runs/Wiederholung genutzt werden.

Stellen Sie sicher, dass Ihr Endpoint aus dem Internet erreichbar ist und ein gültiges SSL-Zertifikat installiert ist. Ist der Endpoint zeitweise nicht erreichbar, sammelt die Subscription vergangene Events und versucht die Zustellung erneut. Siehe dazu auch [`src/utils/pubsub/createSubscription.ts`](../src/utils/pubsub/createSubscription.ts) und [cloud.google.com/pubsub/docs/push](https://cloud.google.com/pubsub/docs/push#push_backoff).

Starten Sie mit diesen Schritten:

- Richten Sie Ihr Konto ein und verstehen Sie den Authentifizierungsprozess
- Verwenden Sie GET `/topics`, um verfügbare Channels (Topics) zu sehen
- Wenn ein Channel nicht sichtbar ist, wurde noch nicht darauf publiziert. Topics entstehen erst beim ersten Senden eines Events.
- Erstellen Sie mit POST `/subscriptions` Ihre Subscription
  - ACHTEN Sie darauf keine localhost Adressen als URL anzugeben.
- Lesen Sie die Google-Dokumentation ["Receiving messages using Push"](https://cloud.google.com/pubsub/docs/push#receiving_messages) für das Nachrichtenformat
- Verwenden Sie GET `/subcriptions`, um Subscriptions zu prüfen

Sicherheits-Hinweis: Ein registrierter Benutzer ist einer Institution (_Landesrundfunkanstalt_ oder _GSEA_) zugeordnet. Benutzer können alle Subscriptions innerhalb ihrer Institution verwalten — löschen Sie keine Produktions-Einträge Ihrer Kollegen.
Mit dieser Methode haben Sie weiterhin Zugriff auf alle Abonnements, auch wenn eine Person Ihre Einrichtung verlässt oder ihr Konto deaktiviert wird.

### Sicherheit

Generell empfiehlt es sich, Endpoints nicht öffentlich auffindbar zu machen. Um sicherzustellen, dass ein Event tatsächlich vom Eventhub stammt, verwenden Sie das mitgelieferte JWT-Token und den Service Account.

Die Antwort beim Erstellen einer Subscription enthält u.a. das verwendete Service Account-Feld:

```js
{
   ...
   "serviceAccount": "somethin@something-else.iam.gserviceaccount.com",
   ...
}
```

Bitte beachten Sie, dass das Dienstkonto derzeit in der Regel dieselbe Antwort enthält. Bei zukünftigen Abonnements kann es jedoch sein, dass es ein anderes Konto enthält. Konfigurieren Sie Ihren Dienst so, dass für jedes Abonnement das entsprechende Konto überprüft wird.

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
