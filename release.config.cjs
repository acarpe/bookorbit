// @ts-check

/** @type {import('semantic-release').GlobalConfig} */
module.exports = {
  branches: ["main"],
  tagFormat: "v${version}",
  repositoryUrl: "https://github.com/bookorbit/bookorbit",
  plugins: [
    [
      "@semantic-release/commit-analyzer",
      {
        preset: "conventionalcommits",
        releaseRules: [
          { type: "feat", release: "minor" },
          { type: "fix", release: "patch" },
          { type: "security", release: "patch" },
          { type: "perf", release: "patch" },
          { type: "db", release: "patch" },
          { type: "revert", release: "patch" },
          { breaking: true, release: "major" },
        ],
      },
    ],
    [
      "@semantic-release/release-notes-generator",
      {
        preset: "conventionalcommits",
        linkReferences: true,
        presetConfig: {
          types: [
            { type: "feat", section: "Features" },
            { type: "fix", section: "Bug Fixes" },
            { type: "security", section: "Security" },
            { type: "perf", section: "Performance" },
            { type: "db", section: "Database" },
            { type: "revert", section: "Reverts" },
            { type: "docs", hidden: true },
            { type: "chore", hidden: true },
            { type: "refactor", hidden: true },
            { type: "style", hidden: true },
            { type: "test", hidden: true },
            { type: "build", hidden: true },
            { type: "ci", hidden: true },
          ],
        },
      },
    ],
    "@semantic-release/github",
  ],
};
