# herdr-core (hc) — keeps terminals and agents alive for the Herdr app (`hc machine add`).
# Imported by ./base.nix, so every Eventhub Connect host gets it.

{ pkgs, ... }:

let
  # static musl release binary; bump version + hash together from releases.herdr.dev/core/latest.json
  herdr-core = pkgs.stdenvNoCC.mkDerivation rec {
    pname = "herdr-core";
    version = "0.1.18";
    src = pkgs.fetchurl {
      url = "https://releases.herdr.dev/core/${version}/herdr-core-linux-x86_64.tar.gz";
      hash = "sha256-Wy+Xy0sqnXprLMWUJiggPtn7t8wMK0sJrYpvVkjiRrc=";
    };
    sourceRoot = ".";
    installPhase = ''
      install -Dm755 herdr-core $out/bin/herdr-core
      ln -s herdr-core $out/bin/hc
    '';
  };
in
{
  environment.systemPackages = [ herdr-core ];

  # keep /run/user/0 (herdr-core's socket) after the last ssh session ends
  users.users.root.linger = true;
}
