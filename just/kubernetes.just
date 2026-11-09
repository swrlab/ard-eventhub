# Kubernetes bundles under infra/kubernetes/clusters/<host>. Hosts are the friendly names from
# infra/nixos/hosts, and every recipe passes that host's kubeconfig (keys/<host>-k3s-cert.yaml)
# explicitly instead of trusting the current context. A part (registry, observability,
# eventhub-dev, eventhub-test, eventhub-prod) selects objects by label app.kubernetes.io/instance.
# Each recipe decrypts the registry sops files, runs kustomize, then deletes the plaintext.

K8S := source_directory() / '../infra/kubernetes'
PASSWD := K8S / 'services/registry/passwd.yaml'
PULL_SECRET := K8S / 'components/registry-pull/secret.yaml'

# Decrypt registry secrets into gitignored files kustomize reads.
_k8s-decrypt:
	umask 077 && sops --decrypt --output {{ quote(PASSWD) }} {{ quote(K8S / 'services/registry/passwd.sops.yaml') }}
	umask 077 && sops --decrypt --output {{ quote(PULL_SECRET) }} {{ quote(K8S / 'components/registry-pull/secret.sops.yaml') }}

_k8s-clean:
	rm -f {{ quote(PASSWD) }} {{ quote(PULL_SECRET) }}

# render every machine bundle (no cluster required)
[group('K3S')]
k8s-build:
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
