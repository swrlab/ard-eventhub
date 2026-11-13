# Kubernetes bundles under infra/kubernetes/clusters/<host>. Hosts are the friendly names or aliases
# from infra/nixos/hosts.toml, and every recipe passes that host's kubeconfig (keys/<host>-k3s-cert.yaml)
# explicitly instead of trusting the current context. A part (traefik, registry, observability, beszel,
# eventhub-dev, eventhub-test, eventhub-prod) selects objects by label app.kubernetes.io/instance.
# Each recipe decrypts the sops files kustomize reads, downloads the ARD root CA, runs kustomize, then
# deletes both.

K8S := source_directory() / '../infra/kubernetes'
PASSWD := K8S / 'services/registry/passwd.yaml'
PULL_SECRET := K8S / 'components/registry-pull/secret.yaml'
REGISTRY_TLS := K8S / 'services/registry/tls.yaml'
NATS_ROUTE_DEV := K8S / 'environments/dev/nats-route.yaml'
NATS_ROUTE_TEST := K8S / 'environments/test/nats-route.yaml'
NATS_ROUTE_PROD := K8S / 'environments/prod/nats-route.yaml'
TLS_DEV := K8S / 'environments/dev/tls.yaml'
TLS_TEST := K8S / 'environments/test/tls.yaml'
TLS_PROD := K8S / 'environments/prod/tls.yaml'
CONNECT_DEV := K8S / 'environments/dev/connect.yaml'
CONNECT_TEST := K8S / 'environments/test/connect.yaml'
CONNECT_PROD := K8S / 'environments/prod/connect.yaml'
BESZEL_HUB := K8S / 'services/beszel/hub/secret.yaml'
BESZEL_TLS := K8S / 'services/beszel/hub/tls.yaml'
ARD_CA := K8S / 'components/ard-ca'

# decrypt sops files into gitignored files kustomize reads
_k8s-decrypt:
	just --yes decrypt-key {{ K8S / 'services/registry/passwd.sops.yaml' }}
	just --yes decrypt-key {{ K8S / 'components/registry-pull/secret.sops.yaml' }}
	just --yes decrypt-key {{ K8S / 'services/registry/tls.sops.yaml' }}
	just --yes decrypt-key {{ K8S / 'environments/dev/nats-route.sops.yaml' }}
	just --yes decrypt-key {{ K8S / 'environments/test/nats-route.sops.yaml' }}
	just --yes decrypt-key {{ K8S / 'environments/prod/nats-route.sops.yaml' }}
	just --yes decrypt-key {{ K8S / 'environments/dev/tls.sops.yaml' }}
	just --yes decrypt-key {{ K8S / 'environments/test/tls.sops.yaml' }}
	just --yes decrypt-key {{ K8S / 'environments/prod/tls.sops.yaml' }}
	just --yes decrypt-key {{ K8S / 'environments/dev/connect.sops.yaml' }}
	just --yes decrypt-key {{ K8S / 'environments/test/connect.sops.yaml' }}
	just --yes decrypt-key {{ K8S / 'environments/prod/connect.sops.yaml' }}
	just --yes decrypt-key {{ K8S / 'services/beszel/hub/secret.sops.yaml' }}
	just --yes decrypt-key {{ K8S / 'services/beszel/hub/tls.sops.yaml' }}
	sops exec-env --same-process .env.k3s.sops.yaml "just _ard-ca '{{ ARD_CA }}'"

# delete the plaintext kustomize inputs after rendering or applying
_k8s-clean:
	rm -f {{ quote(PASSWD) }} {{ quote(PULL_SECRET) }} {{ quote(REGISTRY_TLS) }}
	rm -f {{ quote(NATS_ROUTE_DEV) }} {{ quote(NATS_ROUTE_TEST) }} {{ quote(NATS_ROUTE_PROD) }}
	rm -f {{ quote(TLS_DEV) }} {{ quote(TLS_TEST) }} {{ quote(TLS_PROD) }}
	rm -f {{ quote(CONNECT_DEV) }} {{ quote(CONNECT_TEST) }} {{ quote(CONNECT_PROD) }}
	rm -f {{ quote(BESZEL_HUB) }} {{ quote(BESZEL_TLS) }}
	rm -f {{ quote(ARD_CA / 'root.pem') }} {{ quote(ARD_CA / 'chain.pem') }}

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

# show what applying a host bundle would change (part: traefik, registry, observability, beszel, eventhub-dev, eventhub-test, eventhub-prod)
[group('K3S')]
k8s-diff host part='':
	#!/usr/bin/env bash
	set -uo pipefail
	trap 'just _k8s-clean' EXIT
	just _k8s-decrypt || exit $?
	host=$(just --quiet _nix-alias-to-friendly-name {{ quote(host) }})
	kubeconfig="keys/${host}-k3s-cert.yaml"
	part={{ quote(part) }}
	kubectl --kubeconfig "$kubeconfig" diff \
		-k {{ quote(K8S / 'clusters') }}/"$host" {{ if part == '' { '' } else { '-l app.kubernetes.io/instance=' + quote(part) } }}
	diff_status=$?
	# kubectl diff exits 1 when there are differences, >1 on errors.
	if [[ $diff_status -gt 1 ]]; then exit $diff_status; fi
	if [[ $diff_status -eq 1 ]]; then exit 1; fi

# apply a host bundle, or one part of it (traefik, registry, observability, beszel, eventhub-dev, eventhub-test, eventhub-prod)
[confirm('Apply to this host? Type yes...')]
[group('K3S')]
k8s-apply host part='':
	#!/usr/bin/env bash
	set -euo pipefail
	trap 'just _k8s-clean' EXIT
	just _k8s-decrypt
	host=$(just --quiet _nix-alias-to-friendly-name {{ quote(host) }})
	kubeconfig="keys/${host}-k3s-cert.yaml"
	part={{ quote(part) }}
	kubectl --kubeconfig "$kubeconfig" apply \
		-k {{ quote(K8S / 'clusters') }}/"$host" {{ if part == '' { '' } else { '-l app.kubernetes.io/instance=' + quote(part) } }}

# forward the VictoriaLogs MCP of one host, or every host when empty, to the local ports in .cursor/mcp.json
[group('K3S')]
k8s-logs-mcp host='':
	#!/usr/bin/env bash
	set -euo pipefail
	# One fixed local port per host so all three can run at once. Keep in sync with .cursor/mcp.json.
	port_for() {
		case "$1" in
			eventhub-connect-bad) echo 9431 ;;
			eventhub-connect-mnz) echo 9432 ;;
			eventhub-connect-stg) echo 9433 ;;
			*)
				echo "no local MCP port for $1" >&2
				return 1
				;;
		esac
	}
	if [[ -n {{ quote(host) }} ]]; then
		hosts=$(just --quiet _nix-alias-to-friendly-name {{ quote(host) }})
	else
		hosts=$(just --quiet _nix-list-friendly-names)
	fi
	trap 'kill $(jobs -p) 2>/dev/null' EXIT
	for host in $hosts; do
		port=$(port_for "$host")
		echo "${host}: http://127.0.0.1:${port}/mcp"
		kubectl --kubeconfig "keys/${host}-k3s-cert.yaml" -n observability \
			port-forward service/victoria-logs-mcp "${port}:http" &
	done
	wait
