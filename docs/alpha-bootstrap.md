# First alpha publication

npm requires a package to exist before configuring a trusted publisher. For the
first alpha, dispatch `release.yml` on `main` with `bootstrap: true`, the reviewed
version tag and channel `alpha`. It runs the normal release gates and full CI,
then signs the exact tested archives through GitHub OIDC. No npm token enters CI.
The tag must point to current main so the signed source identity is exact.

Download `signed-alpha-<run-id>`, verify `SHA256SUMS`, and publish each archive with
an authenticated owner session, `--tag alpha --access public --ignore-scripts`
and `--provenance=false --provenance-file=<archive>.sigstore`. The false flag selects
the already signed bundle instead of attempting to generate another one locally;
it does not omit provenance. npm verifies the package digest and Sigstore signature.
Never repack, change the bundle, publish a placeholder, or use latest/next.

After publication, configure each package's trusted publisher for
`adulash/adula-kit`, workflow `release.yml`, environment `npm`, with publish
permission. Subsequent releases use the default OIDC publishing job.
