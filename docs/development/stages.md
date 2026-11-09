---
title: 'Stages'
description: 'Stage-Werte und Deployment-Umgebungen.'
deprecated: true
sidebar:
  icon: layer-arrow-up
---

Der Eventhub unterscheidet zwischen dem über die Umgebungsvariable `STAGE` gesetzten Stage-Wert und verschiedenen Laufzeit-Umgebungen bzw. Deployments (z.B. `beta`, `test`, `prod`).

## Connect

Die Connect-Testumgebung wartet auf die Bereitstellung der Server durch SWR. Einen Termin gibt es noch nicht. Zugänge, Zertifikat und Verbindungsinfos gehen an die Häuser, sobald die drei Testserver bereit stehen. Die Kennung beantragst du beim Eventhub-Team, siehe [_Zugangsdaten_](../user/acl). Hostnamen und Ports stehen unter [_Firewall_](./firewall).

## Ingest

### Ingest Service Stages

| Module / Stage | `dev`                | `test`                | `prod`                |
| -------------- | -------------------- | --------------------- | --------------------- |
| Database       | Namespace `dev`      | Namespace `test`      | Namespace `prod`      |
| Pub/Sub        | Prefix enthält `dev` | Prefix enthält `test` | Prefix enthält `prod` |
| Users file     | `users.json` (mount) | `users.json` (mount)  | `users.json` (mount)  |
| Dev Logging    | true                 | true                  | false                 |

### Ingest Deployment Stages

| Module / Stage               | `dev`                        | `test`                         | `beta`                        | `prod`                   |
| ---------------------------- | ---------------------------- | ------------------------------ | ----------------------------- | ------------------------ |
| Used Ingest Stage            | `dev`                        | `test`                         | `prod`                        | `prod`                   |
| Stable                       | Nein, für interne Tests      | Ja, für externe Tests geeignet | Ja, normalerweise             | Ja                       |
| Runtime                      | Cloud Run                    | Kubernetes                     | Kubernetes                    | Kubernetes               |
| Container Registry           | Eventhub-Projekt             | Eventhub-Projekt               | Eventhub-Projekt              | Eventhub-Projekt         |
| Host                         | Nur für internen Gebrauch    | `eventhub-ingest-test.ard.de`  | `eventhub-ingest-beta.ard.de` | `eventhub-ingest.ard.de` |
| Automatic Deployment         | Nein, manueller Trigger      | Ja, über API mit Review        | Ja, über API mit Review       | Nein, manueller Trigger  |
| Deployment Branch Protection | `main`, `dev/*`, `feature/*` | `main`                         | `main`                        | `main`                   |
