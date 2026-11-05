# Single flake for all Eventhub Connect hosts — the flake root must be this
# directory so host configs can import ../common/base.nix without escaping the
# flake source (per-host flakes would put common/ outside pure evaluation).
#
# Flake attributes are the friendly names from ./hosts. The NixOS hostname is
# the server number on the same line. Rebuild a host:
# nixos-rebuild switch --flake /etc/nixos#<friendly-name>

{
  description = "Eventhub Connect hosts";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";

  outputs = { self, nixpkgs, ... }:
    let
      lib = nixpkgs.lib;

      # "eventhub-connect-mnz s0006663" — comments and blank lines are skipped
      hostLines = lib.filter
        (line: line != "" && !lib.hasPrefix "#" line)
        (lib.splitString "\n" (builtins.readFile ./hosts));
      friendlyName = line: lib.head (lib.splitString " " line);
      serverNumber = line: lib.last (lib.splitString " " line);

      # friendly name → server number (the NixOS hostname)
      servers = lib.listToAttrs (map
        (line: {
          name = friendlyName line;
          value = serverNumber line;
        })
        hostLines);

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
