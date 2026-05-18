import { NextResponse } from "next/server";
import { getCurrentUserJwt } from "@/lib/auth";
import { fetchAppointmentActivity } from "@/lib/appointments";

export async function GET() {
  try {
    const jwt = await getCurrentUserJwt();
    if (!jwt) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const activity = await fetchAppointmentActivity(jwt, 20);
    return NextResponse.json({ data: activity });
  } catch (error) {
    console.error("[API /calendar/activity GET] error:", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
