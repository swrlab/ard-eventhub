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
├── external-images.txt    upstream images copied into the per-machine zot
├── services/              one directory per workload, no machine or stage values
│   ├── registry           namespace registry, ready to apply
│   ├── observability      namespace observability: vector, victoria-logs
│   ├── nats               StatefulSet, Services, shared nats.conf; users/ holds nats-users.conf
│   └── eventhub-connect
├── environments/          one stage, the same on every machine
│   ├── shared             namespace, NetworkPolicies, NATS, connect, host-port wiring (Component)
│   ├── dev                namespace name, ConfigMap eventhub-stage (STAGE, PORT_*), image tag
│   ├── test
│   └── prod
└── clusters/<host>/       one file: everything the machine runs, plus its zone
```

Each value is written once. An image or probe goes in `services/`, a stage's ports in `environments/<stage>`, a machine's zone in `clusters/<host>`. Everything else derives from `STAGE`, `ZONE`, and `PORT_*` through Kubernetes `$(VAR)` expansion in the workload env:

| Value                                  | Built as                                                        |
| -------------------------------------- | --------------------------------------------------------------- |
| NATS server name                       | `$(STAGE)-$(ZONE)` (`prod-bad`)                                 |
| NATS cluster name                      | `eventhub-$(STAGE)`                                             |
| Public hostname                        | `eventhub-connect-$(ZONE)-$(STAGE).swr.cn.ard.de`               |
| Advertise address, routes              | public hostname and `$(PORT_CLUSTER)`                           |
| Connect `NATS_MQTT_URL`, `NATS_WS_URL` | public hostname and `$(PORT_MQTT)`, `$(PORT_WS)`                |
| Host ports                             | `PORT_*`, copied into the pod specs by kustomize `replacements` |

`clusters/<host>` patches `ZONE` and the zone `nodeSelector` into NATS and connect. The bases default both to `unset`, so a workload without a machine layer stays Pending. Registry and observability have no machine values: Vector reads the zone from the node label and names the machine `eventhub-connect-<zone>`.

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

The host ports are public on purpose, because the other machines route to them. Any client that reaches the machine can reach them, including pods of another stage. Authentication is the guard there:

- The cluster port accepts only routes that present user `eventhub-route` and the stage's route password (Secret `nats-route`). Use a different password per stage. Routes are plaintext, so the password crosses the network unencrypted.
- MQTT and WebSocket accept the users in `nats-users.conf`. All stages still share that file.

The policies assume the k3s default pod and Service CIDRs (`10.42.0.0/16`, `10.43.0.0/16`). Update them if the NixOS k3s flags change those.

### How the NATS config is assembled

`services/nats/nats.conf` is shared. It takes the server name, cluster name, advertise address, and routes as whole-value environment variables, because NATS does not expand a variable inside a longer string. The StatefulSet env builds them (see the table above). Each route URL carries the credentials: `nats://eventhub-route:$(NATS_ROUTE_PASSWORD)@eventhub-connect-<zone>-$(STAGE).swr.cn.ard.de:$(PORT_CLUSTER)`. Users come from `services/nats/users`. A change to `nats.conf`, the users file, or ConfigMap `eventhub-stage` changes a ConfigMap hash and rolls the pod. Changing the `nats-route` Secret does not; restart the StatefulSet on all three machines after a rotation.

## Deploy

All recipes take the host's kubeconfig from `keys/<host>-k3s-cert.yaml` ([`just/k3s.just`](../../just/k3s.just)), never the current context. A part renders the whole machine and keeps the objects labelled `app.kubernetes.io/instance=<part>`.

```sh
just k8s-build                                    # render every machine, no cluster needed
just k8s-diff eventhub-connect-bad                # whole machine
just k8s-diff eventhub-connect-bad eventhub-dev   # one part
just k8s-apply eventhub-connect-bad eventhub-dev
```

Order on a fresh machine: `registry`, `observability`, then `eventhub-dev`, `eventhub-test`, `eventhub-prod`. Promote a change through the stages in that order. Roll NATS changes one machine at a time and wait for `kubectl -n <namespace> rollout status statefulset/nats` before the next, so two of three stay in quorum.

NATS and connect have `nodeSelector: topology.kubernetes.io/zone: <zone>`. The NixOS host config sets that label. A bundle applied to the wrong machine stays Pending instead of joining with the wrong identity.

### Secrets

Nothing secret is committed. Create these after the namespace exists; the pods wait for them.

| Namespace                        | Secret              | Keys                                            |
| -------------------------------- | ------------------- | ----------------------------------------------- |
| `eventhub-dev`, `-test`, `-prod` | `nats-tls`          | `tls.crt`, `tls.key` (type `kubernetes.io/tls`) |
| `eventhub-dev`, `-test`, `-prod` | `nats-route`        | `password` (same on all three machines)         |
| `eventhub-dev`, `-test`, `-prod` | `eventhub-connect`  | `NATS_USER`, `NATS_PASSWORD`, `ARD_FEED_URL`    |
| `registry`                       | `registry-htpasswd` | `htpasswd` (bcrypt lines)                       |

The NATS password is in sops. All stages currently use the same `nats-users.conf`.

The route password goes into a URL, so keep it URL-safe. Generate one per stage and create it on every machine:

```sh
kubectl --kubeconfig keys/<host>-k3s-cert.yaml -n eventhub-prod create secret generic nats-route \
  --from-literal=password="$(openssl rand -hex 32)"
```

Run `openssl rand` once per stage and reuse its output on all three machines. A server with a different password cannot route to the others.

## Services

- **NATS**: one StatefulSet replica per stage per machine, 10Gi PVC on k3s `local-path`. MQTT streams use 3 replicas. `eventhub-connect` creates `INBOX` and `PLUGINS` without `num_replicas`, so those two streams stay at 1 replica until the code sets it. Three stages share one disk; JetStream is capped at 8G per server.
- **eventhub-connect**: one replica, `Recreate` because of the host port. The image is a placeholder (`images:` in `environments/<stage>`); the repo `Dockerfile` starts ingest, so connect needs its own image with the built UI. Probes only check the TCP port, because the HTTP server is up before NATS and the feed are ready. `UI_ALLOW_CIDR` is not set yet, so the UI accepts every peer that reaches the host port.
- **registry**: zot with htpasswd auth and a 50Gi PVC. A LoadBalancer Service publishes port 5000 on the node (k3s ServiceLB). It is plain HTTP. The registry image itself is pulled from ghcr.io, so the registry never depends on itself. The k3s `registries.yaml` mirror config (NixOS) is still open. See [Registry access](#registry-access).
- **Vector**: DaemonSet that reads pod logs from `/var/log` and ships them to the local VictoriaLogs with `machine`, `zone`, and `k8s_*` fields. `zone` is the node label `topology.kubernetes.io/zone`; `machine` is `eventhub-connect-<zone>`. Filter by `k8s_namespace` to pick a stage. Checkpoints and a 256 MiB disk buffer live in `/var/lib/vector` on the host.
- **VictoriaLogs**: one replica, 20Gi PVC, 30 days retention. `local-path` does not enforce PVC sizes. `-retention.maxDiskSpaceUsageBytes=16GiB` drops the oldest daily partitions above 16GiB, but always keeps the last two days, so it is a target, not a cap. The hard stop is `-storage.minFreeDiskSpaceBytes=32GiB`: once the host disk has less free space than that, VictoriaLogs stops accepting logs (Vector buffers 256 MiB, then blocks) and the rest stays for JetStream. On a disk smaller than about 60GB logs stop early. Size both from measured volume.

## Registry access

Both recipes use `http://<server>:5000`. `<server>` is the server number in [`infra/nixos/hosts`](../nixos/hosts) (`s0006669` for `eventhub-connect-bad`). Apply the registry part first so the LoadBalancer is up: `just k8s-apply <host> registry`. `sops exec-env` loads `REGISTRY_USER` and `REGISTRY_PASSWORD` from [`.env.docker.sops.yaml`](../../.env.docker.sops.yaml). That pair is what was hashed into Secret `registry-htpasswd`.

`just registry-sync <host>` copies [`external-images.txt`](external-images.txt) with `crane copy`. The upstream registry host is dropped, so `docker.io/library/nats:2.14.6` is stored as `library/nats:2.14.6`. A tag already present with the same digest is skipped. zot itself is not in the list.

`just build-docker <host>` and `just build-container <host>` build the same ingest image (`linux/arm64` and `linux/amd64`) and push `ingest:<UTC timestamp>--v<package version>`. One uses Docker buildx, the other the Apple `container` CLI. The image starts ingest (`bun run start`). eventhub-connect still needs its own image with the built UI.

```sh
just registry-sync eventhub-connect-bad
just build-docker eventhub-connect-bad
just build-container eventhub-connect-bad
```

Workloads still name the upstream image. k3s pulls from zot once the NixOS `registries.yaml` mirror exists.

## Local development

There is no local Kubernetes overlay. Run a single NATS with `just nats-up` or `just nats-up-docker` ([`infra/nats/nats-dev.conf`](../nats/nats-dev.conf)). `services/nats/users/nats-users.conf` is the only users file. `infra/nats/nats-users.conf` is a symlink to it, so the local `include` resolves next to `nats-dev.conf`.
