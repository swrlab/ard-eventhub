# ARD CN certificate requests for eventhub-connect.
# One CSR per environment covers all three zones. Each zone has two DNS names
# (ARD-CN and SWR-internal). MQTT :8883 and the NATS WebSocket :9222 share it.
# Cluster routes on :6222 are plaintext and are not in the certificate.
# The key stays under .local/certs/ and is gitignored. Send only the .csr.

CERT_DIR := justfile_directory() / '.local/certs'

# contact address written into the CSR subject (override: just CERT_EMAIL=team@example.de csr dev)
CERT_EMAIL := env('CERT_EMAIL', '')

# write a CSR for dev, test, or prod (just csr dev, just csr dev --force)
[group('CERTIFICATES')]
csr env force='':
	#!/usr/bin/env bash
	set -euo pipefail

	env={{ quote(env) }}
	force={{ quote(force) }}
	email={{ quote(CERT_EMAIL) }}

	case "$env" in
		dev|test|prod) ;;
		*)
			echo "env must be dev, test, or prod" >&2
			exit 1
			;;
	esac

	if [[ -n "$force" && "$force" != '--force' ]]; then
		echo "second argument must be --force" >&2
		exit 1
	fi

	if [[ -z "$email" ]]; then
		echo 'set CERT_EMAIL, e.g. just CERT_EMAIL=team@example.de csr dev' >&2
		exit 1
	fi

	if ! command -v openssl >/dev/null; then
		echo 'openssl not on PATH' >&2
		exit 1
	fi

	out="{{ CERT_DIR }}/$env"
	mkdir -p "$out"

	key="$out/eventhub-connect-$env.key"
	csr="$out/eventhub-connect-$env.csr"
	cnf="$out/eventhub-connect-$env.cnf"

	if [[ -e "$key" && "$force" != '--force' ]]; then
		echo "refusing to replace $key" >&2
		echo 're-run with --force only if this CSR was never submitted' >&2
		exit 1
	fi

	zones=(bad mnz stg)
	names=()
	# for zone in "${zones[@]}"; do
	# 	names+=("eventhub-connect-${zone}-${env}.swr.cn.ard.de")
	# done
	for zone in "${zones[@]}"; do
		names+=("eventhub-connect-${zone}-${env}.swr.ard")
	done

	cn="${names[0]}"

	{
		cat <<-EOF
	[ req ]
	default_bits       = 4096
	prompt             = no
	distinguished_name = dn
	req_extensions     = v3_req
	utf8               = yes

	[ dn ]
	C  = DE
	O  = SWR
	CN = ${cn}
	emailAddress = ${email}

	[ v3_req ]
	basicConstraints = CA:FALSE
	keyUsage = digitalSignature, keyEncipherment
	extendedKeyUsage = serverAuth
	subjectAltName = @alt_names

	[ alt_names ]
	EOF
		i=1
		for name in "${names[@]}"; do
			printf 'DNS.%s = %s\n' "$i" "$name"
			i=$((i + 1))
		done
	} > "$cnf"
	sed 's/^[[:space:]]*//' "$cnf" > "$cnf.tmp"
	mv "$cnf.tmp" "$cnf"

	umask 077
	rm -f "$key" "$csr"
	openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:4096 -out "$key"
	chmod 600 "$key"
	openssl req -new -key "$key" -out "$csr" -config "$cnf"
	openssl req -in "$csr" -noout -verify >/dev/null

	echo "CSR  $csr"
	echo "Key  $key"
	echo 'Send the CSR only. The key stays on this machine.'
	echo
	openssl req -in "$csr" -noout -subject
	echo 'subjectAltName:'
	openssl req -in "$csr" -noout -text \
		| awk '/X509v3 Subject Alternative Name/ { getline; print }' \
		| tr ',' '\n' \
		| sed 's/^[[:space:]]*/  /'
	echo
	cat "$csr"

# check a CA leaf against its key and store both in the stage's sops file, dev also for registry and Beszel (just tls-store dev tls.crt)
[group('CERTIFICATES')]
tls-store env cert='tls.crt':
	#!/usr/bin/env bash
	set -euo pipefail

	env={{ quote(env) }}
	cert={{ quote(cert) }}

	case "$env" in
		dev|test|prod) ;;
		*)
			echo "env must be dev, test, or prod" >&2
			exit 1
			;;
	esac

	key="{{ CERT_DIR }}/$env/eventhub-connect-$env.key"
	for file in "$cert" "$key"; do
		if [[ ! -f "$file" ]]; then
			echo "not found: $file" >&2
			exit 1
		fi
	done

	cert_pub=$(openssl x509 -in "$cert" -noout -pubkey | openssl sha256)
	key_pub=$(openssl pkey -in "$key" -pubout | openssl sha256)
	if [[ "$cert_pub" != "$key_pub" ]]; then
		echo "$cert was not signed for $key" >&2
		exit 1
	fi
	if ! openssl x509 -in "$cert" -noout -checkend 0 >/dev/null; then
		echo "$cert has expired" >&2
		exit 1
	fi
	# The same names just csr requests.
	sans=$(openssl x509 -in "$cert" -noout -ext subjectAltName)
	for zone in bad mnz stg; do
		name="eventhub-connect-${zone}-${env}.swr.ard"
		if ! grep -qE "DNS:${name//./\\.}(,|$)" <<< "$sans"; then
			echo "$cert lacks $name" >&2
			exit 1
		fi
	done

	# Secret name, sops file. The plaintext only passes through the pipe.
	store() {
		local name=$1 out=$2
		{
			printf '# Secret %s, the %s certificate. Written by just tls-store %s.\n' "$name" "$env" "$env"
			KUBECONFIG=/dev/null kubectl create secret tls "$name" --cert="$cert" --key="$key" \
				--dry-run=client -o yaml
		} | sops encrypt --filename-override "$out" --input-type yaml --output-type yaml /dev/stdin > "$out.tmp"
		mv "$out.tmp" "$out"
		echo "wrote $out"
	}
	store eventhub-tls "{{ K8S }}/environments/$env/tls.sops.yaml"
	# The registry (:5000) and the Beszel hub (:8081) answer as eventhub-connect-<zone>-dev.swr.ard.
	if [[ "$env" == dev ]]; then
		store registry-tls "{{ K8S }}/services/registry/tls.sops.yaml"
		store beszel-tls "{{ K8S }}/services/beszel/hub/tls.sops.yaml"
	fi
	openssl x509 -in "$cert" -noout -subject -issuer -enddate
