# Single flake for all Eventhub Connect hosts — the flake root must be this
# directory so host configs can import ../common/base.nix without escaping the
# flake source (per-host flakes would put common/ outside pure evaluation).
#
# Flake attributes are the table keys in ./hosts.toml. The NixOS hostname is
# that table's `server`. Rebuild a host:
# nixos-rebuild switch --flake /etc/nixos#<friendly-name>

{
  description = "Eventhub Connect hosts";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";

  outputs = { self, nixpkgs, ... }:
    let
      lib = nixpkgs.lib;

      # friendly name → server number (the NixOS hostname); aliases are only for local just recipes
      servers = lib.mapAttrs (_: host: host.server) (builtins.fromTOML (builtins.readFile ./hosts.toml));

      # <friendly-name>/config.nix imports ../common/base.nix
      mkHost = name: lib.nixosSystem {
        modules = [
          { nixpkgs.hostPlatform = "x86_64-linux"; }
          { networking.hostName = servers.${name}; }
          ./${name}/config.nix
        ];
      };
    in
    {
      inherit servers;

      nixosConfigurations = lib.genAttrs (lib.attrNames servers) mkHost;
    };
}
