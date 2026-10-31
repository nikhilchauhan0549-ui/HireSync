import {
  connection,
  NextResponse,
} from "next/server";

import { GoogleGenAI } from "@google/genai";

export async function GET() {
  await connection();

  const apiKey = process.env.GEMINI_API_KEY;

  const model =
    process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

  if (!apiKey) {
    return NextResponse.json(
      {
        success: false,
        error: "GEMINI_API_KEY is not configured.",
      },
      { status: 500 }
    );
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model,
      contents: "Reply exactly: HIRESYNC_GEMINI_OK",
      config: {
        temperature: 0,
        maxOutputTokens: 30,
      },
    });

    const result = response.text?.trim() || "";

    if (!result.includes("HIRESYNC_GEMINI_OK")) {
      return NextResponse.json(
        {
          success: false,
          provider: "gemini",
          model,
          error: "Gemini returned an unexpected response.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      provider: "gemini",
      model,
      message: "HIRESYNC_GEMINI_OK",
    });
  } catch (error) {
    console.error("Gemini health check failed:", error);

    return NextResponse.json(
      {
        success: false,
        provider: "gemini",
        model,
        error:
          error instanceof Error
            ? error.message
            : "Gemini connection failed.",
      },
      { status: 502 }
    );
  }
}