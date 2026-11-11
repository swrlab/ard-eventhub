# Kubernetes

Three machines, one k3s cluster each: `eventhub-connect-bad`, `eventhub-connect-stg`, `eventhub-connect-mnz`. Each machine runs dev, test, and prod in its own namespace. The clusters are not joined. The three NATS servers of one stage route to each other over that stage's host ports.

| Part            | Namespace       | What                            |
| --------------- | --------------- | ------------------------------- |
| `registry`      | `registry`      | zot, shared by every stage      |
| `observability` | `observability` | Vector and VictoriaLogs, shared |
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

An image or probe goes in `services/`, a stage's ports in `environments/<stage>`, a machine's zone in `clusters/<host>`. `ZONE` and `STAGE` name the NATS server (`prod-bad`) and the hostname `eventhub-connect-<zone>-<stage>.swr.cn.ard.de`. Those names are SANs of the stage certificate. A bundle applied to the wrong machine stays Pending.

NixOS config for the same hosts is [`infra/nixos`](../nixos/README.md).

## Host ports

Container ports are the same on every stage. Host ports differ:

| Port                 | Container | Dev   | Test  | Prod |
| -------------------- | --------- | ----- | ----- | ---- |
| NATS cluster routes  | 6222      | 26222 | 16222 | 6222 |
| MQTT (TLS)           | 8883      | 28883 | 18883 | 8883 |
| NATS WebSocket (TLS) | 9222      | 29222 | 19222 | 9222 |
| Operator UI          | 4173      | 24173 | 14173 | 4173 |

NATS client (`4222`) and monitor (`8222`) stay in the cluster: `nats://nats.<namespace>.svc:4222`.

The NATS server name is the JetStream identity of its volume. Do not rename it on a running machine. Use a different `nats-route` password per stage.

## Deploy

Recipes take the kubeconfig from `keys/<host>-k3s-cert.yaml`. They never use the current context.

```sh
just k8s-build-dryrun
just k8s-diff eventhub-connect-bad
just k8s-diff eventhub-connect-bad eventhub-dev
just k8s-apply eventhub-connect-bad eventhub-dev
```

On a fresh machine apply `registry`, `observability`, then `eventhub-dev`, `eventhub-test`, `eventhub-prod`. Roll a NATS change one machine at a time and wait for `rollout status statefulset/nats` before the next.

`k8s-build-dryrun`, `k8s-diff`, and `k8s-apply` decrypt [`services/registry/passwd.sops.yaml`](services/registry/passwd.sops.yaml), [`components/registry-pull/secret.sops.yaml`](components/registry-pull/secret.sops.yaml), and [`services/nats/tls.sops.yaml`](services/nats/tls.sops.yaml), run kustomize, then delete the plaintext. The first is Secret `registry-htpasswd`. The second is Secret `registry` (pull auth for `registry.registry.svc:5000`) in `observability` and each stage namespace. The third is Secret `nats-tls`, a self-signed placeholder, in each stage namespace. All three plaintext files are gitignored.

`just k8s-apply` resets `nats-tls` to that placeholder. After the CA certificate is installed, remove `tls.yaml` from [`services/nats/kustomization.yaml`](services/nats/kustomization.yaml) or the next apply puts the placeholder back.

These Secrets are still created by hand. The pods wait for them.

| Namespace                        | Secret             | Keys                                         |
| -------------------------------- | ------------------ | -------------------------------------------- |
| `eventhub-dev`, `-test`, `-prod` | `nats-route`       | `password`, same value on all three machines |
| `eventhub-dev`, `-test`, `-prod` | `eventhub-connect` | `NATS_USER`, `NATS_PASSWORD`, `ARD_FEED_URL` |

The route password is part of a URL, so keep it URL-safe. Generate it once per stage and reuse that value on every machine.

`registry-htpasswd` is mounted as a subPath, so a password change does not roll the pod. Restart `deployment/registry` after a rotation.

## Registry

`just registry-local-setup` writes the zot credentials from `.env.docker.sops.yaml` into the local Docker config for every host in [`infra/nixos/hosts.toml`](../nixos/hosts.toml), so `crane`, `just registry-sync`, `just build-docker`, and `just build-container` can talk to `<server>:5000` directly.

`just registry-sync <host>` copies [`external-images.txt`](external-images.txt) into zot at `http://<server>:5000`. `<server>` is the number in [`infra/nixos/hosts.toml`](../nixos/hosts.toml). The upstream host is dropped on push, so pods pull `registry.registry.svc:5000/library/nats:2.14.6`. zot itself stays on ghcr.io.

`just build-docker` and `just build-container` build `eventhub-connect:<UTC timestamp>--v<package version>` from [`Dockerfile.connect`](../../Dockerfile.connect) once and push that tag to every host in [`infra/nixos/hosts.toml`](../nixos/hosts.toml). The connect image is still the placeholder tag in `environments/<stage>` until one is pinned.

NixOS writes `/etc/rancher/k3s/registries.yaml` so containerd pulls `registry.registry.svc:5000` from `http://127.0.0.1:5000`. Restart k3s after that file changes.

## Local development

No local cluster. `just nats-up` or `just nats-up-docker` runs one NATS from [`infra/nats/nats-dev.conf`](../nats/nats-dev.conf). `infra/nats/nats-users.conf` is a symlink to `services/nats/users/nats-users.conf`.
