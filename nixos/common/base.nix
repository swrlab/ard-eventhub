# Shared NixOS configuration for all Eventhub Connect hosts.
#
# Host config.nix files import this module and add host-specific values:
# list options (systemPackages, authorized keys) merge by concatenation;
# string options set here use mkDefault so a plain assignment in the host
# file wins.

{ lib, pkgs, ... }:

{
  # Use the systemd-boot EFI boot loader.
  boot.loader.systemd-boot.enable = true;
  boot.loader.efi.canTouchEfiVariables = true;

  networking.networkmanager.enable = true;

  time.timeZone = lib.mkDefault "Europe/Berlin";
  i18n.defaultLocale = "en_US.UTF-8";

  # one key per line; hosts can still append via authorizedKeys.keys
  users.users.root.openssh.authorizedKeys.keyFiles = [ ./authorized_keys ];

  nix.settings.experimental-features = [ "nix-command" "flakes" ];

  environment.systemPackages = with pkgs; [
    git
    wget
    htop
    just
    k3s
  ];

  # One single-node cluster per host. extraFlags is a string, so a host that
  # sets it replaces this mkDefault rather than appending.
  services.k3s = {
    enable = true;
    role = "server";
    extraFlags = lib.mkDefault (toString [
      "--supervisor-metrics"
    ]);
  };

  networking.firewall.enable = false;

  programs.zsh.enable = true;

  # Key-only SSH; root login is how `just nix-upload` and `just nix-all` reach the host
  services.openssh = {
    enable = true;
    settings.PermitRootLogin = "yes";
    settings.PasswordAuthentication = false;
  };

  system.stateVersion = "26.05";
}
