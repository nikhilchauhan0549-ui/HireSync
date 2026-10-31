
import {
  connection,
  NextRequest,
  NextResponse,
} from "next/server";

import { createHash, randomUUID } from "node:crypto";
import mammoth from "mammoth";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractResumeFacts } from "@/lib/ai/gemini";

const MAX_FILE_SIZE = 12 * 1024 * 1024;
const BUCKET = "resumes";

const PDF_MIME = "application/pdf";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type ProcessingAdmin = ReturnType<typeof createAdminClient>;

export async function POST(request: NextRequest) {
  await connection();

  let admin: ProcessingAdmin | null = null;
  let applicationId: string | null = null;
  let storagePath: string | null = null;
  let resumeRecordCreated = false;

  try {
    // 1. Authenticate the HR user.

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          error: "Please sign in before uploading a resume.",
        },
        { status: 401 }
      );
    }

    // 2. Accept only job ID and resume file.
    // Candidate details will be extracted by Gemini.

    const formData = await request.formData();

    const jobId = String(
      formData.get("jobId") ?? ""
    ).trim();

    const file = formData.get("file");

    if (!jobId) {
      return NextResponse.json(
        { error: "Select a job before uploading." },
        { status: 400 }
      );
    }

    if (
      !(file instanceof File) ||
      file.size === 0 ||
      file.size > MAX_FILE_SIZE
    ) {
      return NextResponse.json(
        { error: "Choose a resume file up to 12 MB." },
        { status: 400 }
      );
    }

    // 3. Verify that this user owns the selected job.

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select(
        "id, title, description, required_skills, preferred_skills, status"
      )
      .eq("id", jobId)
      .eq("created_by", user.id)
      .maybeSingle();

    if (jobError) {
      console.error(
        "Upload job lookup failed:",
        jobError.message
      );

      return NextResponse.json(
        { error: "Unable to verify the selected job." },
        { status: 500 }
      );
    }

    if (!job) {
      return NextResponse.json(
        { error: "Job not found or access denied." },
        { status: 404 }
      );
    }

    if (job.status === "archived") {
      return NextResponse.json(
        {
          error: "Cannot add candidates to an archived job.",
        },
        { status: 409 }
      );
    }

    // 4. Validate PDF or DOCX.

    const lowerName = file.name.toLowerCase();

    const isPdf =
      lowerName.endsWith(".pdf") &&
      file.type === PDF_MIME;

    const isDocx =
      lowerName.endsWith(".docx") &&
      file.type === DOCX_MIME;

    if (!isPdf && !isDocx) {
      return NextResponse.json(
        {
          error: "Only PDF and DOCX resumes are supported.",
        },
        { status: 415 }
      );
    }

    const fileBuffer = Buffer.from(
      await file.arrayBuffer()
    );

    // Check basic file signatures.

    if (
      isPdf &&
      fileBuffer.subarray(0, 5).toString() !== "%PDF-"
    ) {
      return NextResponse.json(
        { error: "The selected file is not a valid PDF." },
        { status: 400 }
      );
    }

    if (
      isDocx &&
      (
        fileBuffer.length < 4 ||
        fileBuffer[0] !== 0x50 ||
        fileBuffer[1] !== 0x4b
      )
    ) {
      return NextResponse.json(
        { error: "The selected file is not a valid DOCX document." },
        { status: 400 }
      );
    }

    // 5. Extract text from DOCX files.
    // PDFs will be passed directly to Gemini.

    let extractedText: string | undefined;

    if (isDocx) {
      const document = await mammoth.extractRawText({
        buffer: fileBuffer,
      });

      extractedText = document.value.trim();

      if (extractedText.length < 30) {
        return NextResponse.json(
          {
            error: "The DOCX file contains insufficient readable text.",
          },
          { status: 422 }
        );
      }

      extractedText = extractedText.slice(0, 60000);
    }

    // 6. Initialize privileged access only after authentication
    // and job ownership have been verified.

    admin = createAdminClient();

    // 7. Create an application with NULL candidate details.
    // These database columns were confirmed nullable.

    const {
      data: application,
      error: applicationError,
    } = await admin
      .from("applications")
      .insert({
        job_id: job.id,
        candidate_name: null,
        candidate_email: null,
        candidate_phone: null,
        processing_status: "processing",
      })
      .select("id")
      .single();

    if (applicationError || !application) {
      console.error(
        "Application creation failed:",
        applicationError?.message
      );

      return NextResponse.json(
        {
          error: "Unable to create the candidate application.",
        },
        { status: 500 }
      );
    }

    applicationId = application.id;

    // 8. Store the original resume in private Supabase Storage.

    const safeFileName =
      file.name
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .slice(-100) || "resume";

    storagePath =
      `${user.id}/${job.id}/${applicationId}/` +
      `${randomUUID()}-${safeFileName}`;

    const mimeType = isPdf ? PDF_MIME : DOCX_MIME;

    const { error: storageError } = await admin.storage
      .from(BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (storageError) {
      console.error(
        "Resume storage failed:",
        storageError.message
      );

      throw new Error(
        "Unable to save the resume in private storage."
      );
    }

    // 9. Save resume file metadata and SHA-256 hash.

    const sha256 = createHash("sha256")
      .update(fileBuffer)
      .digest("hex");

    const { error: resumeError } = await admin
      .from("resume_files")
      .insert({
        application_id: applicationId,
        storage_path: storagePath,
        original_file_name: file.name,
        mime_type: mimeType,
        file_size_bytes: file.size,
        sha256,
      });

    if (resumeError) {
      console.error(
        "Resume metadata failed:",
        resumeError.message
      );

      throw new Error("Unable to save resume metadata.");
    }

    resumeRecordCreated = true;

    // 10. Ask Gemini to extract candidate information.

    const extraction = await extractResumeFacts({
      mimeType: isPdf
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

    // 11. Save structured extracted facts.

    const { data: facts, error: factsError } = await admin
      .from("extracted_facts")
      .insert({
        application_id: applicationId,
        extracted_json: extraction,
        provider: "gemini",
        model:
          process.env.GEMINI_MODEL ||
          "gemini-3.5-flash-lite",
      })
      .select("id")
      .single();

    if (factsError || !facts) {
      console.error(
        "Extracted facts save failed:",
        factsError?.message
      );

      throw new Error(
        "Unable to save extracted candidate information."
      );
    }

    // 12. Save resume evidence for human verification.

    if (extraction.evidence.length > 0) {
      const evidenceRows = extraction.evidence.map(
        (item) => ({
          application_id: applicationId,
          extracted_fact_id: facts.id,
          claim_key: item.claim_key,
          claim_text: item.claim_text,
          source_excerpt: item.source_excerpt,
          page_number: item.page_number,
          section_name: item.section_name,
          confidence: item.confidence,
          review_status: "unreviewed",
        })
      );

      const { error: evidenceError } = await admin
        .from("evidence")
        .insert(evidenceRows);

      if (evidenceError) {
        console.error(
          "Evidence save failed:",
          evidenceError.message
        );

        throw new Error("Unable to save resume evidence.");
      }
    }

    // 13. Update candidate details using Gemini's extraction.
    // Missing information remains NULL.

    const { error: updateError } = await admin
      .from("applications")
      .update({
        candidate_name: extraction.full_name || null,
        candidate_email: extraction.email || null,
        candidate_phone: extraction.phone || null,
        processing_status: "processed",
      })
      .eq("id", applicationId);

    if (updateError) {
      console.error(
        "Application update failed:",
        updateError.message
      );

      throw new Error(
        "Unable to finalize candidate processing."
      );
    }

    // 14. Return the extracted profile.

    return NextResponse.json(
      {
        success: true,
        message: "Resume uploaded and processed successfully.",
        applicationId,
        candidate: extraction,
        fileName: file.name,
        processingStatus: "processed",
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );

  } catch (error) {
    console.error("Resume upload error:", error);

    // Keep the failed application record for diagnosis.
    // Mark the application as failed instead of losing it.

    if (admin && applicationId) {
      const { error: updateError } = await admin
        .from("applications")
        .update({
          processing_status: "failed",
        })
        .eq("id", applicationId);

      if (updateError) {
        console.error(
          "Failed to update application status:",
          updateError.message
        );
      }

      // Remove the stored object only when its metadata
      // was not successfully saved.

      if (storagePath && !resumeRecordCreated) {
        const { error: removeError } = await admin.storage
          .from(BUCKET)
          .remove([storagePath]);

        if (removeError) {
          console.error(
            "Failed to clean up resume object:",
            removeError.message
          );
        }
      }
    }

    const message =
      error instanceof Error
        ? error.message
        : "Unexpected resume processing error.";

    return NextResponse.json(
      {
        success: false,
        error: message,
        applicationId,
        processingStatus: applicationId
          ? "failed"
          : undefined,
      },
      { status: 500 }
    );
  }
}
