---
title: 'Certificates'
description: 'Generate the connect CSR and install it as nats-tls on each k3s zone.'
sidebar:
  order: 13
---

One certificate per environment covers all three zones. MQTT `:8883` and the NATS WebSocket `:9222` present it. Cluster routes on `:6222` are plaintext, so the short names `connect-bad`, `connect-stg`, and `connect-mnz` are not on the certificate.

The lab overlay `overlays/dev` (`just nats-k8s-dev`) serves MQTT in plaintext and does not mount a TLS secret. Test and prod do: one k3s cluster per zone, secret `nats-tls`.

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

Each zone is its own cluster. The same `tls.crt` and the same key go on all three. The secret name is `nats-tls`. The pod mounts it at `/etc/nats/tls`, and `nats.conf` reads `tls.crt` and `tls.key` from there.

The commands below are test. Prod uses namespace `eventhub-prod`, `overlays/prod/<zone>`, and `.local/certs/prod/eventhub-connect-prod.key`. A CN dev cluster uses namespace `eventhub-dev` and `.local/certs/dev/eventhub-connect-dev.key` the same way. The lab overlay `overlays/dev` is a different cluster and does not take this secret.

Create the secret before the pod is expected to become Ready. A missing mount stays in `CreateContainerConfigError`. The server image has no shell.

Point kubectl at the Baden-Baden cluster, then:

```sh
kubectl -n eventhub-test create secret tls nats-tls \
  --cert=tls.crt \
  --key=.local/certs/test/eventhub-connect-test.key

kubectl apply -k infra/kubernetes/overlays/test/bad
kubectl -n eventhub-test rollout status statefulset/nats
```

Repeat with kubectl aimed at Stuttgart (`overlays/test/stg`), then Mainz (`overlays/test/mnz`). Same files, same secret name. One zone at a time, so the other two keep quorum.

Prod is the same sequence under `overlays/prod/<zone>` in namespace `eventhub-prod`, with `.local/certs/prod/eventhub-connect-prod.key`.

## Replace a certificate

NATS reads the files at process start. Update the secret, then restart that zone's pod. Do one zone, wait until it is Ready, then the next.

```sh
kubectl -n eventhub-test create secret tls nats-tls \
  --cert=tls.crt \
  --key=.local/certs/test/eventhub-connect-test.key \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl -n eventhub-test rollout restart statefulset/nats
kubectl -n eventhub-test rollout status statefulset/nats
```
