import { NextResponse } from "next/server";
import { validateSongLibrary, validateSongSubmission, type SongValidationInput } from "@/lib/songs/validation";

export const dynamic = "force-static";

export async function GET() {
  const report = await validateSongLibrary();
  return NextResponse.json(report, { status: report.valid ? 200 : 422 });
}

export async function POST(request: Request) {
  let payload: SongValidationInput;

  try {
    payload = (await request.json()) as SongValidationInput;
  } catch {
    return NextResponse.json(
      {
        valid: false,
        issues: [{ message: "Request body must be valid JSON" }],
        checked: { songs: 0, abcFiles: 0 },
      },
      { status: 400 }
    );
  }

  const report = validateSongSubmission(payload);
  return NextResponse.json(report, { status: report.valid ? 200 : 422 });
}
