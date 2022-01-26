const core = require("@actions/core");
const fs = require("fs");
const path = require("path");

const defaultConfiguration = {
  "emojisPrefix": true,
  "emojis": {
    "changes": "🚀",
    "dependencies": "📦",
    "distribution": "📤",
    "features": "🚀",
    "fixes": "🔧",
    "notes": "📝",
    "other": "💬",
    "security": "🛡",
  }, "order": ["features", "changes", "fixes", "security", "dependencies", "distribution", "notes", "other"],
};

function findVersions(changelog) {
  const versions = {};
  let nextHeader = changelog.search(/^## /m);

  while (nextHeader >= 0) {
    changelog = changelog.substr(nextHeader);
    const version = changelog.match(/^## ([^ ]*)/m)[1].trim();
    const title = changelog.match(/^## (.*)/m)[1].trim();
    changelog = changelog.substr(changelog.search(/\n/));
    nextHeader = changelog.search(/^## /m);
    versions[version] = {
      title, body: changelog.substring(0, nextHeader - 1).trim(),
    };
    changelog = changelog.substr(nextHeader);
    nextHeader = changelog.search(/^## /m);
  }

  return versions;
}

function findSections(changelog) {
  const sections = [];
  let nextHeader = changelog.search(/^#/m);
  const unlabelled = changelog.substring(0, nextHeader >= 0 ? nextHeader : changelog.length);

  while (nextHeader >= 0) {
    changelog = changelog.substr(nextHeader);
    const title = changelog.match(/^### (.*)/m)[1].trim();
    changelog = changelog.substr(changelog.search(/\n/));
    nextHeader = changelog.search(/^### /m);
    nextHeader = nextHeader >= 0 ? nextHeader : changelog.length;
    sections.push([title, changelog.substring(0, nextHeader).trim()]);
    changelog = changelog.substr(nextHeader);
    nextHeader = changelog.search(/^### /m);
  }

  return {unlabelled, sections};
}

function orderSections(sections, sectionsOrder) {
  const sectionsOrdered = [];

  sections
    .filter(([k, _]) => sectionsOrder.includes(k.toLowerCase()))
    .sort(([a, _], [b, __]) => {
      a = sectionsOrder.indexOf(a.toLowerCase());
      b = sectionsOrder.indexOf(b.toLowerCase());
      return a === b ? 0 : a > b ? 1 : -1;
    })
    .forEach(([k, body]) => sectionsOrdered.push([k, body]));
  sections
    .filter(([k, _]) => !sectionsOrder.includes(k.toLowerCase()))
    .sort()
    .forEach(([k, body]) => sectionsOrdered.push([k, body]));

  return sectionsOrdered;
}

function emojiSections(sections, sectionsEmojis, prefix) {
  if (prefix) return sections.map(([title, body]) =>
    [((sectionsEmojis[title.toLowerCase()] || "") + " " + title).trim(), body]);
  else return sections.map(([title, body]) =>
    [(title + " " + (sectionsEmojis[title.toLowerCase()] || "")).trim(), body]);
}

function buildRelease(sections) {
  let release = sections.unlabelled ? sections.unlabelled.trim() + "\n\n" : "";
  sections.sections.forEach(([title, body]) => release += `### ${title}\n\n${body}\n\n`);
  return release.trim();
}

try {
  const versionName = core.getInput("version-name", {required: true});
  const changelogPath = core.getInput("changelog");
  const configurationPath = core.getInput("configuration");

  console.log(`VERSION: ${versionName}`)
  console.log(`CHANGELOG: ${changelogPath}`);
  console.log(`CONFIGURATION: ${configurationPath || "{default}"}`);

  const changelog = fs.readFileSync(configurationPath, {encoding: "utf-8"});
  const configuration = configurationPath ? JSON.parse(fs.readFileSync(configurationPath, {encoding: "utf-8"})) : defaultConfiguration;

  const version = findVersions(changelog)[versionName];
  if (version === undefined) return core.setFailed(`ERROR: Version '${version}' not in ${path.basename(changelogPath)}`);

  const sections = findSections(version.body);
  sections.sections = orderSections(sections.sections, configuration.order || []);
  sections.sections = emojiSections(sections.sections, configuration.emojis || {}, configuration.emojisPrefix ?? true);

  core.setOutput("title", version.title);
  core.setOutput("release", buildRelease(sections));
} catch (error) {
  core.setFailed(error.message);
}