# NATS on Kubernetes

Dev runs all three NATS nodes in one cluster. Test and prod use one config per zone, applied on that zone. Every environment uses [`components/users/nats-users.conf`](components/users/nats-users.conf) (password `local`).

Image pin matches `just nats-up-docker`: `nats:2.14.6`.

## Dev

Three pods (`nats-0`, `nats-1`, `nats-2`) in `eventhub-dev`. They cluster on `nats-<n>.nats-headless.eventhub-dev.svc.cluster.local:6222`. That record exists only because `nats-headless` is headless. Each pod advertises the same name: the kubelet builds `CLUSTER_ADVERTISE` from the pod name, because NATS will not expand `$SERVER_NAME` inside a longer string. There is no hostname anti-affinity, so a single node can run all three. MQTT is plaintext `:1883`. Users are the committed file (password `local`). JetStream data is an `emptyDir` and dies with the pod.

```sh
just nats-k8s-dev
```

The same thing by hand:

```sh
kubectl apply -k infra/kubernetes/overlays/dev
kubectl -n eventhub-dev rollout status statefulset/nats
```

`components/users/nats-users.conf` is the only users file. `infra/nats/nats-users.conf` is a symlink to it, so the local `include` resolves next to `nats-dev.conf`.

Docker Desktop and a local k3s publish NodePorts on the machine. The service spreads connections across the three pods.

- NATS `nats://127.0.0.1:30422` (`svc-sidecar` / `local`)
- MQTT `mqtt://127.0.0.1:30183`
- monitor `http://127.0.0.1:30822`

`kind` does not open NodePorts on the host unless the cluster was created with those mappings. This reaches the same ports without that:

```sh
kubectl -n eventhub-dev port-forward svc/nats 4222:4222 1883:1883 8222:8222
```

```sh
just nats-k8s-dev-down
```

## Test and prod

Each zone is its own apply, on that zone's cluster. The NATS config is shared by test and prod (`zones/bad`, `zones/stg`, `zones/mnz`), and so are the users. The overlay only sets the namespace (`eventhub-test` or `eventhub-prod`).

```sh
kubectl apply -k infra/kubernetes/overlays/test/bad
kubectl apply -k infra/kubernetes/overlays/test/stg
kubectl apply -k infra/kubernetes/overlays/test/mnz
```

Prod is the same paths under `overlays/prod/`, with that environment's certificate. The TLS secret name is `nats-tls` in the namespace.

```sh
kubectl -n eventhub-test create secret tls nats-tls \
  --cert=tls.crt --key=tls.key
```

Create the secret before expecting the pod to become Ready. The server image has no shell, so a missing mount sits in `CreateContainerConfigError` until the secret exists.

One pod per zone, pinned with `nodeSelector: topology.kubernetes.io/zone` (`bad`, `stg`, or `mnz`). Label the node before apply:

```sh
kubectl label node <name> topology.kubernetes.io/zone=bad
```

`server_name` is `connect-bad`, `connect-stg`, or `connect-mnz`. Cluster routes and `advertise` use those names on `:6222`, which is a hostPort, so the other zones dial the node rather than a pod IP. The three names have to resolve to that environment's nodes. Test and prod can use the same names because each environment has its own DNS. MQTT listens on host `:8883` with TLS. The certificate has to cover all three names. Use pod security `baseline` or `privileged` so the hostPorts are admitted.

In-cluster NATS clients use `nats://nats.<namespace>.svc:4222`.

Apply one zone at a time. A bad config then costs one node while clients fail over. Quorum stays at 2 of 3.

A change to `nats.conf` or `nats-users.conf` rolls that zone's pod because the configmap name hash changes.

Render without applying:

```sh
just nats-k8s-build
```

## Not in this tree

TLS material and a local registry mirror. `eventhub-connect` creates the `INBOX` and `PLUGINS` streams when it connects, and that code does not set `num_replicas` yet, so those two streams land at 1 until it does. MQTT's own streams are pinned to 3.
