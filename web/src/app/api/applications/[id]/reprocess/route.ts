
import {
  connection,
  NextRequest,
  NextResponse,
} from "next/server";

import mammoth from "mammoth";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractResumeFacts } from "@/lib/ai/gemini";
import {
  extractPdfPages,
  buildResumeEvidence,
  type ResumePage,
} from "@/lib/ai/resume-document";
import {
  extractScannedPdfEvidence,
} from "@/lib/ai/scanned-evidence";

const BUCKET = "resumes";
const PDF_MIME = "application/pdf";
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function preserveExistingValue(
  existing: string | null,
  extracted: string | null | undefined
): string | null {
  const current = existing?.trim();

  if (current) {
    return current;
  }

  const next = extracted?.trim();

  return next || null;
}

export async function POST(
  _request: NextRequest,
  context: RouteContext
) {
  await connection();

  let newFactId: string | null = null;
  let committed = false;

  try {
    // 1. Authenticate the HR user.

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Please sign in before reprocessing a resume." },
        { status: 401 }
      );
    }

    // 2. Validate application ID.

    const { id } = await context.params;

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ) {
      return NextResponse.json(
        { error: "Invalid application ID." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // 3. Load existing application details.
    // These values are preserved when already populated.

    const { data: application, error: applicationError } =
      await admin
        .from("applications")
        .select(
          "id, job_id, processing_status, candidate_name, candidate_email, candidate_phone"
        )
        .eq("id", id)
        .maybeSingle();

    if (applicationError) {
      throw new Error(
        `Unable to load application: ${applicationError.message}`
      );
    }

    if (!application) {
      return NextResponse.json(
        { error: "Application not found." },
        { status: 404 }
      );
    }

    // 4. Verify job ownership.

    const { data: job, error: jobError } = await admin
      .from("jobs")
      .select(
        "id, created_by, title, description, required_skills, preferred_skills"
      )
      .eq("id", application.job_id)
      .eq("created_by", user.id)
      .maybeSingle();

    if (jobError) {
      throw new Error(
        `Unable to verify job ownership: ${jobError.message}`
      );
    }

    if (!job) {
      return NextResponse.json(
        { error: "Job not found or access denied." },
        { status: 404 }
      );
    }

    // 5. Locate the original private resume.

    const { data: resumeFile, error: resumeError } =
      await admin
        .from("resume_files")
        .select(
          "storage_path, mime_type, original_file_name"
        )
        .eq("application_id", id)
        .order("uploaded_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (resumeError) {
      throw new Error(
        `Unable to load resume metadata: ${resumeError.message}`
      );
    }

    if (!resumeFile) {
      return NextResponse.json(
        { error: "No stored resume was found." },
        { status: 404 }
      );
    }

    if (
      resumeFile.mime_type !== PDF_MIME &&
      resumeFile.mime_type !== DOCX_MIME
    ) {
      return NextResponse.json(
        { error: "The stored resume format is not supported." },
        { status: 415 }
      );
    }

    // 6. Download the original resume.

    const { data: storedResume, error: downloadError } =
      await admin.storage
        .from(BUCKET)
        .download(resumeFile.storage_path);

    if (downloadError || !storedResume) {
      throw new Error(
        `Unable to download the stored resume: ${
          downloadError?.message || "File not found."
        }`
      );
    }

    const fileBuffer = Buffer.from(
      await storedResume.arrayBuffer()
    );

    if (fileBuffer.length === 0) {
      throw new Error("The stored resume file is empty.");
    }

    // 7. Extract document text where possible.

    let pages: ResumePage[] = [];
    let extractedText: string | undefined;
    let isScannedPdf = false;

    if (resumeFile.mime_type === PDF_MIME) {
      try {
        pages = await extractPdfPages(fileBuffer);

        extractedText = pages
          .map(
            (page) =>
              `PAGE ${page.page_number}\n${page.text}`
          )
          .join("\n\n")
          .slice(0, 60000);
      } catch (pdfError) {
        isScannedPdf = true;

        console.warn(
          "PDF text layer unavailable; using Gemini visual extraction:",
          pdfError
        );
      }
    } else {
      const document = await mammoth.extractRawText({
        buffer: fileBuffer,
      });

      const docxText = document.value.trim();

      if (docxText.length < 30) {
        throw new Error(
          "The DOCX resume contains insufficient readable text."
        );
      }

      extractedText = docxText.slice(0, 60000);

      pages = [
        {
          page_number: 0,
          text: extractedText,
        },
      ];
    }

    // 8. Extract structured candidate information.

    const extraction = await extractResumeFacts({
      mimeType: isScannedPdf
        ? "application/pdf"
        : "text/plain",

      fileBuffer,
      extractedText,

      jobTitle: job.title,
      jobDescription: job.description || "",

      requiredSkills: Array.isArray(job.required_skills)
        ? job.required_skills
        : [],

      preferredSkills: Array.isArray(job.preferred_skills)
        ? job.preferred_skills
        : [],
    });

    // 9. Generate evidence.

    const evidence = isScannedPdf
      ? await extractScannedPdfEvidence({
          fileBuffer,
          jobTitle: job.title,
          skills: extraction.skills,
          workExperience: extraction.work_experience.map(
            (item) => ({
              company: item.company,
              job_title: item.job_title,
              start_date: item.start_date,
              end_date: item.end_date,
            })
          ),
        })
      : buildResumeEvidence(
          pages,
          extraction,
          extraction.evidence
        );

    if (evidence.length === 0) {
      throw new Error(
        "No usable resume evidence was extracted. The previous candidate profile remains unchanged."
      );
    }

    const updatedExtraction = {
      ...extraction,
      evidence,
    };

    // 10. Save a new extraction version.

    const { data: facts, error: factsError } = await admin
      .from("extracted_facts")
      .insert({
        application_id: id,
        extracted_json: updatedExtraction,
        provider: "gemini",
        model:
          process.env.GEMINI_MODEL ||
          "gemini-3.5-flash-lite",
      })
      .select("id")
      .single();

    if (factsError || !facts) {
      throw new Error(
        `Unable to save extracted facts: ${
          factsError?.message || "No record returned."
        }`
      );
    }

    newFactId = facts.id;

    // 11. Save evidence records.

    const evidenceRows = evidence.map((item) => ({
      application_id: id,
      extracted_fact_id: facts.id,
      claim_key: item.claim_key,
      claim_text: item.claim_text,
      source_excerpt: item.source_excerpt,
      page_number: item.page_number,
      section_name: item.section_name,
      confidence: item.confidence,
      review_status: "unreviewed",
    }));

    const { data: savedEvidence, error: evidenceError } =
      await admin
        .from("evidence")
        .insert(evidenceRows)
        .select("id");

    if (evidenceError || !savedEvidence) {
      throw new Error(
        `Unable to save resume evidence: ${
          evidenceError?.message || "No evidence records returned."
        }`
      );
    }

    // 12. Preserve existing candidate details.
    // Gemini only fills fields that are currently empty.

    const finalCandidateName = preserveExistingValue(
      application.candidate_name,
      extraction.full_name
    );

    const finalCandidateEmail = preserveExistingValue(
      application.candidate_email,
      extraction.email
    );

    const finalCandidatePhone = preserveExistingValue(
      application.candidate_phone,
      extraction.phone
    );

    const { error: updateError } = await admin
      .from("applications")
      .update({
        candidate_name: finalCandidateName,
        candidate_email: finalCandidateEmail,
        candidate_phone: finalCandidatePhone,
        processing_status: "processed",
      })
      .eq("id", id);

    if (updateError) {
      throw new Error(
        `Unable to update candidate details: ${updateError.message}`
      );
    }

    committed = true;

    // Return the preserved candidate details alongside
    // the newly extracted resume information.

    const candidateResult = {
      ...updatedExtraction,
      full_name: finalCandidateName,
      email: finalCandidateEmail,
      phone: finalCandidatePhone,
    };

    return NextResponse.json(
      {
        success: true,
        message: isScannedPdf
          ? "Scanned resume processed using Gemini visual extraction. Evidence requires human verification. Existing candidate details were preserved."
          : "Resume reprocessed successfully. Existing candidate details were preserved.",

        applicationId: id,
        extractionId: facts.id,
        candidate: candidateResult,
        evidenceCount: savedEvidence.length,
        workExperienceCount:
          updatedExtraction.work_experience.length,
        skillsCount: updatedExtraction.skills.length,
        experienceYears:
          updatedExtraction.total_experience_years,

        candidateDetailsPreserved: true,

        evidenceMode: isScannedPdf
          ? "visual_ocr_unverified"
          : "text_verified",

        processingStatus: "processed",
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Resume reprocessing error:", error);

    // Clean up only incomplete records from this new extraction.
    // Preserve previous candidate records and evidence.

    if (newFactId && !committed) {
      const admin = createAdminClient();

      await admin
        .from("evidence")
        .delete()
        .eq("extracted_fact_id", newFactId);

      await admin
        .from("extracted_facts")
        .delete()
        .eq("id", newFactId);
    }

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected resume reprocessing error.",
      },
      { status: 500 }
    );
  }
}
