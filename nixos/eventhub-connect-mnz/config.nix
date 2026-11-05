# Host overlay for eventhub-connect-mnz. The NixOS hostname comes from ../hosts.
# Shared config lives in ../common/base.nix.

{ ... }:

{
  imports = [
    ./hardware-configuration.nix
    ../common/base.nix
  ];
}
