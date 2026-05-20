import fs from "fs";
import path from "path";

/**
 * Metadata for each doc entry in the sidebar.
 * `file` is resolved relative to the repo root (two levels up from gui/).
 * We check milestone04/<slug>.md first, then root <slug>.md.
 */
export type DocEntry = {
  slug: string;
  title: string;
  section: string;
  file: string | null; // null = not yet written
};

const REPO_ROOT = path.resolve(process.cwd(), "..");

const DOC_DEFS: { slug: string; title: string; section: string; candidates: string[] }[] = [
  {
    slug: "README",
    title: "Overview",
    section: "Overview",
    candidates: ["milestone04/README.md"],
  },
  {
    slug: "failure_cases",
    title: "Failure Cases",
    section: "M4 Deliverables",
    candidates: ["failure_cases.md", "milestone04/failure_cases.md"],
  },
  {
    slug: "human_review_plan",
    title: "Human Review Plan",
    section: "M4 Deliverables",
    candidates: ["milestone04/human_review_plan.md", "human_review_plan.md"],
  },
  {
    slug: "evidence_and_sources",
    title: "Evidence & Sources",
    section: "M4 Deliverables",
    candidates: ["milestone04/evidence_and_sources.md", "evidence_and_sources.md"],
  },
  {
    slug: "estimates",
    title: "Estimates",
    section: "M4 Deliverables",
    candidates: ["milestone04/estimates.md", "estimates.md"],
  },
  {
    slug: "face_validity",
    title: "Face Validity",
    section: "M4 Deliverables",
    candidates: ["milestone04/face_validity.md", "face_validity.md"],
  },
  {
    slug: "test_report",
    title: "Test Report",
    section: "M4 Deliverables",
    candidates: ["milestone04/test_report.md", "test_report.md"],
  },
];

/** Minimum line count to consider a file "real" vs a template stub. */
const MIN_REAL_LINES = 15;

function findRealFile(candidates: string[]): string | null {
  for (const rel of candidates) {
    const abs = path.join(REPO_ROOT, rel);
    if (fs.existsSync(abs)) {
      const content = fs.readFileSync(abs, "utf-8");
      // Skip template stubs (short files that start with boilerplate)
      if (content.split("\n").length >= MIN_REAL_LINES) {
        return abs;
      }
    }
  }
  return null;
}

export function getDocEntries(): DocEntry[] {
  return DOC_DEFS.map((d) => ({
    slug: d.slug,
    title: d.title,
    section: d.section,
    file: findRealFile(d.candidates),
  }));
}

export function getDocContent(slug: string): string | null {
  const def = DOC_DEFS.find((d) => d.slug === slug);
  if (!def) return null;
  const file = findRealFile(def.candidates);
  if (!file) return null;
  return fs.readFileSync(file, "utf-8");
}

export function getAllSlugs(): string[] {
  return DOC_DEFS.map((d) => d.slug);
}
