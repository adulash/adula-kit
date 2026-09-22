# First alpha publication

npm requires a package to exist before configuring a trusted publisher. For the
first alpha, dispatch `release.yml` on `main` with `bootstrap: true`, the reviewed
version tag and channel `alpha`. It runs the normal release gates and full CI,
then signs the exact tested archives through GitHub OIDC. No npm token enters CI.
The tag must point to current main so the signed source identity is exact.

Download `signed-alpha-<run-id>` and run:

```sh
node scripts/publish-bootstrap.mjs <npm-11.19-root> <signed-artifact-directory> --verify
node scripts/publish-bootstrap.mjs <npm-11.19-root> <signed-artifact-directory> --publish
```

The helper verifies all checksums, release gates, package identities and Sigstore
bundles before publishing through npm's publisher and normal interactive 2FA
handler. It forces the public `alpha` tag and attaches the signed provenance.
This avoids npm CLI's conflicting provenance flags and the manifest's automatic
provenance generation setting without changing or repacking the tested archives.
Never repack, change the bundle, publish a placeholder, or use latest/next.

After publication, configure each package's trusted publisher for
`adulash/adula-kit`, workflow `release.yml`, environment `npm`, with publish
permission. Subsequent releases use the default OIDC publishing job.
