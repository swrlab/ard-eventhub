---
title: 'Certificates'
description: 'Generate the connect CSR and install it as nats-tls on each k3s machine.'
sidebar:
  icon: certificate
---

One certificate per stage covers all three machines. Dev, test, and prod run side by side on each machine: MQTT (`:28883` dev, `:18883` test, `:8883` prod) and the NATS WebSocket (`:29222` dev, `:19222` test, `:9222` prod) present that stage's certificate. Connect dials those ports by the `eventhub-connect-<zone>-<env>.swr.cn.ard.de` names, so they must stay on the certificate. Cluster routes (`:26222` dev, `:16222` test, `:6222` prod) are plaintext.

Each machine is one k3s cluster. Every stage needs the secret `nats-tls` in its own namespace (`eventhub-dev`, `eventhub-test`, `eventhub-prod`).

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

Each machine is its own cluster. The same `tls.crt` and the same key go on all three. The secret name is `nats-tls`. The pod mounts it at `/etc/nats/tls`, and `nats.conf` reads `tls.crt` and `tls.key` from there.

The commands below are test on Baden-Baden. Dev and prod work the same way with their own namespace and bundle part (`eventhub-dev`, `eventhub-prod`) and key (`.local/certs/dev/eventhub-connect-dev.key`, `.local/certs/prod/eventhub-connect-prod.key`).

Apply the bundle part first so the namespace exists, then create the secret. Until it exists, the pod stays in `CreateContainerConfigError`; the server image has no shell. It starts on its own once the secret is there.

```sh
just k8s-apply eventhub-connect-bad eventhub-test

kubectl --kubeconfig keys/eventhub-connect-bad-k3s-cert.yaml \
  -n eventhub-test create secret tls nats-tls \
  --cert=tls.crt \
  --key=.local/certs/test/eventhub-connect-test.key

kubectl --kubeconfig keys/eventhub-connect-bad-k3s-cert.yaml \
  -n eventhub-test rollout status statefulset/nats
```

Repeat on `eventhub-connect-stg`, then `eventhub-connect-mnz`. Same files, same secret name. One machine at a time, so the other two keep quorum.

## Replace a certificate

NATS reads the files at process start. Update the secret, then restart that machine's pod. Do one machine, wait until it is Ready, then the next.

```sh
kubectl -n eventhub-test create secret tls nats-tls \
  --cert=tls.crt \
  --key=.local/certs/test/eventhub-connect-test.key \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl -n eventhub-test rollout restart statefulset/nats
kubectl -n eventhub-test rollout status statefulset/nats
```
