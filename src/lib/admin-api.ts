import { type AdminSession, requireAdminFromRequest, unauthorizedResponse } from "@/lib/admin-auth";
import { assertSameOrigin } from "@/lib/security";

type AdminWriteRequestResult =
  | {
      admin: AdminSession;
      response: null;
    }
  | {
      admin: null;
      response: Response;
    };

export async function requireAdminWriteRequest(request: Request): Promise<AdminWriteRequestResult> {
  const originResponse = await assertSameOrigin(request);

  if (originResponse) {
    return { admin: null, response: originResponse };
  }

  const admin = await requireAdminFromRequest(request);

  if (!admin) {
    return { admin: null, response: unauthorizedResponse() };
  }

  return { admin, response: null };
}
