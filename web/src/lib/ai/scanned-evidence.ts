import "server-only";

import { GoogleGenAI, Type } from "@google/genai";

type ScannedEvidenceInput = {
  fileBuffer: Buffer;
  jobTitle: string;
  skills: string[];
  workExperience: {
    company: string;
    job_title: string;
    start_date: string;
    end_date: string;
  }[];
};

export type ScannedEvidence = {
  claim_key: string;
  claim_text: string;
  source_excerpt: string;
  page_number: number;
  section_name: string;
  confidence: number;
};

const evidenceSchema = {
  type: Type.OBJECT,
  properties: {
    evidence: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          claim_key: { type: Type.STRING },
          claim_text: { type: Type.STRING },
          source_excerpt: { type: Type.STRING },
          page_number: { type: Type.INTEGER },
          section_name: { type: Type.STRING },
          confidence: { type: Type.NUMBER },
        },
        required: [
          "claim_key",
          "claim_text",
          "source_excerpt",
          "page_number",
          "section_name",
          "confidence",
        ],
      },
    },
  },
  required: ["evidence"],
};

function asRecord(value: unknown): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new Error("Gemini returned invalid evidence data.");
  }

  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : 0;
}

export async function extractScannedPdfEvidence(
  input: ScannedEvidenceInput
): Promise<ScannedEvidence[]> {
  const apiKey = process.env.GEMINI_API_KEY;

  const model =
    process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const prompt = `
You are a careful visual resume transcription and evidence extraction system.

The attached PDF may contain scanned pages or images rather than searchable text.

JOB TITLE:
${input.jobTitle}

EXTRACTED SKILLS TO CHECK:
${JSON.stringify(input.skills)}

EXTRACTED WORK HISTORY TO CHECK:
${JSON.stringify(input.workExperience)}

TASK:
Visually inspect every page of the attached original PDF.

Extract short, exact, readable excerpts that support the candidate's actual qualifications.

IMPORTANT RULES:
1. Read the PDF itself. Do not use the supplied profile as proof.
2. The supplied skills and work history are search hints only.
3. Never invent words, company names, dates, job titles, technical skills or responsibilities.
4. Do not paraphrase inside source_excerpt. Transcribe a short contiguous passage as it appears on the page.
5. Do not create evidence for a claim unless the page visibly supports it.
6. For each visible employment entry, try to capture the company, job title, dates and relevant responsibility excerpts.
7. Capture technical skills only when visibly printed in the PDF.
8. Prefer specific technical responsibilities and project descriptions over generic statements.
9. Keep excerpts short, ideally 20-80 words.
10. Use the actual one-based PDF page number.
11. Use claim_key "work_experience" for employment evidence.
12. Use claim_key "skills" for explicitly listed or demonstrated skills.
13. Use claim_key "education" for education evidence.
14. Use claim_key "projects" for project evidence.
15. If a word is unreadable, omit it rather than guessing.
16. Do not produce a hiring score or hiring recommendation.
17. Return an empty evidence array if no qualifying text is visually readable.
18. Return only JSON matching the supplied schema.

The evidence will be checked by a human because visual transcription may contain OCR errors.
`;

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model,
    contents: [
      { text: prompt },
      {
        inlineData: {
          mimeType: "application/pdf",
          data: input.fileBuffer.toString("base64"),
        },
      },
    ],
    config: {
      temperature: 0.1,
      responseMimeType: "application/json",
      responseSchema: evidenceSchema,
      maxOutputTokens: 8192,
    },
  });

  const responseText =
    response.text?.trim() ||
    response.candidates
      ?.flatMap(
        (candidate) => candidate.content?.parts ?? []
      )
      .map((part) => part.text ?? "")
      .join("")
      .trim();

  if (!responseText) {
    throw new Error(
      "Gemini returned no visual resume evidence."
    );
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(responseText);
  } catch {
    throw new Error(
      "Gemini returned invalid visual evidence JSON."
    );
  }

  const data = asRecord(parsed);

  if (!Array.isArray(data.evidence)) {
    throw new Error(
      "Gemini did not return an evidence array."
    );
  }

  const seen = new Set<string>();

  return data.evidence
    .map((item): ScannedEvidence | null => {
      const row = asRecord(item);

      const claimKey = asString(row.claim_key);
      const claimText = asString(row.claim_text);
      const sourceExcerpt = asString(row.source_excerpt);
      const sectionName = asString(row.section_name);
      const pageNumber = Math.floor(
        Math.max(1, asNumber(row.page_number))
      );

      const allowedKeys = new Set([
        "work_experience",
        "skills",
        "education",
        "projects",
      ]);

      if (
        !allowedKeys.has(claimKey) ||
        !claimText ||
        sourceExcerpt.length < 12 ||
        !sectionName
      ) {
        return null;
      }

      const uniqueKey =
        `${claimKey}|${pageNumber}|${sourceExcerpt.toLowerCase()}`;

      if (seen.has(uniqueKey)) {
        return null;
      }

      seen.add(uniqueKey);

      return {
        claim_key: claimKey,
        claim_text: claimText,
        source_excerpt: sourceExcerpt.slice(0, 1200),
        page_number: pageNumber,
        section_name: `AI_OCR_UNVERIFIED: ${sectionName}`,
        // These are AI-transcribed excerpts, not independently
        // verified text-layer excerpts.
        confidence: Math.min(
          0.75,
          Math.max(0.1, asNumber(row.confidence))
        ),
      };
    })
    .filter(
      (item): item is ScannedEvidence => item !== null
    )
    .slice(0, 100);
}