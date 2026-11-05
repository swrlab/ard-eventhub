# Kubernetes

There are three machines, one per zone: `eventhub-connect-bad`, `eventhub-connect-stg`, and `eventhub-connect-mnz`. Each runs one NixOS config ([`infra/nixos`](../nixos/README.md)) and one single-node k3s cluster. Every machine holds a full dev, test, and prod deployment, one namespace per stage:

| Part            | Namespace       | What                                          |
| --------------- | --------------- | --------------------------------------------- |
| `registry`      | `registry`      | zot image registry, shared by all stages      |
| `observability` | `observability` | Vector and VictoriaLogs, shared by all stages |
| `eventhub-dev`  | `eventhub-dev`  | NATS and eventhub-connect for dev             |
| `eventhub-test` | `eventhub-test` | NATS and eventhub-connect for test            |
| `eventhub-prod` | `eventhub-prod` | NATS and eventhub-connect for prod            |

Kubernetes does not connect the machines. The three NATS servers of one stage, one per machine, route to each other over that stage's host ports.

## Layout

```text
infra/kubernetes/
├── services/              one base per workload, no namespace, no machine or stage values
│   ├── registry/base
│   ├── nats/base          StatefulSet, Services, shared nats.conf
│   ├── nats/users         nats-users.conf (Component)
│   ├── eventhub-connect/base
│   ├── vector/base
│   └── victoria-logs/base
├── platform/              per-machine services shared by all stages
│   ├── registry
│   └── observability
├── environments/          what one stage shares across machines
│   ├── shared             NetworkPolicies, included by every stage
│   ├── dev                namespace, host ports, routes, image
│   ├── test
│   └── prod
└── clusters/<host>/       what one machine runs; one subdirectory per part
    ├── registry
    ├── observability      machine and zone fields for Vector
    ├── eventhub-dev       NATS identity, advertise address, connect URLs
    ├── eventhub-test
    └── eventhub-prod
```

A value lives in the lowest layer that owns it. Bump an image in `services/`, a port in `environments/<stage>`, a hostname in `clusters/`. Do not copy whole manifests into a machine directory.

## Three stages on one machine

Container ports are the same everywhere. Each stage maps them to its own host ports:

| Port                 | Container | Dev   | Test  | Prod |
| -------------------- | --------- | ----- | ----- | ---- |
| NATS cluster routes  | 6222      | 26222 | 16222 | 6222 |
| MQTT (TLS)           | 8883      | 28883 | 18883 | 8883 |
| NATS WebSocket (TLS) | 9222      | 29222 | 19222 | 9222 |
| Operator UI          | 4173      | 24173 | 14173 | 4173 |

NATS client (`4222`) and monitor (`8222`) stay inside the cluster: `nats://nats.<namespace>.svc:4222`.

Each stage has its own NATS cluster name (`eventhub-dev`, `eventhub-test`, `eventhub-prod`), so a route pointed at the wrong port is rejected instead of merging two stages. Server names are `<stage>-<zone>` (`dev-bad`, `prod-mnz`). A server name is the JetStream identity of its volume; do not rename it on a running machine.

Routes, advertise addresses, and connect's `mqtts://` and `wss://` URLs use `eventhub-connect-<zone>-<stage>.swr.cn.ard.de`. Those names are SANs of the stage certificate ([Certificates](../../docs/development/certificates.md)). The three stage names of one machine resolve to the same IP.

### Access rules

Every stage namespace gets the policies in [`environments/shared/network-policies.yaml`](environments/shared/network-policies.yaml). k3s enforces them with its built-in kube-router controller.

- Everything is denied by default, in and out.
- Pods talk freely inside their own namespace.
- Egress to cluster DNS, and to anything outside the cluster (other machines, `ARD_FEED_URL`). Pod and Service IPs of other namespaces are excluded, so dev cannot reach a prod pod or Service.
- Ingress from anywhere on the stage's host ports: NATS cluster, MQTT, WebSocket, and the operator UI.

The host ports are public on purpose, because the other machines route to them. Any client that reaches the machine can reach them, including pods of another stage. NATS authentication is the guard there, and all stages still share one `nats-users.conf`.

The policies assume the k3s default pod and Service CIDRs (`10.42.0.0/16`, `10.43.0.0/16`). Update them if the NixOS k3s flags change those.

### How the NATS config is assembled

`services/nats/base/nats.conf` is shared. It takes the server name, cluster name, and advertise address as whole-value environment variables from ConfigMap `nats-zone` (NATS does not expand a variable inside a longer string). `environments/<stage>/routes.conf` is included inside its `cluster` block. Users come from `services/nats/users`. A change to any of these files changes the ConfigMap hash and rolls the pod.

## Deploy

All recipes take the host's kubeconfig from `keys/<host>-k3s-cert.yaml` ([`just/k3s.just`](../../just/k3s.just)), never the current context.

```sh
just k8s-build                                    # render every machine, no cluster needed
just k8s-diff eventhub-connect-bad                # whole machine
just k8s-diff eventhub-connect-bad eventhub-dev   # one part
just k8s-apply eventhub-connect-bad eventhub-dev
```

Order on a fresh machine: `registry`, `observability`, then `eventhub-dev`, `eventhub-test`, `eventhub-prod`. Promote a change through the stages in that order. Roll NATS changes one machine at a time and wait for `kubectl -n <namespace> rollout status statefulset/nats` before the next, so two of three stay in quorum.

The NATS pod has `nodeSelector: topology.kubernetes.io/zone: <zone>`. The NixOS host config sets that label. A bundle applied to the wrong machine stays Pending instead of joining with the wrong identity.

### Secrets

Nothing secret is committed. Create these after the namespace exists; the pods wait for them.

| Namespace                        | Secret              | Keys                                            |
| -------------------------------- | ------------------- | ----------------------------------------------- |
| `eventhub-dev`, `-test`, `-prod` | `nats-tls`          | `tls.crt`, `tls.key` (type `kubernetes.io/tls`) |
| `eventhub-dev`, `-test`, `-prod` | `eventhub-connect`  | `NATS_USER`, `NATS_PASSWORD`, `ARD_FEED_URL`    |
| `registry`                       | `registry-htpasswd` | `htpasswd` (bcrypt lines)                       |

The NATS password is in sops. All stages currently use the same `nats-users.conf`.

## Services

- **NATS**: one StatefulSet replica per stage per machine, 10Gi PVC on k3s `local-path`. MQTT streams use 3 replicas. `eventhub-connect` creates `INBOX` and `PLUGINS` without `num_replicas`, so those two streams stay at 1 replica until the code sets it. Three stages share one disk; JetStream is capped at 8G per server.
- **eventhub-connect**: one replica, `Recreate` because of the host port. The image is a placeholder (`environments/<stage>` `images:`); the repo `Dockerfile` starts ingest, so connect needs its own image with the built UI. Probes only check the TCP port, because the HTTP server is up before NATS and the feed are ready. `UI_ALLOW_CIDR` is not set yet, so the UI accepts every peer that reaches the host port.
- **registry**: zot with htpasswd auth and a 50Gi PVC. Only a ClusterIP Service so far. Exposure (ingress and TLS) and the k3s `registries.yaml` mirror config (NixOS) are still open. The registry image itself is pulled from ghcr.io, so the registry never depends on itself.
- **Vector**: DaemonSet that reads pod logs from `/var/log` and ships them to the local VictoriaLogs with `machine`, `zone`, and `k8s_*` fields. Filter by `k8s_namespace` to pick a stage. Checkpoints and a 256 MiB disk buffer live in `/var/lib/vector` on the host.
- **VictoriaLogs**: one replica, 20Gi PVC, 30 days retention, capped at 16GiB on disk. `local-path` does not enforce PVC sizes, so that cap is what keeps logs from filling the disk JetStream writes to. Size it from measured volume.

## Local development

There is no local Kubernetes overlay. Run a single NATS with `just nats-up` or `just nats-up-docker` ([`infra/nats/nats-dev.conf`](../nats/nats-dev.conf)). `services/nats/users/nats-users.conf` is the only users file. `infra/nats/nats-users.conf` is a symlink to it, so the local `include` resolves next to `nats-dev.conf`.
