import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET() {
  const user = await getSession();

  if (!user) {
    const response = NextResponse.json(
      { authenticated: false },
      { status: 401 },
    );
    // response.cookies.delete(process.env.COOKIE_NAME || "im.sso.sid");
    return response;
  }

  return NextResponse.json({ authenticated: true, user });
}
