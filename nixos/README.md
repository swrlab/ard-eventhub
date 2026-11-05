# NixOS

Central NixOS configuration for the Eventhub Connect hosts. One tree, uploaded in full to each host at `/etc/nixos/` via `just nix-upload <host>`.

## Structure

- `common/base.nix` — shared module imported by every host: systemd-boot, NetworkManager, key-only OpenSSH, base packages, zsh, flakes, and a single-node k3s server. List options merge by concatenation; strings use `mkDefault` so a host's plain assignment wins. Each host overlay sets the k3s zone label (`mnz`, `bad`, `stg`) the NATS manifest selects on.
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
just nix-upload eventhub-connect-mnz     # scp the full tree to /etc/nixos/ on s0006663
just nix-apply eventhub-connect-mnz      # upload + rebuild + pull flake.lock back
just nix-all                             # nix-apply for every host in nixos/hosts
just nix-download eventhub-connect-mnz   # pull the host's subtree + flake.lock
just nix-check                           # evaluate the flake locally

# on the host (resolves hostname -s back to the friendly name)
cd /etc/nixos
just dry                                 # build without activating
just flake                               # apply the uploaded config (confirm-gated)
just rollback                            # roll back to the previous generation
```

The flake also works standalone on the host: `nixos-rebuild switch --flake /etc/nixos#eventhub-connect-mnz`.
