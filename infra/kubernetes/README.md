# Kubernetes

Three machines, one k3s cluster each: `eventhub-connect-bad`, `eventhub-connect-stg`, `eventhub-connect-mnz`. The clusters are not joined. Each machine runs dev, test, and prod in separate namespaces, and the NATS servers of one stage route to each other across machines. NixOS config for the hosts is in [`infra/nixos`](../nixos/README.md).

| Part            | Namespace       | What                                   |
| --------------- | --------------- | -------------------------------------- |
| `traefik`       | `kube-system`   | TLS on :443 and :5000, shared          |
| `registry`      | `registry`      | zot, shared by every stage             |
| `observability` | `observability` | Vector, VictoriaLogs, logs MCP, shared |
| `beszel`        | `beszel`        | Beszel hub and agent, shared           |
| `eventhub-dev`  | `eventhub-dev`  | NATS and eventhub-connect              |
| `eventhub-test` | `eventhub-test` | NATS and eventhub-connect              |
| `eventhub-prod` | `eventhub-prod` | NATS and eventhub-connect              |

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
| Operator UI (TLS)    | 4173      | 443, by hostname         |
| Registry (TLS)       | 5000      | 5000, shared             |
| Beszel hub UI        | 8090      | 8081, shared             |
| Beszel agent         | 45876     | 45876, host network      |

Traefik terminates TLS for the operator UI and the registry with our certificates. Each stage routes its own `eventhub-connect-<zone>-<stage>` names on :443. The registry is `eventhub-connect-<zone>-dev.swr.ard:5000`, a dev SAN. NATS client (`4222`) and monitor (`8222`) stay in the cluster. Hosts are reached at `<server>.swr.ard`, where `<server>` comes from [`infra/nixos/hosts.toml`](../nixos/hosts.toml).

## Deploy

```sh
just k8s-build-dryrun                # render every bundle, no cluster needed
just k8s-diff bad eventhub-dev       # host alias or name, optional part
just k8s-apply bad eventhub-dev
```

On a fresh machine apply `traefik`, `registry`, `observability`, and `beszel` first, then the stages. Roll a NATS change one machine at a time. The NATS server name is the JetStream identity of its volume, so never rename it on a running machine.

## Secrets

The `k8s-*` recipes decrypt the `*.sops.yaml` files next to the manifests, run kustomize, and delete the plaintext.

- `nats-route` has one password per stage, the same on every machine. A rotation splits the stage until NATS restarts on all three.
- `eventhub-tls` is the stage certificate in `environments/<stage>/tls.sops.yaml`, one per stage for all three zones. NATS (MQTT, WebSocket) and Traefik (operator UI) serve it. `just tls-store <stage> tls.crt` writes it, and for dev also `registry-tls`. NATS needs `just k8s-nats-restart` after an apply, see [Certificates](../../docs/development/certificates.md).
- `beszel-hub` holds the hub SSH key all machines share and the first admin login. The sops file explains how to re-create the key.
- `registry-htpasswd` is mounted as a subPath, so restart `deployment/registry` after a password change.
- `eventhub-connect` (`NATS_USER`, `NATS_PASSWORD`, `ARD_FEED_URL`) is still created by hand in each stage namespace.

## Logs

Vector ships every pod log on a machine to that machine's VictoriaLogs. The VictoriaLogs MCP server has no authentication, so it stays inside the cluster. Forward it with the host's kubeconfig:

```sh
just k8s-logs-mcp        # all hosts, bad/mnz/stg on 127.0.0.1:9431/9432/9433
just k8s-logs-mcp bad    # one host
```

`.cursor/mcp.json` points `victorialogs-<zone>` at those ports.

## Beszel

Each hub polls the agents on all three machines, so any one hub shows the whole fleet. The machines are listed in [`services/beszel/hub/config.yml`](services/beszel/hub/config.yml). The hub deletes every system not in that file when it starts, so add machines there, not in the UI.

## Registry

```sh
just registry-local-setup    # zot login for every host in the local Docker config
just registry-sync-all       # copy external-images.txt into zot on every host (or: registry-sync bad)
just build-container         # build eventhub-connect and push it to every host
```

Pods pull `registry.registry.svc:5000/<repository>`. NixOS points containerd at the fixed ClusterIP `10.43.0.50:5000` for that name, plain HTTP that stays on the machine. Until `registry-tls` holds the CA certificate, run the recipes with `REGISTRY_INSECURE=1`. The connect image stays a placeholder tag in `environments/<stage>` until one is pinned.

The Service used to be a LoadBalancer. A ClusterIP cannot change in place, so a machine that still has the old Service needs `kubectl delete service registry -n registry` once before `just k8s-apply <host> registry`.

## Local development

No local cluster. `just nats-up` or `just nats-up-docker` runs one NATS from [`infra/nats/nats-dev.conf`](../nats/nats-dev.conf).
