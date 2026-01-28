import { cookies } from "next/headers";
import { prisma } from "./prisma";

const SSO_URL = process.env.IM_SSO_URL || "http://localhost:4000";
const COOKIE_NAME = process.env.COOKIE_NAME || "staging.im.sso.sid";

export interface SSOUser {
  userId: string;
  username: string;
  firstNameTH?: string;
  lastNameTH?: string;
  firstNameEN?: string;
  lastNameEN?: string;
  nickNameTH?: string;
  nickNameEN?: string;
  email?: string;
  imgUrl?: string;
  userGroups?: any[];
}

export async function getSession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(COOKIE_NAME);

  console.log("[getSession] SSO_URL:", SSO_URL);
  console.log("[getSession] COOKIE_NAME:", COOKIE_NAME);

  if (!sessionCookie) {
    console.log("[getSession] No session cookie found");
    // Verify cookie name
    const allCookies = cookieStore.getAll();
    console.log(
      "[getSession] All cookies available:",
      allCookies.map((c) => c.name),
    );
    return null;
  }

  try {
    const cookieHeader = `${COOKIE_NAME}=${encodeURIComponent(sessionCookie.value)}`;
    console.log("[getSession] Sending Cookie Header:", cookieHeader);
    const res = await fetch(`${SSO_URL}/authen/is-logged-in`, {
      headers: {
        Cookie: cookieHeader,
      },
    });

    console.log("[getSession] is-logged-in status:", res.status);

    if (!res.ok) {
      console.log("[getSession] is-logged-in failed");
      return null;
    }

    const data = await res.json();
    console.log("[getSession] is-logged-in data:", JSON.stringify(data));
    if (!data.isLoggedIn || !data.user) {
      return null;
    }

    const ssoUser = data.user as SSOUser;

    // Determine role
    let role: "USER" | "ADMIN" = "USER";
    if (ssoUser.userGroups && Array.isArray(ssoUser.userGroups)) {
      const isAdmin = ssoUser.userGroups.some(
        (ug: any) =>
          ug?.group?.role === "ADMIN" || ug?.group?.role === "SUPER_ADMIN",
      );
      if (isAdmin) role = "ADMIN";
    }

    // Upsert user in local DB
    const user = await prisma.user.upsert({
      where: { ssoId: ssoUser.userId },
      update: {
        username: ssoUser.username || ssoUser.userId,
        firstName: ssoUser.firstNameEN || ssoUser.firstNameTH,
        lastName: ssoUser.lastNameEN || ssoUser.lastNameTH,
        avatarUrl: ssoUser.imgUrl,
        role: role,
      },
      create: {
        ssoId: ssoUser.userId,
        username: ssoUser.username || ssoUser.userId,
        firstName: ssoUser.firstNameEN || ssoUser.firstNameTH,
        lastName: ssoUser.lastNameEN || ssoUser.lastNameTH,
        avatarUrl: ssoUser.imgUrl,
        role: role,
      },
    });

    return user;
  } catch (error) {
    console.error("Auth Error:", error);
    return null;
  }
}
