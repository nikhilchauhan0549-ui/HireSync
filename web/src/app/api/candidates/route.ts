
import {
  connection,
  NextRequest,
  NextResponse,
} from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type JsonRecord = Record<string, unknown>;

export async function GET() {
  await connection();

  try {
    // Authenticate the HR user.
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Please sign in." },
        { status: 401 }
      );
    }

    const admin = createAdminClient();

    // Load only jobs owned by the signed-in user.
    const { data: jobs, error: jobsError } = await admin
      .from("jobs")
      .select("id, title, status")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false });

    if (jobsError) {
      throw new Error(jobsError.message);
    }

    const jobRows = jobs || [];
    const jobIds = jobRows.map((job) => job.id);

    if (jobIds.length === 0) {
      return NextResponse.json({
        success: true,
        jobs: [],
        candidates: [],
      });
    }

    // Load candidates belonging to those jobs.
    const { data: applications, error: applicationsError } =
      await admin
        .from("applications")
        .select(
          "id, job_id, candidate_name, candidate_email, candidate_phone, processing_status, review_status, decision, decision_note, decided_at, created_at"
        )
        .in("job_id", jobIds)
        .order("created_at", { ascending: false });

    if (applicationsError) {
      throw new Error(applicationsError.message);
    }

    const applicationRows = applications || [];
    const applicationIds = applicationRows.map(
      (item) => item.id
    );

    if (applicationIds.length === 0) {
      return NextResponse.json({
        success: true,
        jobs: jobRows,
        candidates: [],
      });
    }

    // Retrieve extraction, assessment and interview feedback history.
    const [
      factsResult,
      assessmentsResult,
      feedbackResult,
    ] = await Promise.all([
      admin
        .from("extracted_facts")
        .select(
          "id, application_id, extracted_json, created_at"
        )
        .in("application_id", applicationIds)
        .order("created_at", { ascending: false }),

      admin
        .from("assessments")
        .select(
          "id, application_id, rubric_version_id, total_score, status, model_provider, model_name, created_at"
        )
        .in("application_id", applicationIds)
        .order("created_at", { ascending: false }),

      admin
        .from("interview_feedback")
        .select(
          "id, interview_id, application_id, interviewer_id, technical_score, communication_score, problem_solving_score, role_fit_score, overall_score, recommendation, strengths, concerns, notes, created_at, updated_at"
        )
        .in("application_id", applicationIds)
        .order("created_at", { ascending: false }),
    ]);

    if (factsResult.error) {
      throw new Error(factsResult.error.message);
    }

    if (assessmentsResult.error) {
      throw new Error(assessmentsResult.error.message);
    }

    if (feedbackResult.error) {
      throw new Error(feedbackResult.error.message);
    }

    // Keep the latest extraction for each application.
    const factMap = new Map<string, {
      id: string;
      application_id: string;
      extracted_json: JsonRecord;
      created_at: string;
    }>();

    for (const fact of factsResult.data || []) {
      if (!factMap.has(fact.application_id)) {
        factMap.set(fact.application_id, {
          ...fact,
          extracted_json: fact.extracted_json as JsonRecord,
        });
      }
    }

    // Keep the latest assessment for each application.
    const assessmentMap = new Map<string, {
      id: string;
      application_id: string;
      rubric_version_id: string;
      total_score: number | null;
      status: string;
      model_provider: string | null;
      model_name: string | null;
      created_at: string;
    }>();

    for (const assessment of assessmentsResult.data || []) {
      if (!assessmentMap.has(assessment.application_id)) {
        assessmentMap.set(
          assessment.application_id,
          assessment
        );
      }
    }

    const latestAssessmentIds = [
      ...assessmentMap.values(),
    ].map((item) => item.id);

    const latestFactIds = [
      ...factMap.values(),
    ].map((item) => item.id);

    // Load criterion-level assessment scores.
    let assessmentCriteria: JsonRecord[] = [];

    if (latestAssessmentIds.length > 0) {
      const { data, error } = await admin
        .from("assessment_criteria")
        .select(
          "id, assessment_id, rubric_criterion_id, score, weight, weighted_contribution, explanation, evidence_ids, evidence_status"
        )
        .in("assessment_id", latestAssessmentIds);

      if (error) {
        throw new Error(error.message);
      }

      assessmentCriteria =
        (data || []) as unknown as JsonRecord[];
    }

    // Load associated rubric labels.
    const criterionIds = [
      ...new Set(
        assessmentCriteria.map((item) =>
          String(item.rubric_criterion_id)
        )
      ),
    ];

    const rubricMap = new Map<string, JsonRecord>();

    if (criterionIds.length > 0) {
      const { data, error } = await admin
        .from("rubric_criteria")
        .select("id, key, label, description, weight")
        .in("id", criterionIds);

      if (error) {
        throw new Error(error.message);
      }

      for (const item of data || []) {
        rubricMap.set(
          item.id,
          item as unknown as JsonRecord
        );
      }
    }

    // Group criterion results by assessment.
    const criteriaMap = new Map<string, JsonRecord[]>();

    for (const item of assessmentCriteria) {
      const assessmentId = String(item.assessment_id);

      const rubric = rubricMap.get(
        String(item.rubric_criterion_id)
      );

      const existing =
        criteriaMap.get(assessmentId) || [];

      existing.push({
        ...item,
        label: rubric?.label || "Scoring criterion",
        key: rubric?.key || "",
      });

      criteriaMap.set(assessmentId, existing);
    }

    // Retrieve evidence belonging to the latest extraction.
    let evidenceRows: JsonRecord[] = [];

    if (latestFactIds.length > 0) {
      const { data, error } = await admin
        .from("evidence")
        .select(
          "id, application_id, extracted_fact_id, claim_key, claim_text, source_excerpt, page_number, section_name, confidence, review_status"
        )
        .in("extracted_fact_id", latestFactIds)
        .order("page_number", { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      evidenceRows =
        (data || []) as unknown as JsonRecord[];
    }

    const evidenceMap = new Map<string, JsonRecord[]>();

    for (const item of evidenceRows) {
      const applicationId = String(item.application_id);

      const existing =
        evidenceMap.get(applicationId) || [];

      existing.push(item);
      evidenceMap.set(applicationId, existing);
    }

    // Retrieve interview and interviewer details for feedback history.
    const feedbackRows = feedbackResult.data || [];

    const interviewIds = [
      ...new Set(feedbackRows.map((item) => item.interview_id)),
    ];

    const interviewerIds = [
      ...new Set(feedbackRows.map((item) => item.interviewer_id)),
    ];

    let interviewRows: JsonRecord[] = [];
    let interviewerRows: JsonRecord[] = [];

    if (interviewIds.length > 0) {
      const { data, error } = await admin
        .from("interviews")
        .select("id, start_at, end_at, status")
        .in("id", interviewIds);

      if (error) {
        throw new Error(error.message);
      }

      interviewRows =
        (data || []) as unknown as JsonRecord[];
    }

    if (interviewerIds.length > 0) {
      const { data, error } = await admin
        .from("interviewers")
        .select("id, name, email")
        .in("id", interviewerIds);

      if (error) {
        throw new Error(error.message);
      }

      interviewerRows =
        (data || []) as unknown as JsonRecord[];
    }

    const interviewMap = new Map<string, JsonRecord>(
      interviewRows.map((item) => [
        String(item.id),
        item,
      ])
    );

    const interviewerMap = new Map<string, JsonRecord>(
      interviewerRows.map((item) => [
        String(item.id),
        item,
      ])
    );

    // Group interview feedback by candidate application.
    const interviewFeedbackMap = new Map<
      string,
      JsonRecord[]
    >();

    for (const feedback of feedbackRows) {
      const applicationId = String(
        feedback.application_id
      );

      const interview = interviewMap.get(
        String(feedback.interview_id)
      );

      const interviewer = interviewerMap.get(
        String(feedback.interviewer_id)
      );

      const historyItem: JsonRecord = {
        id: feedback.id,
        interviewId: feedback.interview_id,

        interviewerId: feedback.interviewer_id,
        interviewerName:
          interviewer?.name || "Unknown interviewer",
        interviewerEmail:
          interviewer?.email || null,

        interviewStartAt:
          interview?.start_at || null,
        interviewEndAt:
          interview?.end_at || null,
        interviewStatus:
          interview?.status || "unknown",

        technicalScore: feedback.technical_score,
        communicationScore:
          feedback.communication_score,
        problemSolvingScore:
          feedback.problem_solving_score,
        roleFitScore: feedback.role_fit_score,
        overallScore: feedback.overall_score,

        recommendation: feedback.recommendation,
        strengths: feedback.strengths,
        concerns: feedback.concerns,
        notes: feedback.notes,

        createdAt: feedback.created_at,
        updatedAt: feedback.updated_at,
      };

      const existing =
        interviewFeedbackMap.get(applicationId) || [];

      existing.push(historyItem);
      interviewFeedbackMap.set(
        applicationId,
        existing
      );
    }

    const jobMap = new Map(
      jobRows.map((job) => [
        job.id,
        job.title,
      ])
    );

    // Assemble complete candidate profiles.
    const candidates = applicationRows.map((application) => {
      const fact = factMap.get(application.id);
      const assessment = assessmentMap.get(application.id);

      return {
        id: application.id,
        jobId: application.job_id,
        jobTitle:
          jobMap.get(application.job_id) || "Job",

        name:
          application.candidate_name || "Unnamed candidate",
        email: application.candidate_email,
        phone: application.candidate_phone,

        processingStatus:
          application.processing_status,
        reviewStatus: application.review_status,
        decision: application.decision,
        decisionNote: application.decision_note,
        decidedAt: application.decided_at,
        createdAt: application.created_at,

        profile: fact?.extracted_json || null,
        extractionId: fact?.id || null,

        assessment: assessment
          ? {
              id: assessment.id,
              totalScore: assessment.total_score,
              status: assessment.status,
              modelProvider: assessment.model_provider,
              modelName: assessment.model_name,
              createdAt: assessment.created_at,
              criteria:
                criteriaMap.get(assessment.id) || [],
            }
          : null,

        evidence:
          evidenceMap.get(application.id) || [],

        // Complete history of interviewer feedback for this candidate.
        interviewFeedback:
          interviewFeedbackMap.get(application.id) || [],
      };
    });

    return NextResponse.json(
      {
        success: true,
        jobs: jobRows,
        candidates,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Candidate management API error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load candidates.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  await connection();

  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Please sign in." },
        { status: 401 }
      );
    }

    const body: unknown = await request.json();

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid request." },
        { status: 400 }
      );
    }

    const payload = body as Record<string, unknown>;

    const applicationId =
      typeof payload.applicationId === "string"
        ? payload.applicationId.trim()
        : "";

    if (!applicationId) {
      return NextResponse.json(
        { success: false, error: "Application ID is required." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // Verify application ownership.
    const { data: application, error: applicationError } =
      await admin
        .from("applications")
        .select("id, job_id")
        .eq("id", applicationId)
        .maybeSingle();

    if (applicationError) {
      throw new Error(applicationError.message);
    }

    if (!application) {
      return NextResponse.json(
        { success: false, error: "Candidate not found." },
        { status: 404 }
      );
    }

    const { data: job, error: jobError } = await admin
      .from("jobs")
      .select("id")
      .eq("id", application.job_id)
      .eq("created_by", user.id)
      .maybeSingle();

    if (jobError || !job) {
      return NextResponse.json(
        { success: false, error: "Access denied." },
        { status: 403 }
      );
    }

    // Save human hiring decision.
    if (payload.action === "decision") {
      const allowed = [
        "pending_review",
        "shortlisted",
        "not_shortlisted",
      ];

      if (
        typeof payload.decision !== "string" ||
        !allowed.includes(payload.decision)
      ) {
        return NextResponse.json(
          { success: false, error: "Invalid decision." },
          { status: 400 }
        );
      }

      const pending =
        payload.decision === "pending_review";

      const note =
        typeof payload.decisionNote === "string"
          ? payload.decisionNote.trim().slice(0, 5000)
          : "";

      const { error } = await admin
        .from("applications")
        .update({
          decision: payload.decision,
          decision_note: note || null,
          review_status: pending
            ? "pending_review"
            : "reviewed",
          decided_by: pending ? null : user.id,
          decided_at: pending
            ? null
            : new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", applicationId);

      if (error) {
        throw new Error(error.message);
      }

      return NextResponse.json({
        success: true,
        message: "Human decision saved.",
      });
    }

    // Save human evidence verification.
    if (payload.action === "evidence") {
      const evidenceId =
        typeof payload.evidenceId === "string"
          ? payload.evidenceId.trim()
          : "";

      const allowedStatuses = [
        "unreviewed",
        "accepted",
        "rejected",
      ];

      if (
        !evidenceId ||
        typeof payload.reviewStatus !== "string" ||
        !allowedStatuses.includes(payload.reviewStatus)
      ) {
        return NextResponse.json(
          { success: false, error: "Invalid evidence review." },
          { status: 400 }
        );
      }

      const { data: evidence, error: evidenceError } =
        await admin
          .from("evidence")
          .update({
            review_status: payload.reviewStatus,
          })
          .eq("id", evidenceId)
          .eq("application_id", applicationId)
          .select("id")
          .maybeSingle();

      if (evidenceError) {
        throw new Error(evidenceError.message);
      }

      if (!evidence) {
        return NextResponse.json(
          { success: false, error: "Evidence record not found." },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Evidence review saved.",
      });
    }

    return NextResponse.json(
      { success: false, error: "Unknown candidate action." },
      { status: 400 }
    );
  } catch (error) {
    console.error("Candidate management POST error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to save candidate review.",
      },
      { status: 500 }
    );
  }
}
