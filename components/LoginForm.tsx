"use client";

import { useActionState, useState, useEffect } from "react";
import { requestOtp, verifyOtp } from "../app/actions";
import { User, KeyRound, Loader2, ArrowRight } from "lucide-react";

interface LoginState {
  error?: string;
  success: boolean;
  message?: string;
  reference?: string;
}

const initialState: LoginState = {
  error: "",
  success: false,
  message: "",
  reference: "",
};

export function LoginForm() {
  const [step, setStep] = useState<"INPUT_ID" | "INPUT_OTP">("INPUT_ID");
  const [employeeId, setEmployeeId] = useState("");

  const [requestState, requestAction, isRequestPending] = useActionState<
    LoginState,
    FormData
  >(requestOtp, initialState);
  const [verifyState, verifyAction, isVerifyPending] = useActionState<
    LoginState,
    FormData
  >(verifyOtp, initialState);

  useEffect(() => {
    if (requestState.success) {
      setStep("INPUT_OTP");
    }
  }, [requestState.success]);

  const handleIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmployeeId(e.target.value);
  };

  return (
    <div className="space-y-6">
      {step === "INPUT_ID" && (
        <form action={requestAction} className="space-y-6">
          <div className="space-y-2">
            <label
              htmlFor="employeeId"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-gray-200"
            >
              Employee ID
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                id="employeeId"
                name="employeeId"
                required
                value={employeeId}
                onChange={handleIdChange}
                className="flex h-10 w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 pl-10 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
                placeholder="Enter your Employee ID"
              />
            </div>
          </div>

          {requestState?.error && (
            <div className="text-sm text-red-500 bg-red-500/10 p-3 rounded-md border border-red-500/20">
              {requestState.error}
            </div>
          )}

          <button
            type="submit"
            disabled={isRequestPending}
            className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isRequestPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Requesting OTP...
              </>
            ) : (
              <>
                Get OTP
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </button>
        </form>
      )}

      {step === "INPUT_OTP" && (
        <form action={verifyAction} className="space-y-6">
          {/* Hidden field to pass employeeId to the verify action */}
          <input type="hidden" name="employeeId" value={employeeId} />

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label
                htmlFor="otp"
                className="text-sm font-medium leading-none text-gray-200"
              >
                One-Time Password
              </label>
              {requestState.reference && (
                <span className="text-xs text-gray-400 font-mono">
                  Ref: {requestState.reference}
                </span>
              )}
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <KeyRound className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                id="otp"
                name="otp"
                required
                autoComplete="one-time-code"
                className="flex h-10 w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 pl-10 text-center text-sm tracking-widest placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
                placeholder="000000"
              />
            </div>
            <p className="text-xs text-gray-500">
              Please enter the OTP sent to your registered device.
            </p>
          </div>

          {verifyState?.error && (
            <div className="text-sm text-red-500 bg-red-500/10 p-3 rounded-md border border-red-500/20">
              {verifyState.error}
            </div>
          )}

          <div className="space-y-3">
            <button
              type="submit"
              disabled={isVerifyPending}
              className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isVerifyPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Sign In"
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep("INPUT_ID");
              }}
              className="w-full text-sm text-gray-400 hover:text-white hover:underline transition-colors"
            >
              Back to Employee ID
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
