# Kubernetes bundles under infra/kubernetes/clusters/<host>. Hosts are the friendly names from
# infra/nixos/hosts, and every recipe passes that host's kubeconfig (keys/<host>-k3s-cert.yaml)
# explicitly instead of trusting the current context. A part (registry, observability,
# eventhub-dev, eventhub-test, eventhub-prod) selects objects by label app.kubernetes.io/instance.
# Each recipe decrypts the sops files kustomize reads, runs kustomize, then deletes the plaintext.

K8S := source_directory() / '../infra/kubernetes'
PASSWD := K8S / 'services/registry/passwd.yaml'
PULL_SECRET := K8S / 'components/registry-pull/secret.yaml'
NATS_TLS := K8S / 'services/nats/tls.yaml'

# Decrypt sops files into gitignored files kustomize reads.
_k8s-decrypt:
	just --yes decrypt-key {{ K8S / 'services/registry/passwd.sops.yaml' }}
	just --yes decrypt-key {{ K8S / 'components/registry-pull/secret.sops.yaml' }}
	just --yes decrypt-key {{ K8S / 'services/nats/tls.sops.yaml' }}

_k8s-clean:
	rm -f {{ quote(PASSWD) }} {{ quote(PULL_SECRET) }} {{ quote(NATS_TLS) }}

# render every machine bundle (no cluster required)
[group('K3S')]
k8s-build-dryrun:
	#!/usr/bin/env bash
	set -euo pipefail
	trap 'just _k8s-clean' EXIT
	just _k8s-decrypt
	export KUBECONFIG=/dev/null
	for dir in "{{ K8S }}"/clusters/*/; do
		kubectl kustomize "$dir" >/dev/null
		echo "ok $(basename "$dir")"
	done

# show what applying a host bundle would change (part: registry, observability, eventhub-dev, eventhub-test, eventhub-prod)
[group('K3S')]
k8s-diff host part='':
	#!/usr/bin/env bash
	set -uo pipefail
	trap 'just _k8s-clean' EXIT
	just _k8s-decrypt || exit $?
	kubeconfig={{ quote('keys/' + host + '-k3s-cert.yaml') }}
	part={{ quote(part) }}
	kubectl --kubeconfig "$kubeconfig" diff \
		-k {{ quote(K8S / 'clusters' / host) }} {{ if part == '' { '' } else { '-l app.kubernetes.io/instance=' + quote(part) } }}
	diff_status=$?
	# kubectl diff exits 1 when there are differences, >1 on errors.
	if [[ $diff_status -gt 1 ]]; then exit $diff_status; fi
	if [[ $diff_status -eq 1 ]]; then exit 1; fi

# apply a host bundle, or one part of it (registry, observability, eventhub-dev, eventhub-test, eventhub-prod)
[confirm('Apply to this host? Type yes...')]
[group('K3S')]
k8s-apply host part='':
	#!/usr/bin/env bash
	set -euo pipefail
	trap 'just _k8s-clean' EXIT
	just _k8s-decrypt
	kubeconfig={{ quote('keys/' + host + '-k3s-cert.yaml') }}
	part={{ quote(part) }}
	kubectl --kubeconfig "$kubeconfig" apply \
		-k {{ quote(K8S / 'clusters' / host) }} {{ if part == '' { '' } else { '-l app.kubernetes.io/instance=' + quote(part) } }}

# install a CA leaf as Secret nats-tls and restart NATS (stage: dev, test, prod; cert defaults to tls.crt)
# the key is .local/certs/<stage>/eventhub-connect-<stage>.key from just csr
[confirm('Replace nats-tls on this host? Type yes...')]
[group('K3S')]
k8s-tls host stage cert='tls.crt':
	#!/usr/bin/env bash
	set -euo pipefail
	stage={{ quote(stage) }}
	cert={{ quote(cert) }}
	case "$stage" in
		dev|test|prod) ;;
		*)
			echo "stage must be dev, test, or prod" >&2
			exit 1
			;;
	esac
	key={{ quote(source_directory() / '../.local/certs') }}/"$stage/eventhub-connect-$stage.key"
	if [[ ! -f "$cert" ]]; then
		echo "certificate not found: $cert" >&2
		exit 1
	fi
	if [[ ! -f "$key" ]]; then
		echo "key not found: $key" >&2
		exit 1
	fi
	kubeconfig={{ quote('keys/' + host + '-k3s-cert.yaml') }}
	ns="eventhub-$stage"
	kubectl --kubeconfig "$kubeconfig" -n "$ns" create secret tls nats-tls \
		--cert="$cert" \
		--key="$key" \
		--dry-run=client -o yaml \
		| kubectl --kubeconfig "$kubeconfig" apply -f -
	kubectl --kubeconfig "$kubeconfig" -n "$ns" rollout restart statefulset/nats
	kubectl --kubeconfig "$kubeconfig" -n "$ns" rollout status statefulset/nats
