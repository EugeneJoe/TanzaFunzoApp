import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getSession, hasRole } from "@/lib/session";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * Issues short-lived tokens for direct browser-to-Blob uploads (resource
 * files in the block builder). This is the only gate between the public
 * internet and our Blob store's write access — anyone who can reach this
 * route without the admin check would get a valid upload token, so the
 * auth check here matters as much as requireRole() does everywhere else.
 *
 * Not using requireRole() itself: it redirect()s on failure, which is built
 * for page/action contexts where Next.js catches that thrown redirect at a
 * known boundary. This callback runs nested inside handleUpload(), not at
 * the route's top level, so a plain thrown Error (turned into a 401 below)
 * is the reliable way to reject here.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const session = await getSession();
        if (!session.userId || !hasRole(session, "admin")) {
          throw new Error("Not authorized");
        }
        return {
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 }
    );
  }
}
