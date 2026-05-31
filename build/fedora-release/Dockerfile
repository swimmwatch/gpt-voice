# syntax=docker/dockerfile:1.7

FROM fedora:44

ENV CI=true \
    CLOAKBROWSER_AUTO_UPDATE=false \
    npm_config_update_notifier=false \
    npm_config_fund=false \
    npm_config_audit=false

RUN --mount=type=cache,target=/var/cache/dnf,sharing=locked \
    --mount=type=cache,target=/var/cache/libdnf5,sharing=locked \
    dnf -y --setopt=install_weak_deps=False install \
      alsa-lib \
      appstream \
      at-spi2-atk \
      atk \
      ca-certificates \
      cairo \
      cpio \
      cups-libs \
      desktop-file-utils \
      dpkg \
      file \
      findutils \
      gtk3 \
      gzip \
      libXcomposite \
      libXdamage \
      libXrandr \
      libdrm \
      libxcrypt-compat \
      libxkbcommon \
      mesa-libgbm \
      nodejs24 \
      nodejs24-npm \
      nss \
      pango \
      rpm \
      rpm-build \
      tar \
      unzip \
      which \
      xz \
    && dnf -y clean packages

COPY fedora-release-entrypoint.mjs /usr/local/bin/gpt-voice-fedora-release-build
RUN chmod 0755 /usr/local/bin/gpt-voice-fedora-release-build

WORKDIR /workspace
ENTRYPOINT ["gpt-voice-fedora-release-build"]
CMD ["--mode=release"]
