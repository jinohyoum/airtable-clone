"use client";

import { signIn } from "next-auth/react";
import Image from "next/image";

export default function SignInPage() {
  const handleGoogleSignIn = async () => {
    try {
      await signIn("google", { callbackUrl: "/", redirect: true });
    } catch (error) {
      console.error("Sign in error:", error);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="w-full max-w-[470px] px-6">
        {/* Airtable Logo */}
        <div className="mb-8">
          <Image
            src="/brand/airtable-logo.svg"
            alt="Airtable"
            width={32}
            height={27}
            priority
          />
        </div>

        {/* Heading */}
        <h1 className="mb-8 text-[32px] font-normal leading-[40px] text-[#1a1a1a]">
          Sign in to Airtable
        </h1>

        {/* Email Input */}
        <div className="mb-4">
          <label
            htmlFor="email"
            className="mb-2 block text-[13px] font-medium text-[#1a1a1a]"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            placeholder="Email address"
            className="h-[40px] w-full rounded-lg border border-[#d0d0d0] px-3 text-[14px] text-[#1a1a1a] placeholder-[#808080] transition-colors focus:border-[#2d7ff9] focus:outline-none focus:ring-1 focus:ring-[#2d7ff9]"
          />
        </div>

        {/* Continue Button */}
        <button
          onClick={(e) => e.preventDefault()}
          className="mb-5 h-[40px] w-full rounded-lg bg-[#2d7ff9] text-[14px] font-medium text-white transition-colors hover:bg-[#2668d4]"
        >
          Continue
        </button>

        {/* Divider */}
        <div className="mb-5 flex items-center justify-center">
          <span className="text-[13px] text-[#808080]">or</span>
        </div>

        {/* SSO Button */}
        <button
          onClick={(e) => e.preventDefault()}
          className="mb-3 flex h-[40px] w-full items-center justify-center rounded-lg border border-[#d0d0d0] bg-white text-[14px] font-medium text-[#1a1a1a] transition-colors hover:bg-[#f5f5f5]"
        >
          Sign in with <span className="ml-1 font-semibold">Single Sign On</span>
        </button>

        {/* Google Button - FUNCTIONAL */}
        <button
          onClick={handleGoogleSignIn}
          className="mb-3 flex h-[40px] w-full items-center justify-center rounded-lg border border-[#d0d0d0] bg-white text-[14px] font-medium text-[#1a1a1a] transition-colors hover:bg-[#f5f5f5]"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            xmlns="http://www.w3.org/2000/svg"
            className="mr-2"
          >
            <g fill="none" fillRule="evenodd">
              <path
                d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
                fill="#4285F4"
              />
              <path
                d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
                fill="#34A853"
              />
              <path
                d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
                fill="#FBBC05"
              />
              <path
                d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
                fill="#EA4335"
              />
            </g>
          </svg>
          Continue with <span className="ml-1 font-semibold">Google</span>
        </button>

        {/* Apple Button */}
        <button
          onClick={(e) => e.preventDefault()}
          className="mb-8 flex h-[40px] w-full items-center justify-center rounded-lg border border-[#d0d0d0] bg-white text-[14px] font-medium text-[#1a1a1a] transition-colors hover:bg-[#f5f5f5]"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            xmlns="http://www.w3.org/2000/svg"
            className="mr-2"
          >
            <path
              d="M14.865 15.825c-.72 1.005-1.5 1.98-2.7 2.01-1.185.03-1.56-.705-2.91-.705-1.35 0-1.77.675-2.895.735-1.155.06-2.07-1.095-2.79-2.1-1.47-2.055-2.595-5.805-1.08-8.34.75-1.26 2.1-2.055 3.555-2.085 1.11-.03 2.16.75 2.835.75.675 0 1.935-.93 3.27-.795.555.024 2.115.225 3.12 1.695-.08.051-1.86 1.089-1.845 3.24.015 2.565 2.25 3.42 2.28 3.435-.015.06-.36 1.23-1.185 2.43l-.655-.27zm-3.27-11.82c.6-.72 1.005-1.725.9-2.73-.87.045-1.92.6-2.535 1.32-.555.645-1.05 1.68-.915 2.67.96.075 1.95-.495 2.55-1.26z"
              fill="#000000"
            />
          </svg>
          Continue with <span className="ml-1 font-semibold">Apple ID</span>
        </button>

        {/* Footer Link */}
        <p className="text-[13px] text-[#808080]">
          New to Airtable?{" "}
          <button
            onClick={(e) => e.preventDefault()}
            className="text-[#2d7ff9] underline"
          >
            Create an account
          </button>{" "}
          instead
        </p>
      </div>

      {/* Help Button - Bottom Left */}
      <button
        className="fixed bottom-6 left-6 flex h-12 w-12 items-center justify-center rounded-full bg-[#2d7ff9] text-white shadow-lg transition-all hover:bg-[#2668d4]"
        aria-label="Help"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"
            fill="currentColor"
            opacity="0.3"
          />
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" fill="none" />
          <path
            d="M12 6v6l4 2"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
