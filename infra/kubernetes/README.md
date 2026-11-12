# Kubernetes

Three machines, one k3s cluster each. The clusters are not joined. Each machine runs dev, test, and prod in separate namespaces, and the NATS servers of one stage route to each other across machines. The hosts are set up in [`infra/nixos`](../nixos/README.md).

| Part            | What                                     |
| --------------- | ---------------------------------------- |
| `traefik`       | TLS for the UIs and the registry         |
| `registry`      | zot, shared by every stage               |
| `observability` | Vector, VictoriaLogs, logs MCP, shared   |
| `beszel`        | Beszel hub and agent, shared             |
| `eventhub-dev`  | NATS and eventhub-connect, one per stage |
| `eventhub-test` | NATS and eventhub-connect, one per stage |
| `eventhub-prod` | NATS and eventhub-connect, one per stage |

## Layout

```text
infra/kubernetes/
├── external-images.txt
├── services/            one directory per workload
├── environments/        dev, test, prod, plus shared
├── components/          pieces several parts include
└── clusters/<host>/     the machine, including its zone
```

The zone and stage name the public hostname, and its first label (`eventhub-connect-<zone>-<stage>`) is the NATS server name. The operator UI links cluster peers by swapping that label. A bundle applied to the wrong machine stays Pending.

## Ports

| Port                 | Container | Host (dev / test / prod) |
| -------------------- | --------- | ------------------------ |
| NATS cluster routes  | 6222      | 26222 / 16222 / 6222     |
| MQTT (TLS)           | 8883      | 28883 / 18883 / 8883     |
| NATS WebSocket (TLS) | 9222      | 29222 / 19222 / 9222     |
| Operator UI (TLS)    | 4173      | 443, by hostname         |
| Registry (TLS)       | 5000      | 5000, shared             |
| Beszel hub UI (TLS)  | 8090      | 8081, shared             |
| Beszel agent         | 45876     | 45876, host network      |

NATS client and monitor ports stay inside the cluster. Everything with TLS uses the stage certificate; the shared registry and Beszel use the dev one.

## Deploy

```sh
just k8s-build-dryrun                # render every bundle, no cluster needed
just k8s-diff bad eventhub-dev       # host alias or name, optional part
just k8s-apply bad eventhub-dev
```

On a fresh machine apply the shared parts first, then the stages. Roll a NATS change one machine at a time, and never rename a NATS server on a running machine.

## Secrets and certificates

Secrets live as `*.sops.yaml` next to the manifests. The `k8s-*` recipes decrypt them, render, and delete the plaintext.

- Certificates: `just tls-store <stage> tls.crt`, then apply and restart NATS. See [Certificates](../../docs/development/certificates.md).
- NATS route password: one per stage. A rotation splits the stage until NATS restarts on all three machines.
- Connect's NATS login must match the hash in the NATS users file.

## Logs

The logs MCP has no authentication, so it stays inside the cluster. Forward it for `.cursor/mcp.json`:

```sh
just k8s-logs-mcp        # all hosts
just k8s-logs-mcp bad    # one host
```

## Beszel

Every hub shows all three machines. Add machines in [`services/beszel/hub/config.yml`](services/beszel/hub/config.yml), not in the UI, which drops them on restart.

## Registry

```sh
just registry-local-setup    # log in to every host's registry
just registry-sync-all       # copy external-images.txt to every host
just build-container         # build eventhub-connect and push it to every host
```

Pods pull through the cluster address. Only Traefik's TLS port faces the network.

## Local development

No local cluster. `just nats-up` runs one NATS from [`infra/nats/nats-dev.conf`](../nats/nats-dev.conf).
