const SEMVER_CORE_PATTERN = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u;
const SEMVER_IDENTIFIER_PATTERN = /^[\dA-Za-z-]+$/u;
const SEMVER_NUMERIC_IDENTIFIER_PATTERN = /^(?:0|[1-9]\d*)$/u;

/** Validates a strict SemVer 2.0.0 version without regular-expression backtracking risks. */
export function isSemanticVersion(value) {
  if (typeof value !== 'string') return false;
  const buildSeparator = value.indexOf('+');
  if (buildSeparator !== value.lastIndexOf('+')) return false;
  const versionWithPrerelease = buildSeparator === -1 ? value : value.slice(0, buildSeparator);
  const buildMetadata = buildSeparator === -1 ? null : value.slice(buildSeparator + 1);
  if (
    buildMetadata !== null &&
    (buildMetadata.length === 0 ||
      !buildMetadata.split('.').every((identifier) => SEMVER_IDENTIFIER_PATTERN.test(identifier)))
  ) {
    return false;
  }
  const prereleaseSeparator = versionWithPrerelease.indexOf('-');
  const core = prereleaseSeparator === -1 ? versionWithPrerelease : versionWithPrerelease.slice(0, prereleaseSeparator);
  const prerelease = prereleaseSeparator === -1 ? null : versionWithPrerelease.slice(prereleaseSeparator + 1);
  if (!SEMVER_CORE_PATTERN.test(core) || prerelease === null) return SEMVER_CORE_PATTERN.test(core);
  return (
    prerelease.length > 0 &&
    prerelease
      .split('.')
      .every(
        (identifier) =>
          SEMVER_IDENTIFIER_PATTERN.test(identifier) &&
          (!/^\d+$/u.test(identifier) || SEMVER_NUMERIC_IDENTIFIER_PATTERN.test(identifier)),
      )
  );
}
