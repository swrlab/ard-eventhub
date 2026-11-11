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

  # Fixed address. NetworkManager would otherwise run DHCP on eth0, so the
  # scripted networking owns this interface instead.
  networking.networkmanager.unmanaged = [ "eth0" ];
  networking.interfaces.eth0.ipv4.addresses = [
    {
      address = "10.191.201.232";
      prefixLength = 24;
    }
  ];
  networking.defaultGateway = {
    address = "10.191.201.1";
    interface = "eth0";
  };
}
