# pnpm `ERR_PNPM_OUTDATED_LOCKFILE` after an npm-scope rename (`@fastpromos` → `@app`)

Research note. Everything here was checked against primary sources (official pnpm
docs and the pnpm/pnpm source) on 2026-09-18. This repository is on `pnpm@11.2.1`
(`packageManager` in the root `package.json`), but where the behavior differs
between the pnpm 11 (JS) and pnpm 12 (Rust/pacquet) installers, both are cited.

## 0. Diagnosis of this build failure

The Vercel build error is precisely a lockfile/manifest drift on the **root
importer**:

```
ERR_PNPM_OUTDATED_LOCKFILE  Cannot install with "frozen-lockfile" because
pnpm-lock.yaml is not up to date with <ROOT>/package.json
Failure reason:
  specifiers in the lockfile don't match specifiers in package.json:
  * 2 dependencies were added: @app/eslint-config@workspace:*, @app/prettier-config@workspace:*
  * 2 dependencies were removed: @fastpromos/eslint-config@workspace:*, @fastpromos/prettier-config@workspace:*
```

The repo's own `pnpm-lock.yaml` still keys the root importer by the old names
(`pnpm-lock.yaml:11-14`):

```yaml
importers:
  .:
    devDependencies:
      '@fastpromos/eslint-config': {specifier: workspace:*, version: link:tooling/eslint-config}
      '@fastpromos/prettier-config': {specifier: workspace:*, version: link:tooling/prettier-config}
```

while the root `package.json` now declares `@app/eslint-config` and
`@app/prettier-config`. The rename updated the manifests but the lockfile was
not regenerated (46 `@fastpromos` references remain in `pnpm-lock.yaml`) before
pushing.

## 1. What triggers the error, and when CI turns `frozen-lockfile` on by default

**Some manifest changed without regenerating the lockfile, and install ran in
frozen-lockfile mode.**

- Official docs define the error: *"This error happens when installation cannot
  be performed without changes to the lockfile. This might happen in a CI
  environment if someone has changed a package.json file in the repository
  without running pnpm install afterwards. Or someone forgot to commit the
  changes to the lockfile."* — [pnpm docs, Error Codes → ERR_PNPM_OUTDATED_LOCKFILE](https://pnpm.io/errors)
- The `--frozen-lockfile` flag: *"If `true`, pnpm doesn't generate a lockfile and
  fails to install if the lockfile is out of sync with the manifest / an update
  is needed or no lockfile is present."* The documented default is `false` for
  non-CI and **`true` for CI, if a lockfile is present**, detected via
  `ci-info` (checks `env.CI`, `env.CONTINUOUS_INTEGRATION`, `env.BUILD_NUMBER`,
  `env.RUN_ID`, ...). — [pnpm docs, `pnpm install` → `--frozen-lockfile`](https://pnpm.io/cli/install)
- The CI recipe page repeats it: *"When pnpm detects that it is running in CI,
  it switches to frozen-lockfile mode automatically."* — [pnpm docs, Continuous Integration](https://pnpm.io/continuous-integration)
- **Why this fires on Vercel:** Vercel sets the system build-time variable
  `CI=1` ("An indicator that the code is running in a Continuous Integration
  environment.") — [Vercel docs, System environment variables](https://vercel.com/docs/environment-variables/system-environment-variables). That trips pnpm's `env.CI` check, so every Vercel `pnpm install` is effectively `--frozen-lockfile`.

**Where the comparison happens (what "not up to date" means):** before a frozen
install, pnpm runs a per-importer structural comparison (`satisfies-package-manifest`).
In the pnpm 12 (Rust) core: `pnpm/crates/lockfile/src/freshness.rs` +
`pnpm/crates/lockfile/src/freshness/manifest.rs`; the error is surfaced in
`pnpm/crates/package-manager/src/install/errors.rs`:

- `freshness.rs` declares `#[display("specifiers in the lockfile don't match
  specifiers in package.json:{_0}")] StalenessReason::SpecifiersDiffer(...)` and
  `SpecDiff` renders buckets as `"\n* {} {dep} {verb} {what}: "` with entries as
  `"{key}@{value}"` — i.e. exactly the `* N dependencies were added/removed: …`
  lines, and notes this *"is rendered into `ERR_PNPM_OUTDATED_LOCKFILE` CI output"*.
  — [pnpm/pnpm source, `pnpm/crates/lockfile/src/freshness.rs`](https://github.com/pnpm/pnpm/blob/main/pnpm/crates/lockfile/src/freshness.rs)
- `manifest.rs::check_flat_specs` builds the manifest's flat union of
  `devDependencies ∪ dependencies ∪ optionalDependencies`, diffs it against the
  importer's recorded specifiers (`diff_flat_records`), and returns
  `SpecifiersDiffer(diff)`. `added` = per-dep key present in the manifest but
  not the lockfile importer; `removed` = present in the lockfile importer but
  not the manifest; `modified` = same key, different specifier. —
  [pnpm/pnpm source, `pnpm/crates/lockfile/src/freshness/manifest.rs`](https://github.com/pnpm/pnpm/blob/main/pnpm/crates/lockfile/src/freshness/manifest.rs)
- The error itself is `#[diagnostic(code(ERR_PNPM_OUTDATED_LOCKFILE))]`, message
  *"Cannot install with \"frozen-lockfile\" because pnpm-lock.yaml is not up to
  date with package.json.\n\n  Failure reason:\n  {reason}"*, with the built-in
  help *"Regenerate the lockfile with `pnpm install --lockfile-only` so that
  pnpm-lock.yaml reflects the current package.json, then re-run
  `pnpm install --frozen-lockfile`."* — [pnpm/pnpm source, `pnpm/crates/package-manager/src/install/errors.rs`](https://github.com/pnpm/pnpm/blob/main/pnpm/crates/package-manager/src/install/errors.rs)
- The pnpm 11 (JS) equivalent used by this repo produces the identical reason
  string: `detailedReason: "specifiers in the lockfile don't match specifiers in
  package.json:\n${displaySpecDiff(specsDiff)}"` with `displaySpecDiff` rendering
  `* {n} dependencies were added: …` and `* {n} dependencies were removed: …`. —
  [pnpm/pnpm source, `pnpm11/lockfile/verification/src/satisfiesPackageManifest.ts`](https://github.com/pnpm/pnpm/blob/main/pnpm11/lockfile/verification/src/satisfiesPackageManifest.ts), driven per-project by [allProjectsAreUpToDate.ts](https://github.com/pnpm/pnpm/blob/main/pnpm11/lockfile/verification/src/allProjectsAreUpToDate.ts)

So: a scope rename changes the **dependency names** in every manifest that
references the renamed packages (root `devDependencies` here), the lockfile
importer still records the old names, the flat diff has 2 entries `added` (the
`@app/*` keys) and 2 `removed` (the `@fastpromos/*` keys), and the frozen install
aborts. This is not a cache bug or a corrupted lockfile — it is pnpm doing
exactly what it is designed to do in CI.

## 2. The correct fix procedure

Per the official docs, the fix is to regenerate locally (without
`--frozen-lockfile`) and **commit** the new `pnpm-lock.yaml`:

> *"To fix this error, just run `pnpm install` and commit the changes to the lockfile."*
> — [pnpm docs, Error Codes → ERR_PNPM_OUTDATED_LOCKFILE](https://pnpm.io/errors)

The pnpm source's own `help` text for this error agrees and prefers the lighter
form for a pure lockfile-only regen:

> *"Regenerate the lockfile with `pnpm install --lockfile-only` … then re-run
> `pnpm install --frozen-lockfile`."* — [pnpm/pnpm, `errors.rs`](https://github.com/pnpm/pnpm/blob/main/pnpm/crates/package-manager/src/install/errors.rs)

Concretely for this repo (run at the repo root, pnpm 11.2.1):

```bash
pnpm install --lockfile-only   # or plain `pnpm install`
pnpm install --frozen-lockfile # verify it now passes locally
git add pnpm-lock.yaml package.json
git commit
git push
```

- `--lockfile-only`: *"When used, only updates `pnpm-lock.yaml` and
  `package.json`. Nothing gets written to the `node_modules` directory."* —
  [pnpm docs, `pnpm install` → `--lockfile-only`](https://pnpm.io/cli/install). (Note: it can also touch `package.json`, e.g. `saveWorkspaceProtocol` normalization; review the diff.)
- Running a plain `pnpm install` (non-frozen) then committing is the general
  documented path and will also re-link `node_modules` locally.
- After the regen, the `importers` across the whole file switch from
  `@fastpromos/*` to `@app/*` keys (see §4) — which is what makes the frozen
  install pass again.

This matches the maintainers' resolution pattern in the issue tracker: the error
means the manifest changed without `pnpm install` having been run and committed —
e.g. [pnpm/pnpm#6526](https://github.com/pnpm/pnpm/issues/6526) (the exact
`Failure reason: specifiers in the lockfile ({}) don't match specs in package.json`),
[pnpm/pnpm#7219](https://github.com/pnpm/pnpm/issues/7219) (a `CI=true … pnpm install`
transcript where the caret change is detected precisely because CI froze the lockfile),
and [pnpm/pnpm#10571](https://github.com/pnpm/pnpm/issues/10571) (the same
`<ROOT>/package.json` + `* N dependencies were added/removed:` format; the
reporter's CI job in each case was fixed by regenerating the lockfile).

## 3. Is `--no-frozen-lockfile` a safe one-off unblock in CI?

It is a one-off unblock, not a fix, and it is explicitly the discouraged path.

- The generated hint text pasted on the error explicitly offers it as an escape
  hatch ("If you still need to run install in such cases, use `pnpm install
  --no-frozen-lockfile`" — visible in every era of the message, e.g. issue logs in
  [pnpm/pnpm#7219](https://github.com/pnpm/pnpm/issues/7219) and
  [pnpm/pnpm#10571](https://github.com/pnpm/pnpm/issues/10571)), so it is *legal*.
  But the pnpm 12 source has since replaced that hint with the proper instruction
  (regenerate with `--lockfile-only` first) — [errors.rs](https://github.com/pnpm/pnpm/blob/main/pnpm/crates/package-manager/src/install/errors.rs) — signalling which behavior is wanted.
- The entire point of the CI default is determinism and **reproducible** installs:
  `pnpm ci` *"Perform a clean install. This command runs `pnpm clean` followed by
  `pnpm install --frozen-lockfile` … Designed for CI/CD environments where
  reproducible builds are critical."* — [pnpm docs, `pnpm ci`](https://pnpm.io/cli/ci)
- `--no-frozen-lockfile` in CI means pnpm re-resolves and **rewrites the lockfile
  (and `node_modules` shape) inside the build** from whatever the registry serves
  at that moment, then discards the change. On Vercel (or any CI) with caching
  keyed on `pnpm-lock.yaml` (as every recipe in the Continuous Integration docs
  does, e.g. `checksum "pnpm-lock.yaml"`), the cache key never moves, the build is
  no longer pinned to the committed lockfile, and the same commit can resolve
  differently across builds/registries — effectively disabling the guard that
  just caught this rename.
- The bottom line: it will (probably) turn the red build green once, but it hides
  the drift, doesn't fix the repo state, and must not become the normal path. The
  docs' prescribed fix is to regenerate and commit (§2). If you must unblock
  *right now*, use `--no-frozen-lockfile` **once** in the project's install
  command to get a deployment out, then immediately do §2 and let the next build
  run frozen again.

## 4. Does a name/scope-only change live in the lockfile's `importers`?

Yes. The lockfile stores, per project, an **importer** keyed by the project's
**relative directory path** (`.`, `apps/backend`, `tooling/eslint-config`, …),
and each importer entry stores the project's dependency specifiers keyed by
dependency **name** with their specifier:

- The official lockfile spec defines `importers[relativePath][dependencyType][dependencyName].specifier`
  where *"`dependencyType` is one of `dependencies`, `optionalDependencies`, or
  `devDependencies`."* — [pnpm/spec, Lockfile version 9.0](https://github.com/pnpm/spec/blob/master/lockfile/9.0.md) (and [6.0](https://github.com/pnpm/spec/blob/master/lockfile/6.0.md) / [5.2](https://github.com/pnpm/spec/blob/master/lockfile/5.2.md) for older formats)
- The reading-the-lockfile doc calls the project document *"the project's own
  dependency graph: `importers` with their `dependencies`"*. — [pnpm docs, Reading `pnpm-lock.yaml`](https://pnpm.io/lockfile)

So when a scope rename changes the **name** under which a dependency is
declared in a manifest (root: `@fastpromos/eslint-config` → `@app/eslint-config`,
same `workspace:*` specifier), the importer's specifier **keys** change, and the
lockfile is out of date — even though no versions moved. Conversely, a rename
that touches only a workspace package's *own* `name` does not rewrite the
importer paths, but every dependent manifest that references it by name must be
renamed too, and those references are exactly what the importers record.

**How to verify the lockfile matches your manifests:**

- Regenerate only the lockfile: `pnpm install --lockfile-only` (no `node_modules`
  writes) — [pnpm docs, `--lockfile-only`](https://pnpm.io/cli/install). `pnpm install --dry-run`
  (added v11.8.0) reports what a real install would change without writing
  anything — [pnpm docs, `pnpm install`](https://pnpm.io/cli/install).
- Prove it locally with the same guard CI uses: `pnpm install --frozen-lockfile`.
  If it exits 0 and prints "Already up to date", the committed lockfile is in sync.
- Grep the diff before committing: every `importers[<path>]` block should show
  `@app/*` keys (and the `packages:`/`snapshots:` entries for previously
  remarked package IDs should drop out).

## 5. Root `package.json` `name` vs. workspace packages — what actually matters

The **root package's `name` is not what the freshness check compares.** Three pieces of evidence:

1. The lockfile spec stores no package `name` for an importer — only relative
   paths and dependency entries — [pnpm/spec, 9.0](https://github.com/pnpm/spec/blob/master/lockfile/9.0.md).
2. The check compares a manifest's **dependency specifiers** (never
   `pkg.name`): `satisfies_package_manifest(importer, manifest, …)` and
   `check_flat_specs` diff `flat_importer_specs(importer)` against the
   manifest's dependency union — [manifest.rs](https://github.com/pnpm/pnpm/blob/main/pnpm/crates/lockfile/src/freshness/manifest.rs); equivalent JS: [satisfiesPackageManifest.ts](https://github.com/pnpm/pnpm/blob/main/pnpm11/lockfile/verification/src/satisfiesPackageManifest.ts).
3. This repo's own lockfile confirms it: the root importer `.` block has no
   `name`/`version` fields (`pnpm-lock.yaml:8-31`).

What actually matters for the lockfile:

- **What are the workspace projects?** The set comes from the workspaces globs
  (`pnpm-workspace.yaml` → `packages:`; here `apps/*`, `packages/*`, `tooling/*`).
  Each matched project becomes an importer keyed by path. Adding/removing the
  glob set adds/removes importers (the source even has explicit staleness reasons
  for a lockfile importer whose project no longer exists — [freshness.rs](https://github.com/pnpm/pnpm/blob/main/pnpm/crates/lockfile/src/freshness.rs)).
- **What each project depends on.** Dependency names (and specifiers), which is
  what the scope rename changed. Root manifests participate like any other
  project's does — the rename made the demand-and-supply names disagree.
- **Workspace names themselves only matter transitively:** they are the values
  referenced via `workspace:*`/`workspace:^` (workspace protocol refs the package
  **name**, not its path) — [pnpm docs, Workspace → Workspace protocol](https://pnpm.io/workspaces). Rename a
  workspace package without updating dependents and you get
  `ERR_PNPM_NO_MATCHING_VERSION_INSIDE_WORKSPACE` (a workspace `foo` that
  doesn't exist) — [pnpm docs, Error Codes](https://pnpm.io/errors) — rather than the outdated-lockfile error.
  Update the dependents but not the lockfile and you get exactly
  `ERR_PNPM_OUTDATED_LOCKFILE`, as here.
- With `sharedWorkspaceLockfile` (default `true`) the whole workspace shares one
  `pnpm-lock.yaml` at the workspace root — [pnpm docs, Workspace → sharedWorkspaceLockfile](https://pnpm.io/workspaces) — so one regen at the root fixes every project in the file.

## Sources (all fetched directly)

- pnpm docs, `pnpm install` (incl. `--frozen-lockfile`, `--lockfile-only`, `--dry-run`, CI default): https://pnpm.io/cli/install
- pnpm docs, Error Codes (`ERR_PNPM_OUTDATED_LOCKFILE`, `ERR_PNPM_NO_MATCHING_VERSION_INSIDE_WORKSPACE`): https://pnpm.io/errors
- pnpm docs, Continuous Integration (auto frozen-lockfile in CI): https://pnpm.io/continuous-integration
- pnpm docs, `pnpm ci` (reproducible clean install): https://pnpm.io/cli/ci
- pnpm docs, Reading `pnpm-lock.yaml` (`importers`): https://pnpm.io/lockfile
- pnpm docs, Workspace (`workspace:` protocol, `sharedWorkspaceLockfile`): https://pnpm.io/workspaces
- pnpm/spec, lockfile 9.0 (importer schema): https://github.com/pnpm/spec/blob/master/lockfile/9.0.md
- Vercel docs, System environment variables (`CI=1` at build time): https://vercel.com/docs/environment-variables/system-environment-variables
- pnpm/pnpm source, error definition & message (Rust core): https://github.com/pnpm/pnpm/blob/main/pnpm/crates/package-manager/src/install/errors.rs
- pnpm/pnpm source, staleness check + `SpecDiff` rendering: https://github.com/pnpm/pnpm/blob/main/pnpm/crates/lockfile/src/freshness.rs
- pnpm/pnpm source, per-importer manifest comparison: https://github.com/pnpm/pnpm/blob/main/pnpm/crates/lockfile/src/freshness/manifest.rs
- pnpm/pnpm source, JS (pnpm 11) equivalent check: https://github.com/pnpm/pnpm/blob/main/pnpm11/lockfile/verification/src/satisfiesPackageManifest.ts and https://github.com/pnpm/pnpm/blob/main/pnpm11/lockfile/verification/src/allProjectsAreUpToDate.ts
- pnpm/pnpm issues confirming behavior/fix: https://github.com/pnpm/pnpm/issues/6526 , https://github.com/pnpm/pnpm/issues/7219 , https://github.com/pnpm/pnpm/issues/10571

*(Repo-local evidence cited above: `package.json:26-27`, `pnpm-lock.yaml:8-31`.)*