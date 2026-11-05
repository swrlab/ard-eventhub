# Host overlay for eventhub-connect-mnz. The NixOS hostname comes from ../hosts.
# Shared config lives in ../common/base.nix.

{ ... }:

{
  imports = [
    ./hardware-configuration.nix
    ../common/base.nix
  ];

  # Replaces the base extraFlags. The zone manifest selects this label.
  services.k3s.extraFlags = toString [
    "--supervisor-metrics"
    "--node-label topology.kubernetes.io/zone=mnz"
  ];
}
