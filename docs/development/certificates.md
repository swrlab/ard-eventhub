---
title: 'Certificates'
description: 'Generate the connect CSR, store the certificate in sops, and roll it out to each k3s machine.'
sidebar:
  icon: certificate
---

One certificate per stage covers all three machines. Dev, test, and prod run side by side on each machine: MQTT (`:28883` dev, `:18883` test, `:8883` prod) and the NATS WebSocket (`:29222` dev, `:19222` test, `:9222` prod) present that stage's certificate. Connect dials those ports by the `eventhub-connect-<zone>-<env>.swr.cn.ard.de` names, so they must stay on the certificate. Cluster routes (`:26222` dev, `:16222` test, `:6222` prod) are plaintext and authenticate with the stage route password (Secret `nats-route`, see [`infra/kubernetes/README.md`](https://github.com/swrlab/ard-eventhub/blob/main/infra/kubernetes/README.md)).

Each machine is one k3s cluster. Every stage gets the Secret `eventhub-tls` in its own namespace (`eventhub-dev`, `eventhub-test`, `eventhub-prod`).

## Generate

`dev`, `test`, and `prod` use the same command. `just csr prod` emits hostnames with `-prod` in them.

```sh
just csr dev
```

That writes three files under `.local/certs/dev/`. The directory is gitignored.

- `eventhub-connect-dev.csr` goes to the ARD CN CA
- `eventhub-connect-dev.key` stays on this machine, mode `600`
- `eventhub-connect-dev.cnf` is the OpenSSL config behind the request

The subject is `C=DE, O=SWR`, and the common name is `eventhub-connect-bad-<env>.swr.cn.ard.de`. The key is RSA 4096. Extended key usage is server auth.

Subject alternative names, in this order:

- `eventhub-connect-bad-<env>.swr.cn.ard.de`
- `eventhub-connect-mnz-<env>.swr.cn.ard.de`
- `eventhub-connect-stg-<env>.swr.cn.ard.de`
- `eventhub-connect-bad-<env>.swr.ard`
- `eventhub-connect-mnz-<env>.swr.ard`
- `eventhub-connect-stg-<env>.swr.ard`

The command prints the subject, the names, and the PEM. A second run stops when the key already exists. `just csr dev --force` replaces it, and a CSR already sent to the CA no longer matches.

Read the request back before sending it:

```sh
openssl req -in .local/certs/dev/eventhub-connect-dev.csr -noout -text
```

## Place on k3s

The CA returns a signed leaf. `tls.crt` is that leaf in PEM, with any intermediates the CA sent appended under it. A DER file (often `.cer`) converts with:

```sh
openssl x509 -inform DER -in leaf.cer -out tls.crt
```

A PEM leaf is already `tls.crt`. Append a separate chain after it:

```sh
cat chain.pem >> tls.crt
```

The key is `.local/certs/<env>/eventhub-connect-<env>.key`. A later `just csr --force` produces a different key, and this certificate will not match it.

`just tls-store` checks that the certificate was signed for that key, has not expired, lists the three `eventhub-connect-<zone>-<env>.swr.ard` names, and chains to `Rundfunk-Root-CA-2015`. It stores the leaf followed by the intermediates `SWR IMP-IIS CA` and `SWR-CA`, whatever chain the CA sent. It downloads root and intermediates from `ARD_CA_ROOT_URL` and `ARD_CA_CHAIN_URLS` in `.env.k3s.sops.yaml` and refuses a root that does not match `ARD_CA_ROOT_SHA256`. Every server then sends the full chain, and clients only need the root. Then it writes certificate and key into [`environments/<env>/tls.sops.yaml`](https://github.com/swrlab/ard-eventhub/tree/main/infra/kubernetes/environments) as Secret `eventhub-tls`. For dev it also writes Secret `registry-tls` ([`services/registry/tls.sops.yaml`](https://github.com/swrlab/ard-eventhub/blob/main/infra/kubernetes/services/registry/tls.sops.yaml)) and Secret `beszel-tls` ([`services/beszel/hub/tls.sops.yaml`](https://github.com/swrlab/ard-eventhub/blob/main/infra/kubernetes/services/beszel/hub/tls.sops.yaml)), because the registry on `:5000` and the Beszel hub on `:8081` answer as `eventhub-connect-<zone>-dev.swr.ard`. Nothing touches a cluster. Commit the sops files with the change that needs them.

Until then each file holds a self-signed placeholder with every stage hostname, so the pods start while the CA request is open. Clients that check the trust store reject it.

## Roll out

`just k8s-apply` puts the Secret on a machine. Traefik serves it for the operator UI on `:443`, the registry on `:5000`, and Beszel on `:8081`, and reloads it on its own. NATS mounts it at `/etc/nats/tls` and reads it only at start, so restart NATS after the apply. Connect dials its own MQTT and WebSocket names with TLS and trusts the root through `NODE_EXTRA_CA_CERTS`. One machine at a time, so the other two keep quorum:

```sh
just tls-store test tls.crt
just k8s-apply bad eventhub-test
kubectl --kubeconfig keys/eventhub-connect-bad-k3s-cert.yaml -n eventhub-test rollout restart statefulset/nats
```

Wait for `rollout status statefulset/nats`, then repeat the last two lines for `stg` and `mnz`. A replacement certificate takes the same steps.
