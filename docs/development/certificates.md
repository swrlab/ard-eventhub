---
title: 'Certificates'
description: 'Generate the connect CSR and install it on each k3s machine.'
sidebar:
  icon: certificate
---

One certificate per stage covers all three machines. Dev, test, and prod run side by side on each machine: MQTT (`:28883` dev, `:18883` test, `:8883` prod) and the NATS WebSocket (`:29222` dev, `:19222` test, `:9222` prod) present that stage's certificate. Connect dials those ports by the `eventhub-connect-<zone>-<env>.swr.cn.ard.de` names, so they must stay on the certificate. Cluster routes (`:26222` dev, `:16222` test, `:6222` prod) are plaintext and authenticate with the stage route password (Secret `nats-route`, see [`infra/kubernetes/README.md`](https://github.com/swrlab/ard-eventhub/blob/main/infra/kubernetes/README.md)).

Each machine is one k3s cluster. Every stage needs the secret `eventhub-tls` in its own namespace (`eventhub-dev`, `eventhub-test`, `eventhub-prod`).

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

The key in the secret is `.local/certs/<env>/eventhub-connect-<env>.key`. A later `just csr --force` produces a different key, and this certificate will not match it.

Confirm the pair and the names. The two hashes are equal when the certificate was signed from this key.

```sh
openssl x509 -in tls.crt -noout -pubkey | openssl sha256
openssl pkey -in .local/certs/dev/eventhub-connect-dev.key -pubout | openssl sha256
openssl x509 -in tls.crt -noout -ext subjectAltName
```

Each machine is its own cluster. The same `tls.crt` and the same key go on all three. The secret name is `eventhub-tls`. The pod mounts it at `/etc/nats/tls`, and `nats.conf` reads `tls.crt` and `tls.key` from there. Traefik serves the same Secret for the operator UI on `:443` and reloads it without a restart. For dev, `just k8s-tls` also writes it as `registry-tls` in namespace `registry`, because the registry on `:5000` answers as `eventhub-connect-<zone>-dev.swr.ard`.

The bundle already creates `eventhub-tls` from [`tls.sops.yaml`](https://github.com/swrlab/ard-eventhub/blob/main/infra/kubernetes/environments/shared/tls.sops.yaml). That certificate is self-signed, valid for one year, and lists every stage hostname, so the pod can start while the CA request is open. Clients that check the trust store will reject it. `just k8s-apply` writes this placeholder back over whatever is in the cluster.

The commands below are test on Baden-Baden. Dev and prod work the same way with their own namespace and bundle part (`eventhub-dev`, `eventhub-prod`) and key (`.local/certs/dev/eventhub-connect-dev.key`, `.local/certs/prod/eventhub-connect-prod.key`).

Remove `tls.yaml` from [`environments/shared/kustomization.yaml`](https://github.com/swrlab/ard-eventhub/blob/main/infra/kubernetes/environments/shared/kustomization.yaml) before installing the CA certificate, or the next `just k8s-apply` puts the placeholder back. Apply the bundle part so the namespace exists, then install the leaf. NATS reads the files at process start. `just k8s-tls` writes Secret `eventhub-tls` and restarts that machine's pod.

```sh
just k8s-apply eventhub-connect-bad eventhub-test
just k8s-tls eventhub-connect-bad test tls.crt
```

Repeat on `eventhub-connect-stg`, then `eventhub-connect-mnz`. Same leaf, same key. One machine at a time, so the other two keep quorum.

## Replace a certificate

`just k8s-tls` replaces an existing secret and waits until the pod is Ready. Do one machine, then the next.

```sh
just k8s-tls eventhub-connect-bad test tls.crt
```
