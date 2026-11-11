# Host overlay for eventhub-connect-stg. The NixOS hostname comes from ../hosts.
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
    "--node-label topology.kubernetes.io/zone=stg"
  ];

  # Fixed address. NetworkManager would otherwise run DHCP on ens33 and add a
  # second address, so the scripted networking owns this interface instead.
  networking.networkmanager.unmanaged = [ "ens33" ];
  networking.interfaces.ens33.ipv4.addresses = [
    {
      address = "10.127.102.143";
      prefixLength = 24;
    }
  ];
  networking.defaultGateway = {
    address = "10.127.102.1";
    interface = "ens33";
  };
}
