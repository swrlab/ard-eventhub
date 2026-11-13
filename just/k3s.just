# Local k3s kubeconfig helpers. Hosts use the friendly names or aliases from infra/nixos/hosts.toml.
# Plaintext credentials stay in keys/ (gitignored); only *.sops.yaml may be committed.

# download the k3s kubeconfig via SSH, then confirm the endpoint before encrypting
[group('K3S')]
cp-k3s-config host:
	#!/usr/bin/env bash
	set -euo pipefail
	umask 077
	host=$(just --quiet _nix-alias-to-friendly-name {{ quote(host) }})
	server=$(just --quiet _nix-alias-to-server-name "$host")
	config="keys/${host}-k3s-cert.yaml"
	mkdir -p keys
	scp "root@${server}:/etc/rancher/k3s/k3s.yaml" "$config"
	chmod 600 "$config"
	echo "k3s.yaml downloaded to $config - replace 127.0.0.1 with the reachable IP/hostname before continuing!"
	just k3s-encrypt "$host"

# encrypt the kubeconfig after replacing its loopback API endpoint
[confirm('Ready? Insert the correct IP/hostname first! Type yes...')]
[group('K3S')]
k3s-encrypt host:
	#!/usr/bin/env bash
	set -euo pipefail
	host=$(just --quiet _nix-alias-to-friendly-name {{ quote(host) }})
	sops encrypt "keys/${host}-k3s-cert.yaml" --output "keys/${host}-k3s-cert.sops.yaml"

# decrypt the kubeconfig for local cluster access
[group('K3S')]
k3s-decrypt host:
	#!/usr/bin/env bash
	set -euo pipefail
	umask 077
	host=$(just --quiet _nix-alias-to-friendly-name {{ quote(host) }})
	sops decrypt "keys/${host}-k3s-cert.sops.yaml" --output "keys/${host}-k3s-cert.yaml"
	chmod 600 "keys/${host}-k3s-cert.yaml"

# open k9s with the host's kubeconfig
[group('K3S')]
k9s host:
	k9s --kubeconfig {{ quote('keys/' + shell('just --quiet _nix-alias-to-friendly-name "$1"', host) + '-k3s-cert.yaml') }}

# open radar with the host's kubeconfig
[group('K3S')]
radar host:
	radar --kubeconfig {{ quote('keys/' + shell('just --quiet _nix-alias-to-friendly-name "$1"', host) + '-k3s-cert.yaml') }}
