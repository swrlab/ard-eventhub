# ARD CN certificate requests for eventhub-connect.
# One CSR per environment covers all three zones. Each zone has two DNS names
# (ARD-CN and SWR-internal). MQTT :8883 and the NATS WebSocket :9222 share it.
# Cluster routes on :6222 are plaintext and are not in the certificate.
# The key stays under .local/certs/ and is gitignored. Send only the .csr.

CERT_DIR := justfile_directory() / '.local/certs'

# write a CSR for dev, test, or prod (just csr dev, just csr dev --force)
[group('CERTIFICATES')]
csr env force='':
	#!/usr/bin/env bash
	set -euo pipefail

	env={{ quote(env) }}
	force={{ quote(force) }}

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
	for zone in "${zones[@]}"; do
		names+=("eventhub-connect-${zone}-${env}.swr.cn.ard.de")
	done
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
