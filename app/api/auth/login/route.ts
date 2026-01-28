import { redirect } from "next/navigation";

const SSO_UI_URL = process.env.IM_SSO_UI_URL || "http://localhost:8001";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function GET() {
  // Redirect to SSO Login with return URL
  // The SSO UI likely accepts a `redirect` query param
  redirect(`${SSO_UI_URL}/login?redirect=${APP_URL}`);
}
