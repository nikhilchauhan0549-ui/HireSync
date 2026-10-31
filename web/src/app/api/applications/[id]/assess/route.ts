import {
  connection,
  NextRequest,
  NextResponse,
} from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assessApplication,
  AssessmentError,
} from "@/lib/ai/assessment";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(
  _request: NextRequest,
  context: RouteContext
) {
  await connection();

  try {
    // 1. Authenticate the user.

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "Please sign in before assessing a candidate.",
        },
        { status: 401 }
      );
    }

    // 2. Validate the application ID.

    const { id } = await context.params;

    if (
      !id ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid application ID.",
        },
        { status: 400 }
      );
    }

    // 3. Create the privileged database client.
    // The assessment service independently verifies job ownership.

    const admin = createAdminClient();

    const result = await assessApplication(
      id,
      user.id,
      admin
    );

    return NextResponse.json(
      {
        success: true,
        message: "Candidate assessment completed.",
        assessment: result,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Candidate assessment error:", error);

    const statusCode =
      error instanceof AssessmentError
        ? error.statusCode
        : 500;

    const message =
      error instanceof Error
        ? error.message
        : "Unexpected assessment error.";

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: statusCode }
    );
  }
}