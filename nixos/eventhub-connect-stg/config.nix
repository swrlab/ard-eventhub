# Host overlay for eventhub-connect-stg. The NixOS hostname comes from ../hosts.
# Shared config lives in ../common/base.nix.
# hardware-configuration.nix is copied from the host and is not in the repo yet.

{ ... }:

{
  imports = [
    ./hardware-configuration.nix
    ../common/base.nix
  ];
}
