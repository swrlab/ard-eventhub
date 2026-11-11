# Kubernetes

Three machines, one k3s cluster each: `eventhub-connect-bad`, `eventhub-connect-stg`, `eventhub-connect-mnz`. The clusters are not joined. Each machine runs dev, test, and prod in separate namespaces, and the NATS servers of one stage route to each other across machines. NixOS config for the hosts is in [`infra/nixos`](../nixos/README.md).

| Part            | Namespace       | What                            |
| --------------- | --------------- | ------------------------------- |
| `registry`      | `registry`      | zot, shared by every stage      |
| `observability` | `observability` | Vector and VictoriaLogs, shared |
| `beszel`        | `beszel`        | Beszel hub and agent, shared    |
| `eventhub-dev`  | `eventhub-dev`  | NATS and eventhub-connect       |
| `eventhub-test` | `eventhub-test` | NATS and eventhub-connect       |
| `eventhub-prod` | `eventhub-prod` | NATS and eventhub-connect       |

## Layout

```text
infra/kubernetes/
├── external-images.txt
├── services/            one directory per workload
├── environments/        dev, test, prod, plus shared
└── clusters/<host>/     the machine, including its zone
```

`ZONE` and `STAGE` name the NATS server (`prod-bad`) and the public hostname `eventhub-connect-<zone>-<stage>.swr.cn.ard.de`, which is a SAN of the stage certificate. A bundle applied to the wrong machine stays Pending.

## Ports

| Port                 | Container | Host (dev / test / prod) |
| -------------------- | --------- | ------------------------ |
| NATS cluster routes  | 6222      | 26222 / 16222 / 6222     |
| MQTT (TLS)           | 8883      | 28883 / 18883 / 8883     |
| NATS WebSocket (TLS) | 9222      | 29222 / 19222 / 9222     |
| Operator UI          | 4173      | 24173 / 14173 / 4173     |
| Registry             | 5000      | 5000, shared             |
| Beszel hub UI        | 8090      | 8081, shared             |
| Beszel agent         | 45876     | 45876, host network      |

NATS client (`4222`) and monitor (`8222`) stay in the cluster. Hosts are reached at `<server>.swr.ard`, where `<server>` comes from [`infra/nixos/hosts.toml`](../nixos/hosts.toml).

## Deploy

```sh
just k8s-build-dryrun                # render every bundle, no cluster needed
just k8s-diff bad eventhub-dev       # host alias or name, optional part
just k8s-apply bad eventhub-dev
```

On a fresh machine apply `registry`, `observability`, and `beszel` first, then the stages. Roll a NATS change one machine at a time. The NATS server name is the JetStream identity of its volume, so never rename it on a running machine.

## Secrets

The `k8s-*` recipes decrypt the `*.sops.yaml` files next to the manifests, run kustomize, and delete the plaintext.

- `nats-route` has one password per stage, the same on every machine. A rotation splits the stage until NATS restarts on all three.
- `nats-tls` is a self-signed placeholder. Install the CA certificate with `just k8s-tls`, then drop `tls.yaml` from [`services/nats/kustomization.yaml`](services/nats/kustomization.yaml), or the next apply restores the placeholder.
- `beszel-hub` holds the hub SSH key all machines share and the first admin login. The sops file explains how to re-create the key.
- `registry-htpasswd` is mounted as a subPath, so restart `deployment/registry` after a password change.
- `eventhub-connect` (`NATS_USER`, `NATS_PASSWORD`, `ARD_FEED_URL`) is still created by hand in each stage namespace.

## Beszel

Each hub polls the agents on all three machines, so any one hub shows the whole fleet. The machines are listed in [`services/beszel/hub/config.yml`](services/beszel/hub/config.yml). The hub deletes every system not in that file when it starts, so add machines there, not in the UI.

## Registry

```sh
just registry-local-setup    # zot login for every host in the local Docker config
just registry-sync bad       # copy external-images.txt into zot
just build-container         # build eventhub-connect and push it to every host
```

Pods pull `registry.registry.svc:5000/<repository>`, and NixOS points containerd at `127.0.0.1:5000` for that name. The connect image stays a placeholder tag in `environments/<stage>` until one is pinned.

## Local development

No local cluster. `just nats-up` or `just nats-up-docker` runs one NATS from [`infra/nats/nats-dev.conf`](../nats/nats-dev.conf).
