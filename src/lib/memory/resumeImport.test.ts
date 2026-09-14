import { describe, expect, it } from "vitest";
import { githubToCandidates, parseResumeText } from "./resumeImport";

describe("parseResumeText", () => {
  it("returns [] for empty input", () => {
    expect(parseResumeText("")).toEqual([]);
    expect(parseResumeText("   \n  ")).toEqual([]);
  });

  it("extracts name, email, github, skills", () => {
    const drafts = parseResumeText(
      ["Rohith D", "rohith@example.com", "github.com/Rohithdgrr", "Skills: Rust, TypeScript, SolidJS"].join("\n"),
    );
    const byKey = Object.fromEntries(drafts.map((d) => [d.key, d]));
    expect(byKey["name"]).toMatchObject({ category: "identity", value: "Rohith D" });
    expect(byKey["email"]).toMatchObject({ category: "contact" });
    expect(byKey["github"]).toMatchObject({ category: "social", value: "@Rohithdgrr" });
    expect(byKey["skills"]).toMatchObject({ category: "cv" });
    expect(byKey["skills"]?.value).toEqual(["Rust", "TypeScript", "SolidJS"]);
  });

  it("skips card-shaped numbers as phones", () => {
    const drafts = parseResumeText("card 4111 1111 1111 1111");
    expect(drafts.find((d) => d.key === "phone")).toBeUndefined();
  });
});

describe("githubToCandidates", () => {
  it("maps profile fields and top repos", () => {
    const drafts = githubToCandidates(
      { login: "octo", name: "Octo Cat", bio: "Builds things", location: "Kochi", blog: "https://octo.dev" },
      [
        { name: "b-repo", stargazers_count: 2, language: "Rust" },
        { name: "a-repo", stargazers_count: 9, language: "TypeScript", description: "Cool" },
      ],
    );
    const byKey = Object.fromEntries(drafts.map((d) => [d.key, d]));
    expect(byKey["github"]?.value).toBe("@octo");
    expect(byKey["name"]?.value).toBe("Octo Cat");
    const projects = drafts.filter((d) => d.category === "projects");
    expect(projects).toHaveLength(2);
    expect(projects[0]?.key).toContain("a.repo");
  });

  it("returns [] for invalid shapes", () => {
    expect(githubToCandidates(null, [])).toEqual([]);
    expect(githubToCandidates({ nope: 1 }, [])).toEqual([]);
    expect(githubToCandidates({ login: "x" }, { nope: 1 })).toHaveLength(1);
  });
});
