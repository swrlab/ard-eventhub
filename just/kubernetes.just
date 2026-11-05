# Kubernetes bundles under infra/kubernetes/clusters/<host>. Hosts are the friendly names from
# infra/nixos/hosts, and every recipe passes that host's kubeconfig (keys/<host>-k3s-cert.yaml)
# explicitly instead of trusting the current context.

K8S := source_directory() / '../infra/kubernetes'

# render every machine bundle (no cluster required)
[group('K3S')]
k8s-build:
	#!/usr/bin/env bash
	set -euo pipefail
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
	kubectl --kubeconfig {{ quote('keys/' + host + '-k3s-cert.yaml') }} diff \
		-k {{ quote(K8S / 'clusters' / host / part) }}
	status=$?
	# kubectl diff exits 1 when there are differences, >1 on errors.
	if [[ $status -gt 1 ]]; then exit $status; fi

# apply a host bundle, or one part of it (registry, observability, eventhub-dev, eventhub-test, eventhub-prod)
[confirm('Apply to this host? Type yes...')]
[group('K3S')]
k8s-apply host part='':
	kubectl --kubeconfig {{ quote('keys/' + host + '-k3s-cert.yaml') }} apply \
		-k {{ quote(K8S / 'clusters' / host / part) }}
