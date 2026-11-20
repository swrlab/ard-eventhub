# Shared NixOS configuration for all Eventhub Connect hosts.
#
# Host config.nix files import this module and add host-specific values:
# list options (systemPackages, authorized keys) merge by concatenation;
# string options set here use mkDefault so a plain assignment in the host
# file wins.

{ lib, pkgs, ... }:

{
  imports = [ ./herdr-core.nix ];

  # Use the systemd-boot EFI boot loader.
  boot.loader.systemd-boot.enable = true;
  boot.loader.efi.canTouchEfiVariables = true;

  networking.networkmanager.enable = true;

  # Internal resolvers. NetworkManager writes resolv.conf through resolvconf,
  # which puts these ahead of any DHCP-provided servers.
  networking.nameservers = [
    "10.127.201.221"
    "10.63.101.221"
    "10.191.201.221"
  ];

  time.timeZone = lib.mkDefault "Europe/Berlin";
  i18n.defaultLocale = "en_US.UTF-8";

  services.chrony = {
    enable = true;
    serverOption = "iburst";
    servers = [
      "s0.ntp.swr.de"
      "b0.ntp.swr.de"
      "m1.ntp.swr.de"
    ];
  };

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

  # Image names use registry.registry.svc:5000. containerd on the host cannot
  # resolve that DNS name, so pull from the fixed ClusterIP of Service registry
  # (infra/kubernetes/services/registry/service.yaml). Plain HTTP, but the hop
  # stays on this machine. Traefik owns :5000 on the node and serves it with TLS.
  environment.etc."rancher/k3s/registries.yaml".text = ''
    mirrors:
      "registry.registry.svc:5000":
        endpoint:
          - "http://10.43.0.50:5000"
  '';

  # Default-deny host firewall on the nftables backend (table inet nixos-fw).
  # Only host-local listeners hit the input chain: SSH (22, opened by openssh),
  # the k3s API (6443), and Beszel agent (45876, hostNetwork). Traefik and NATS
  # hostPorts are DNAT'd in prerouting and traverse forward (filterForward stays
  # false). All non-echo ICMPv4 requests, including timestamp (type 13), drop by
  # default; ping stays allowed.
  #
  # flushRuleset defaults to false on stateVersion 26.05 when ruleset is unset,
  # so firewall reloads replace only nixos-fw and leave k3s tables intact.
  networking.nftables.enable = true;
  networking.firewall = {
    enable = true;
    allowedTCPPorts = [
      6443 # k3s API server (kubectl, k9s, radar, k8s-logs-mcp)
      45876 # Beszel agent (hostNetwork, polled by hubs on all three hosts)
    ];
    # Trust pod/overlay interfaces so pods can reach the host API, DNS, and the
    # local registry ClusterIP (10.43.0.50:5000). NixOS always trusts lo.
    trustedInterfaces = [
      "cni0"
      "flannel.1"
    ];
    # Strict rpfilter in prerouting can drop asymmetric pod/overlay packets.
    checkReversePath = "loose";
  };

  programs.zsh.enable = true;

  # Key-only SSH; root login is how `just nix-upload` and `just nix-all` reach the host
  services.openssh = {
    enable = true;
    settings.PermitRootLogin = "yes";
    settings.PasswordAuthentication = false;
  };

  system.stateVersion = "26.05";
}
