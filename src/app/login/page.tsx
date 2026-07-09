import { TRIANGLE_WATERMARK } from "@/lib/brand";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="flex flex-1">
      <div
        className="hidden w-[46%] shrink-0 flex-col items-center justify-center bg-navy bg-[length:90px_78px] p-8 md:flex"
        style={{ backgroundImage: TRIANGLE_WATERMARK }}
      >
        <div className="text-center">
          <p className="font-heading text-[40px] font-semibold tracking-[6px] text-white uppercase">Tanza</p>
          <p className="mt-2 font-heading text-[15px] font-semibold tracking-[4px] text-orange uppercase">
            Fellowship Hub
          </p>
          <div className="mx-auto my-[26px] h-px w-10 bg-white/[0.18]" />
          <p className="mx-auto max-w-[260px] text-sm leading-relaxed text-[#9FB0C8]">
            Leadership development for Tanzania&rsquo;s changemakers.
          </p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center bg-white p-4">
        <div className="w-full max-w-[360px]">
          <h1 className="mb-6 font-heading text-[26px] font-semibold text-navy-900">Log in</h1>
          <LoginForm next={next} />
        </div>
      </div>
    </div>
  );
}
