# run hurl integration tests against a host (default: local ingest)
[group('LOCAL')]
integration host="http://localhost:8080":
	just env "just integration-with-env {{ host }}"

# run hurl suite (envs need to be provided: TEST_USER, TEST_USER_PW)
integration-with-env host:
	#!/usr/bin/env bash
	set -euo pipefail
	: "${TEST_USER:?TEST_USER is required}"
	: "${TEST_USER_PW:?TEST_USER_PW is required}"
	mkdir -p integration/res
	start="$(bun -e 'console.log(new Date().toISOString())')"
	start_expired="$(bun -e 'console.log(new Date(Date.now() - 20 * 60 * 1000).toISOString())')"
	start_invalid="${start}00"
	hurl \
		--variable host="{{ host }}" \
		--variable email="$TEST_USER" \
		--variable password="$TEST_USER_PW" \
		--variable start="$start" \
		--variable start_expired="$start_expired" \
		--variable start_invalid="$start_invalid" \
		--test \
		integration/ingest-api.hurl
