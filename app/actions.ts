"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const SSO_URL = process.env.IM_SSO_URL || "http://localhost:4000";
console.log("Loaded SSO_URL:", SSO_URL);
console.log("process.env.IM_SSO_URL:", process.env.IM_SSO_URL);
const COOKIE_NAME = process.env.COOKIE_NAME || "staging.im.sso.sid";

export async function requestOtp(prevState: any, formData: FormData) {
  const employeeId = formData.get("employeeId") as string;
  console.log("SSO_URL:", SSO_URL);
  console.log("Requesting OTP for:", employeeId);

  if (!employeeId) {
    return { error: "Employee ID is required", success: false };
  }

  try {
    const res = await fetch(
      `${SSO_URL}/authen/otp/${employeeId}?signature=dummy_sig`,
      {
        method: "GET",
      },
    );

    const data = await res.json();

    if (!res.ok) {
      let errorMessage = data.message || "Failed to request OTP";
      if (typeof errorMessage === "object") {
        errorMessage = JSON.stringify(errorMessage);
      }
      return { error: errorMessage, success: false };
    }

    return {
      success: true,
      reference: data.reference,
      message: "OTP sent successfully",
    };
  } catch (error) {
    console.error("Request OTP error:", error);
    return {
      error: "An unexpected error occurred. Please try again.",
      success: false,
    };
  }
}

export async function verifyOtp(prevState: any, formData: FormData) {
  const employeeId = formData.get("employeeId") as string;
  const otp = formData.get("otp") as string;

  if (!employeeId || !otp) {
    return { error: "Employee ID and OTP are required", success: false };
  }

  try {
    const res = await fetch(`${SSO_URL}/authen/authorize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: employeeId,
        password: otp,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      let errorMessage =
        data.message || "Verification failed. Please check your OTP.";
      if (typeof errorMessage === "object") {
        errorMessage = JSON.stringify(errorMessage);
      }
      return {
        error: errorMessage,
        success: false,
      };
    }

    const setCookieHeader = res.headers.get("set-cookie");
    console.log("[verifyOtp] Set-Cookie Header:", setCookieHeader);

    if (setCookieHeader) {
      const match = setCookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
      if (match && match[1]) {
        console.log("[verifyOtp] Parsed Cookie Value (raw):", match[1]);
        try {
          console.log(
            "[verifyOtp] Decoded Cookie Value:",
            decodeURIComponent(match[1]),
          );
        } catch (e) {
          console.log("[verifyOtp] Could not decode cookie value");
        }
        const cookieStore = await cookies();
        let cookieValue = match[1];
        try {
          cookieValue = decodeURIComponent(match[1]);
        } catch (e) {
          console.error("Failed to decode cookie", e);
        }

        cookieStore.set({
          name: COOKIE_NAME,
          value: cookieValue,
          httpOnly: true,
          path: "/",
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
        });
      }
    } else {
      console.warn(
        "Login successful but no Set-Cookie header received from SSO.",
      );
    }

    // We don't return here if successful, we redirect.
    // Typescript might complain if the return type isn't compatible with what useActionState expects for all paths,
    // but redirect() throws "NEXT_REDIRECT" error which is handled by Next.js.
  } catch (error) {
    console.error("Verify OTP error:", error);
    return {
      error: "An unexpected error occurred. Please try again.",
      success: false,
    };
  }

  redirect("/");
}
