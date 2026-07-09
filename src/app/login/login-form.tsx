"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {next && <input type="hidden" name="next" value={next} />}
      <div className="flex flex-col gap-2">
        <Label htmlFor="email" className="font-heading text-[13px] font-semibold text-navy-900">
          Email
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="h-auto rounded-lg border-input px-[15px] py-3 text-[15px] text-text-input"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password" className="font-heading text-[13px] font-semibold text-navy-900">
          Password
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-auto rounded-lg border-input px-[15px] py-3 text-[15px] text-text-input"
        />
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={isPending} className="mt-1 h-auto rounded-lg py-3.5 font-heading text-[15px]">
        {isPending ? "Logging in…" : "Log in"}
      </Button>
      <p className="text-center text-sm text-text-faint">
        Need an account?{" "}
        <Link href="/signup" className="font-semibold text-orange hover:text-orange-hover">
          Sign up
        </Link>
      </p>
    </form>
  );
}
