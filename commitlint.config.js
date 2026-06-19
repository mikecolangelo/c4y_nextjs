/**
 * Commit message linting using the Conventional Commits standard.
 * Enforced by the Husky `commit-msg` hook.
 *
 * Format: <type>(<optional scope>): <subject>
 * Examples:
 *   feat(services): add maintenance kit picker
 *   fix(billing): correct invoice duplication
 *   chore(deps): bump next to 14.2.35
 */
module.exports = {
  extends: ["@commitlint/config-conventional"],
};
