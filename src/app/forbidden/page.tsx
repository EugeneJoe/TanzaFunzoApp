import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-2xl font-semibold">You don&apos;t have access to this page</h1>
      <p className="text-muted-foreground">
        Ask an admin if you think this is a mistake.
      </p>
      <Link href="/" className="text-primary underline underline-offset-4">
        Back to safety
      </Link>
    </div>
  );
}
