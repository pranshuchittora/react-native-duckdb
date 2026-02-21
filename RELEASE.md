# Release Process

## How to Release

1. Update the version in `package/package.json`:
   ```bash
   # Edit package/package.json "version" field
   ```

2. Commit the version bump:
   ```bash
   git commit -am "chore: bump version to X.Y.Z"
   ```

3. Create and push the tag:
   ```bash
   git tag vX.Y.Z
   git push && git push --tags
   ```

4. **Approve the publish** in the [GitHub Actions UI](https://github.com/pranshuchittora/react-native-duckdb/actions) — the workflow will pause and wait for manual approval before publishing.

5. Verify the package on [npmjs.com/package/react-native-duckdb](https://www.npmjs.com/package/react-native-duckdb).

## What the Workflow Does

When a `v*` tag is pushed, the [release workflow](.github/workflows/release.yml) runs two jobs:

**`publish`** — Builds and publishes to npm:
- Installs dependencies with Bun
- Runs `bun run build` (TypeScript compilation + Expo plugin build)
- Validates tarball contents with `npm pack --dry-run`
- Publishes with `npm publish --provenance`

**`github-release`** — Creates a GitHub Release from the tag with auto-generated release notes from commits since the previous tag.

## What Gets Published

Included in the npm package:
- `src/` — TypeScript source
- `lib/` — Compiled JavaScript
- `cpp/` — C++ native source
- `android/` — Android build configuration
- `ios/` — iOS build configuration (podspec)
- `nitrogen/` — Nitro Modules codegen output
- `plugin/` — Expo config plugin (compiled)
- `app.plugin.js` — Expo plugin entry point
- `scripts/` — Build-time scripts (extension configuration, DuckDB download)
- `vendor/` — DuckDB version markers for build caching

**Not published:** DuckDB source code (downloaded at consumer build time), build artifacts, test files, example app.

## Security Model

### Environment Protection

The `npm` GitHub environment requires manual approval before any publish proceeds. This prevents accidental releases from tag pushes — a human must explicitly approve every publish in the GitHub Actions UI.

### Provenance Attestation

Every published version includes an [npm provenance attestation](https://docs.npmjs.com/generating-provenance-statements) — a cryptographic proof linking the package to this GitHub repository and the specific commit that produced it. You can verify this on the npm package page.

### Token Isolation

The `NPM_TOKEN` secret is scoped to the `npm` environment, not available as a general repository secret. It is only accessible during approved publish runs.

### Clean Git History

The entire git history (94 commits at time of initial release) has been audited — zero credentials, API keys, or tokens in any commit.

### Release Safeguards

The release pipeline includes multiple safeguards:
- **Human approval gate** before every npm publish
- **Provenance attestation** proving the package was built from this repo
- **`prepublishOnly` script** ensures a clean build before publish
- **`npm pack --dry-run`** verification step in CI
- **No pre-release complexity** — every publish goes to `latest`, no accidental beta tags
