const core = require("@actions/core");
const fs = require("fs");
const path = require("path");

const defaultConfiguration = {
  emojisPrefix: true,
  emojis: {
    changes: "⚙️",
    dependencies: "📦",
    distribution: "🚚",
    features: "🚀",
    "new features": "🚀",
    fixes: "🔧",
    links: "🔗",
    notes: "📝",
    other: "💬",
    security: "🛡",
  },
  order: [
    "features",
    "new features",
    "changes",
    "fixes",
    "security",
    "dependencies",
    "distribution",
    "notes",
    "other",
    "links"
  ],
};

function findVersions(changelog) {
  const versions = {};
  let nextHeader = changelog.search(/^## /m);

  while (nextHeader >= 0) {
    changelog = changelog.substr(nextHeader);
    const version = changelog.match(/^## ([^ \n]*)[^\n]*$/m)[1].trim();
    const title = changelog.match(/^## ([^\n]*)$/m)[1].trim();
    changelog = changelog.substr(changelog.search(/\n/));
    nextHeader = changelog.search(/^## /m);
    nextHeader = nextHeader >= 0 ? nextHeader : changelog.length;
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
    const title = changelog.match(/^### ([^\n]*)$/m)[1].trim();
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
  sections.sections.forEach(([title, body]) => release += `## ${title}\n\n${body.replace(/^#/mg, "")}\n\n`);
  return release.trim();
}

try {
  const versionName = core.getInput("version-name", {required: true});
  const changelogPath = core.getInput("changelog") || "CHANGELOG.md";
  const configurationPath = core.getInput("configuration") || null;

  core.info(`VERSION: ${versionName}`);
  core.info(`CHANGELOG: ${changelogPath}`);
  core.info(`CONFIGURATION: ${configurationPath || "{default}"}`);

  const changelog = fs.readFileSync(changelogPath, {encoding: "utf-8"}).trim() + "\n";
  const configuration = configurationPath ? JSON.parse(fs.readFileSync(configurationPath, {encoding: "utf-8"})) : defaultConfiguration;
  configuration.emojisPrefix = configuration.emojisPrefix === undefined ? true : configuration.emojisPrefix;

  const versions = findVersions(changelog);
  const version = versions[versionName];
  core.info(`VERSIONS: ${Object.keys(versions).slice(0, 5).join(", ")}` + (Object.keys(versions).length > 5 ? `, ... [${Object.keys(versions).length - 5} more]` : ""));
  if (version === undefined) return core.setFailed(`ERROR: Version '${versionName}' not in ${path.basename(changelogPath)}`);

  const sections = findSections(version.body);
  sections.sections = orderSections(sections.sections, configuration.order || []);
  sections.sections = emojiSections(sections.sections, configuration.emojis || {}, configuration.emojisPrefix);

  core.setOutput("title", version.title);
  core.setOutput("body", buildRelease(sections));
} catch (error) {
  core.setFailed(error.message);
}