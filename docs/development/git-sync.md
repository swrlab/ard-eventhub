---
title: 'Git sync'
description: 'GitHub is the origin. Pushes to main are mirrored to Tangled and GitLab.'
sidebar:
  order: 12
---

[github.com/swrlab/ard-eventhub](https://github.com/swrlab/ard-eventhub) is the origin. Tangled and GitLab are mirrors of `main`. Commit and push on GitHub. Each sync replaces `main` on the mirrors, so work that exists only on a mirror is overwritten.

[`.github/workflows/sync.yml`](https://github.com/swrlab/ard-eventhub/blob/main/.github/workflows/sync.yml) runs on every push to `main`, and when someone starts it by hand (`workflow_dispatch`). The job checks out `main` with full history and force-pushes that branch to each mirror over SSH.

The job is a matrix with two rows. One mirror failing does not cancel the other.

- **Tangled** uses `TANGLED_URL` (`git@tangled.org:swrlab.tngl.sh/ard-eventhub`) and `secrets.TANGLED_DEPLOY_KEY`. The host key scan is `tangled.org`. The mirror is [tangled.org/swrlab.tngl.sh/ard-eventhub](https://tangled.org/swrlab.tngl.sh/ard-eventhub).
- **GitLab** uses `GITLAB_URL` (`git@gitlab.ard.de:swrlab/ard-eventhub.git`) and `secrets.GITLAB_DEPLOY_KEY`. The host key scan is `gitlab.ard.de`. The mirror is [gitlab.ard.de/swrlab/ard-eventhub](https://gitlab.ard.de/swrlab/ard-eventhub).

Each secret is the full private key, including the `BEGIN` and `END` lines. The matching public key needs write access on that host. The push is authored as `ard-eventhub` (`audiolab@ard.de`).

Only `main` is mirrored. Other branches stay on GitHub.
