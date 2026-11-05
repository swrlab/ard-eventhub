# NixOS

Central NixOS configuration for the Eventhub Connect hosts. One tree, uploaded in full to each host at `/etc/nixos/` via `just nix-upload <host>`.

## Structure

- `common/base.nix` — shared module imported by every host: systemd-boot, NetworkManager, key-only OpenSSH, base packages, zsh, flakes, and a single-node k3s server. List options merge by concatenation; strings use `mkDefault` so a host's plain assignment wins. Each host overlay sets the k3s zone label (`mnz`, `bad`, `stg`). The Kubernetes manifests pin NATS and connect to it, and Vector tags logs with it.
- `common/herdr-core.nix` — imported by `base.nix`. Installs the herdr-core release binary (`herdr-core` and `hc`) for the Herdr app. It also enables linger for root, so `/run/user/0` (the herdr-core socket) stays after SSH logout. Bump the version and hash together from `releases.herdr.dev/core/latest.json`.
- `common/authorized_keys` — root SSH keys, one per line, loaded by the base module. Hosts can still append keys through `authorizedKeys.keys`.
- `hosts` — one line per host: friendly name, then server number. The friendly name is the directory, the flake attribute, and the `just nix-*` argument. The server number is the NixOS hostname and the SSH target.
- `flake.nix` — one flake per friendly name in `hosts`. It sets `networking.hostName` from the server number. The flake root must be this directory so host configs can import `../common/base.nix`.
- `flake.lock` — generated on the first rebuild on a host; `just nix-download <host>` syncs it back into the repo.
- `<friendly-name>/` — host overlay: `config.nix` and `hardware-configuration.nix` (generated on the host).
- `justfile` — recipes that run on the host after upload. `just flake` resolves `hostname -s` back to the friendly name through `hosts`.

## Add a host

1. Add a line to `hosts`: `<friendly-name> <server-number>`.
2. Create `<friendly-name>/config.nix` modeled on an existing host.
3. Copy `hardware-configuration.nix` from the host into that directory.

`just nix-all` and `just nix-download-all` read the friendly names from `hosts`, so the list is not repeated in the justfile.

## Workflow

Local commands live in `just/nixos.just`; host-side commands live in the [`justfile`](./justfile) next to this README, which is uploaded with the tree:

```sh
# from the repo
just nix-upload "<host>"     # scp the full tree to /etc/nixos/ on the mapped server
just nix-apply "<host>"      # upload + rebuild + pull flake.lock back
just nix-all                # nix-apply for every host in infra/nixos/hosts
just nix-download "<host>"   # pull the host's subtree + flake.lock
just nix-check              # evaluate the flake locally

# on the host (resolves hostname -s back to the friendly name)
cd /etc/nixos
just dry                                 # build without activating
just flake                               # apply the uploaded config (confirm-gated)
just rollback                            # roll back to the previous generation
```

Replace `<host>` with a friendly name from `infra/nixos/hosts`.

The flake also works standalone on the host: `nixos-rebuild switch --flake "/etc/nixos#<host>"`.

## Time synchronization

All hosts use chrony with the three internal SWR NTP servers configured in `common/base.nix`. Each server uses `iburst` for rapid initial synchronization. The NixOS chrony module disables systemd-timesyncd automatically. After applying the configuration, run `just ntp` from `/etc/nixos` on the host to inspect synchronization and source status.

## Local k3s access

The recipes in `just/k3s.just` use the same friendly host names and SSH mapping as `just nix-*`:

```sh
just cp-k3s-config "<host>"  # download /etc/rancher/k3s/k3s.yaml over SSH
# Before confirming encryption, edit keys/<host>-k3s-cert.yaml:
# replace 127.0.0.1 in server: with the reachable IP/hostname.
# If you declined the prompt, encrypt the edited file separately:
just k3s-encrypt "<host>"
just k3s-decrypt "<host>"    # restore the local kubeconfig from SOPS
just k9s "<host>"
just radar "<host>"
```

Plaintext kubeconfigs contain cluster-admin credentials. They are stored with mode `600` in the gitignored `keys/<host>-k3s-cert.yaml`. Only the encrypted `keys/<host>-k3s-cert.sops.yaml` may be committed. Encryption uses the existing `.sops.yaml` recipients. The API endpoint must be reachable on port `6443` and covered by the server's TLS certificate.
