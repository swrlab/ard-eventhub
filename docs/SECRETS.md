# ARD Eventhub / Secrets

Dieses Repository benötigt verschiedene Secrets und Konfigurationsdateien, die an unterschiedlichen Orten verwaltet werden. Diese Seite dokumentiert, welche Konfigurationen wie und wo verwaltet werden.
Da das Projekt öffentlich gehalten wird, ist die komplette interne Konfiguration zu Secrets und deren Deployment hier nicht vollständig beschrieben. Detailliertere Informationen finden sich in internen Dokumenten.

## Code

Einige Module können unterschiedliche Variablen benötigen. Prüfe die README der jeweiligen Module für Details.
In der Regel sind nur wenige API-Keys für externe Services erforderlich. Der Zugriff auf Google Cloud-Dienste erfolgt über ein [Service Account](https://cloud.google.com/iam/docs/service-accounts) (SA) mit minimalen Rechten. Dieser SA wird über eine Umgebungsvariable hinzugefügt.

## GitHub

Secrets in GitHub sind standardmäßig für Benutzer write-only. Admins kannst du in Settings -> Secrets ändern, lesen kannst du die Werte jedoch nicht. Nur GitHub Actions hat Zugriff und kann die Werte in Workflows verwenden; die Werte werden standardmäßig in Logs verborgen.

- `GCP_GITHUB_SERVICE_ACCOUNT_KEY`
  - Base64-kodiert
  - Service Account zum Einloggen in Google Cloud, nötig u. a. zum Pushen von Containern und für Pull-Checks
  - In GitHub gespeichert, um im Registry-Workflow verwendet zu werden
- `GCP_PROJECT_ID`
  - Projekt-ID des Google Cloud-Projekts für Primärdienste wie Pub/Sub
  - In GitHub gespeichert, um Test-Workflows zu ermöglichen
- `GCP_SERVICE_ACCOUNT_INGEST`
  - E‑Mail-Adresse des Service Accounts für Cloud Run
  - In GitHub gespeichert, um neue Revisionskonfigurationen zu setzen
- `TEST_FIREBASE_API_KEY`
  - API-Key für Firebase, genutzt bei Pull-Checks
- `TEST_USER`
  - E‑Mail-Adresse des Testnutzers für `STAGE=dev` welche für Tests benutzt wird
- `TEST_USER_PW`
  - Passwort des Testnutzers

## Google Cloud

Bei Deployments in Google Cloud werden Umgebungsvariablen und Keys üblicherweise vom Runtime-System bzw. der Deployment-Konfiguration gestellt. Die Kubernetes-Deployment-Dateien sind hier nicht im Detail aufgeführt; sofern du Zugang zur Umgebung hast, solltest du wissen, wo zu suchen ist.

### Docker Image

Kubernetes muss Images aus einem Registry ziehen. Für bewöhnlich gibt es dafür ein spezifisches Repository. Für Eventhub verwenden wir ein internes Projekt-Registry, um diesen Key nicht im Repo zu speichern zu müssen. Stattdessen speichern wir Container in unserem Eventhub-Projekt und gewähren den SA Zugriff.
Öffne dazu die Console, navigiere zum Eventhub-Projekt, wähle storage und dann das artifact bucket. Füge in der Info-Ansicht die E‑Mail des Service Accounts mit der Berechtigung "_Storage Object Viewer_" hinzu.
