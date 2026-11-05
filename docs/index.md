---
title: 'ARD Eventhub'
description: 'Echtzeit-Metadaten für Hörfunksendungen der ARD verteilen.'
sidebar:
  icon: house
---

ARD Eventhub verteilt Echtzeit-Metadaten (Live) vor allem für Hörfunksendungen.

Neue Anbindungen laufen über [_Eventhub Connect_](./user/connect-mqtt) (MQTT). Die HTTPS-API ist deprecated und bleibt bis zum letzten Umzug erreichbar. Breaking Changes stehen unter [_Migration auf Eventhub v3_](./user/migration-v3).

## Aktive Datenlieferanten

Diese ARD-Anstalten senden derzeit Live-Metadaten über den ARD Eventhub:

| Broadcaster      | TEST | PROD |
| ---------------- | ---- | ---- |
| BR               | ✅   | ✅   |
| HR               | ✅   | ✅   |
| MDR              | -    | ✅   |
| NDR              | ✅   | ✅   |
| Radio Bremen     | -    | ✅   |
| RBB              | -    | ✅   |
| SR               | -    | ✅   |
| SWR              | ✅   | ✅   |
| WDR              | ✅   | ✅   |
| Deutschlandradio | -    | -    |
