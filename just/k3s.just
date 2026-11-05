# Local k3s kubeconfig helpers. Hosts use the friendly names from infra/nixos/hosts.
# Plaintext credentials stay in keys/ (gitignored); only *.sops.yaml may be committed.

# download the k3s kubeconfig via SSH, then confirm the endpoint before encrypting
[group('K3S')]
cp-k3s-config host:
	#!/usr/bin/env bash
	set -euo pipefail
	umask 077
	server=$(just --quiet _nix-server {{ quote(host) }})
	config={{ quote('keys/' + host + '-k3s-cert.yaml') }}
	mkdir -p keys
	scp "root@${server}:/etc/rancher/k3s/k3s.yaml" "$config"
	chmod 600 "$config"
	echo "k3s.yaml downloaded to $config - replace 127.0.0.1 with the reachable IP/hostname before continuing!"
	just k3s-encrypt {{ quote(host) }}

# encrypt the kubeconfig after replacing its loopback API endpoint
[confirm('Ready? Insert the correct IP/hostname first! Type yes...')]
[group('K3S')]
k3s-encrypt host:
	sops encrypt {{ quote('keys/' + host + '-k3s-cert.yaml') }} --output {{ quote('keys/' + host + '-k3s-cert.sops.yaml') }}

# decrypt the kubeconfig for local cluster access
[group('K3S')]
k3s-decrypt host:
	#!/usr/bin/env bash
	set -euo pipefail
	umask 077
	sops decrypt {{ quote('keys/' + host + '-k3s-cert.sops.yaml') }} --output {{ quote('keys/' + host + '-k3s-cert.yaml') }}
	chmod 600 {{ quote('keys/' + host + '-k3s-cert.yaml') }}

# open k9s with the host's kubeconfig
[group('K3S')]
k9s host:
	k9s --kubeconfig {{ quote('keys/' + host + '-k3s-cert.yaml') }}

# open radar with the host's kubeconfig
[group('K3S')]
radar host:
	radar --kubeconfig {{ quote('keys/' + host + '-k3s-cert.yaml') }}
