const { test, expect, describe } = require("@jest/globals");
const { findVersions, findSections, orderSections } = require("../index.js");

describe("findVersions", () => {
  test("should extract a single version from changelog", () => {
    const changelog = `
# Changelog
## 1.0.0 - 2023-01-01
Some description for version 1.0.0
### Features
- Feature 1
- Feature 2
    `;

    const result = findVersions(changelog);

    expect(Object.keys(result)).toContain("1.0.0");
    expect(result["1.0.0"].title).toBe("1.0.0 - 2023-01-01");
    expect(result["1.0.0"].body).toContain("Some description");
    expect(result["1.0.0"].body).toContain("Feature 1");
  });

  test("should extract multiple versions from changelog", () => {
    const changelog = `
# Changelog
## 2.0.0 - 2023-02-01
Version 2.0.0 description
### Features
- New feature

## 1.0.0 - 2023-01-01
Version 1.0.0 description
### Fixes
- Bug fix
    `;

    const result = findVersions(changelog);

    expect(Object.keys(result)).toHaveLength(2);
    expect(Object.keys(result)).toContain("2.0.0");
    expect(Object.keys(result)).toContain("1.0.0");
    expect(result["2.0.0"].body).toContain("New feature");
    expect(result["1.0.0"].body).toContain("Bug fix");
  });

  test("should handle empty changelog", () => {
    const changelog = "";
    const result = findVersions(changelog);
    expect(Object.keys(result)).toHaveLength(0);
  });
});

describe("findSections", () => {
  test("should extract sections from changelog content", () => {
    const changelog = `
Some unlabelled content.

### Features
- Feature 1
- Feature 2

### Fixes
- Fix 1
    `;

    const result = findSections(changelog);

    expect(result.unlabelled).toContain("Some unlabelled content");
    expect(result.sections).toHaveLength(2);
    expect(result.sections[0][0]).toBe("Features");
    expect(result.sections[0][1]).toContain("Feature 1");
    expect(result.sections[1][0]).toBe("Fixes");
  });

  test("should handle content with no sections", () => {
    const changelog = "Just some text without any sections";

    const result = findSections(changelog);

    expect(result.unlabelled).toBe("Just some text without any sections");
    expect(result.sections).toHaveLength(0);
  });

  test("should handle empty sections", () => {
    const changelog = `
### Empty Section

### Another Section
With content
    `;

    const result = findSections(changelog);

    expect(result.sections).toHaveLength(2);
    expect(result.sections[0][0]).toBe("Empty Section");
    expect(result.sections[0][1].trim()).toBe("");
  });
});

describe("orderSections", () => {
  test("should order sections according to specified order", () => {
    const sections = [
      ["Fixes", "- Fix content"],
      ["Features", "- Feature content"],
      ["Notes", "- Note content"],
    ];
    const sectionsOrder = ["features", "fixes", "notes"];

    const result = orderSections(sections, sectionsOrder);

    expect(result[0][0]).toBe("Features");
    expect(result[1][0]).toBe("Fixes");
    expect(result[2][0]).toBe("Notes");
  });

  test("should place sections not in order at the end", () => {
    const sections = [
      ["Unknown", "- Unknown content"],
      ["Features", "- Feature content"],
      ["Notes", "- Note content"],
    ];
    const sectionsOrder = ["features", "notes"];

    const result = orderSections(sections, sectionsOrder);

    expect(result[0][0]).toBe("Features");
    expect(result[1][0]).toBe("Notes");
    expect(result[2][0]).toBe("Unknown");
  });

  test("should handle case-insensitive section names", () => {
    const sections = [
      ["FEATURES", "- Feature content"],
      ["notes", "- Note content"],
    ];
    const sectionsOrder = ["features", "notes"];

    const result = orderSections(sections, sectionsOrder);

    expect(result[0][0]).toBe("FEATURES");
    expect(result[1][0]).toBe("notes");
  });
});

describe("Integration tests", () => {
  test("should process a complete changelog correctly", () => {
    const changelog = `
# Changelog

## 1.0.0 - 2023-01-01

Initial release

### Features
- Feature 1
- Feature 2

### Fixes
- Bug fix 1

### Notes
- Note 1
    `;

    const versions = findVersions(changelog);
    expect(Object.keys(versions)).toContain("1.0.0");

    const { unlabelled, sections } = findSections(versions["1.0.0"].body);
    expect(unlabelled.trim()).toBe("Initial release");
    expect(sections).toHaveLength(3);

    const orderedSections = orderSections(sections, [
      "features",
      "fixes",
      "notes",
    ]);
    expect(orderedSections[0][0]).toBe("Features");
    expect(orderedSections[1][0]).toBe("Fixes");
    expect(orderedSections[2][0]).toBe("Notes");
  });
});
