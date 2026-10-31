import "server-only";

import { extractText } from "unpdf";

export type ResumePage = {
  page_number: number;
  text: string;
};

export type ResumeEvidenceDraft = {
  claim_key: string;
  claim_text: string;
  source_excerpt: string;
  page_number: number;
  section_name: string;
  confidence: number;
};

type ResumeProfile = {
  full_name: string;
  skills: string[];
  work_experience: {
    job_title: string;
    company: string;
  }[];
  education: {
    degree: string;
    institution: string;
  }[];
};

export async function extractPdfPages(
  buffer: Buffer
): Promise<ResumePage[]> {
  try {
    const result = await extractText(
      new Uint8Array(buffer),
      { mergePages: false }
    );

    const totalPages = result.totalPages;

    if (
      !Number.isInteger(totalPages) ||
      totalPages < 1 ||
      totalPages > 60
    ) {
      throw new Error(
        "The PDF has an invalid or unsupported page count."
      );
    }

    const pageTexts = Array.isArray(result.text)
      ? result.text
      : [result.text];

    const pages = pageTexts.map((text, index) => ({
      page_number: index + 1,
      text: String(text || "").trim(),
    }));

    const totalCharacters = pages.reduce(
      (total, page) => total + page.text.length,
      0
    );

    if (totalCharacters < 30) {
      throw new Error(
        "No readable PDF text was found. This may be a scanned resume requiring OCR."
      );
    }

    return pages;
  } catch (error) {
    console.error("PDF extraction failed:", error);

    throw new Error(
      error instanceof Error
        ? `Unable to extract PDF text: ${error.message}`
        : "Unable to extract PDF text."
    );
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeForSearch(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function findOccurrence(
  text: string,
  value: string
): number {
  const target = value.trim();

  if (!target || target.length < 2) return -1;

  const expression = new RegExp(
    `(?<![a-z0-9])${escapeRegex(target)}(?![a-z0-9])`,
    "i"
  );

  const match = expression.exec(text);

  return match?.index ?? -1;
}

function getExcerpt(
  text: string,
  position: number,
  matchLength: number,
  before = 150,
  after = 220
): string {
  const start = Math.max(0, position - before);

  const end = Math.min(
    text.length,
    position + matchLength + after
  );

  return text.slice(start, end).trim();
}

function detectSection(line: string): string | null {
  const value = line
    .replace(/[:\-–—]/g, "")
    .trim()
    .toUpperCase();

  if (
    /^(WORK EXPERIENCE|PROFESSIONAL EXPERIENCE|EXPERIENCE|EMPLOYMENT|INTERNSHIPS|WORK HISTORY)$/.test(
      value
    )
  ) {
    return "EXPERIENCE";
  }

  if (
    /^(TECHNICAL SKILLS|CORE SKILLS|SKILLS|TECHNOLOGIES|TECHNICAL PROFICIENCIES)$/.test(
      value
    )
  ) {
    return "SKILLS";
  }

  if (/^(EDUCATION|ACADEMIC BACKGROUND)$/.test(value)) {
    return "EDUCATION";
  }

  if (
    /^(PROJECTS|PERSONAL PROJECTS|TECHNICAL PROJECTS)$/.test(
      value
    )
  ) {
    return "PROJECTS";
  }

  if (
    /^(SUMMARY|PROFILE|PROFESSIONAL SUMMARY|OBJECTIVE)$/.test(
      value
    )
  ) {
    return "SUMMARY";
  }

  return null;
}

function addEvidence(
  output: ResumeEvidenceDraft[],
  seen: Set<string>,
  item: ResumeEvidenceDraft
) {
  const excerpt = item.source_excerpt.trim();

  if (!excerpt || excerpt.length < 8) return;

  const key =
    item.claim_key +
    "|" +
    normalizeForSearch(excerpt);

  if (seen.has(key)) return;

  seen.add(key);

  output.push({
    ...item,
    source_excerpt: excerpt,
    confidence: 1,
  });
}

function splitLongLine(line: string): string[] {
  if (line.length <= 450) {
    return [line];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < line.length) {
    let end = Math.min(start + 450, line.length);

    if (end < line.length) {
      const boundary = line.lastIndexOf(" ", end);

      if (boundary > start + 150) {
        end = boundary;
      }
    }

    const chunk = line.slice(start, end).trim();

    if (chunk.length >= 8) {
      chunks.push(chunk);
    }

    start = end;
  }

  return chunks;
}

export function buildResumeEvidence(
  pages: ResumePage[],
  profile: ResumeProfile,
  generatedEvidence: ResumeEvidenceDraft[] = []
): ResumeEvidenceDraft[] {
  const output: ResumeEvidenceDraft[] = [];
  const seen = new Set<string>();

  // Retain Gemini evidence only when the source excerpt
  // is actually present in the original document.

  for (const item of generatedEvidence) {
    const excerpt = normalizeForSearch(
      item.source_excerpt
    );

    if (!excerpt) continue;

    const sourceExists = pages.some((page) =>
      normalizeForSearch(page.text).includes(excerpt)
    );

    if (sourceExists) {
      addEvidence(output, seen, item);
    }
  }

  for (const page of pages) {
    let currentSection = "RESUME";

    const lines = page.text
      .replace(/\r/g, "")
      .split(/\n+/);

    for (const rawLine of lines) {
      const line = rawLine.trim();

      if (!line) continue;

      const detectedSection = detectSection(line);

      if (detectedSection) {
        currentSection = detectedSection;
        continue;
      }

      const claimKey =
        currentSection === "EXPERIENCE" ||
        currentSection === "PROJECTS"
          ? "work_experience"
          : currentSection === "SKILLS"
            ? "skills"
            : currentSection === "EDUCATION"
              ? "education"
              : "resume_content";

      for (const chunk of splitLongLine(line)) {
        addEvidence(output, seen, {
          claim_key: claimKey,
          claim_text:
            `Verbatim resume excerpt from the ${currentSection} section.`,
          source_excerpt: chunk,
          page_number: page.page_number,
          section_name: currentSection,
          confidence: 1,
        });
      }
    }

    // Check extracted skills against actual document text.

    for (const skill of profile.skills) {
      const position = findOccurrence(page.text, skill);

      if (position === -1) continue;

      addEvidence(output, seen, {
        claim_key: "skills",
        claim_text:
          `The resume explicitly mentions the technical skill: ${skill}.`,
        source_excerpt: getExcerpt(
          page.text,
          position,
          skill.length
        ),
        page_number: page.page_number,
        section_name: "SKILLS / EXPERIENCE",
        confidence: 1,
      });
    }

    // Check employment claims against actual document text.

    for (const job of profile.work_experience) {
      const companyPosition = findOccurrence(
        page.text,
        job.company
      );

      const titlePosition = findOccurrence(
        page.text,
        job.job_title
      );

      if (
        companyPosition === -1 &&
        titlePosition === -1
      ) {
        continue;
      }

      if (
        companyPosition !== -1 &&
        titlePosition !== -1
      ) {
        const start = Math.min(
          companyPosition,
          titlePosition
        );

        const end = Math.max(
          companyPosition + job.company.length,
          titlePosition + job.job_title.length
        );

        const excerpt = page.text
          .slice(
            Math.max(0, start - 120),
            Math.min(page.text.length, end + 350)
          )
          .trim();

        addEvidence(output, seen, {
          claim_key: "work_experience",
          claim_text:
            `The resume identifies the role ${job.job_title} at ${job.company}.`,
          source_excerpt: excerpt,
          page_number: page.page_number,
          section_name: "EXPERIENCE",
          confidence: 1,
        });
      } else {
        const position =
          companyPosition !== -1
            ? companyPosition
            : titlePosition;

        const target =
          companyPosition !== -1
            ? job.company
            : job.job_title;

        addEvidence(output, seen, {
          claim_key: "work_experience",
          claim_text:
            `The resume mentions ${target} in its employment history.`,
          source_excerpt: getExcerpt(
            page.text,
            position,
            target.length
          ),
          page_number: page.page_number,
          section_name: "EXPERIENCE",
          confidence: 1,
        });
      }
    }

    // Verify education against the original source.

    for (const education of profile.education) {
      const position = findOccurrence(
        page.text,
        education.institution
      );

      if (position === -1) continue;

      addEvidence(output, seen, {
        claim_key: "education",
        claim_text:
          `The resume mentions education at ${education.institution}.`,
        source_excerpt: getExcerpt(
          page.text,
          position,
          education.institution.length
        ),
        page_number: page.page_number,
        section_name: "EDUCATION",
        confidence: 1,
      });
    }
  }

  return output.slice(0, 120);
}