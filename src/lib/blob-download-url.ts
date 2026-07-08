import "server-only";
import { issueSignedToken, presignUrl } from "@vercel/blob";

// Generated fresh on every render (these pages aren't cached), so a short
// TTL is fine — it only needs to outlive the single response it's embedded
// in, not survive a page reload.
const TTL_MS = 10 * 60 * 1000;

/**
 * The Blob store is configured for private access (data-model.md doesn't
 * mandate either way; this project's store just happens to be private), so
 * a stored file's raw URL can't be used as a plain download link — it needs
 * a short-lived signed URL, regenerated per request.
 */
export async function getSignedDownloadUrl(pathname: string): Promise<string> {
  const validUntil = Date.now() + TTL_MS;
  const signedToken = await issueSignedToken({ pathname, operations: ["get"], validUntil });
  const { presignedUrl } = await presignUrl(
    { clientSigningToken: signedToken.clientSigningToken, delegationToken: signedToken.delegationToken },
    { operation: "get", pathname, validUntil, access: "private" }
  );
  return presignedUrl;
}
