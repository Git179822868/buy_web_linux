import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { requireAdminWriteRequest } from "@/lib/admin-api";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";

const allowedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export async function POST(request: Request) {
  const { admin, response } = await requireAdminWriteRequest(request);

  if (response) {
    return response;
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ message: "请先选择图片文件" }, { status: 400 });
  }

  const extension = allowedTypes.get(file.type);

  if (!extension) {
    return NextResponse.json({ message: "仅支持 JPG、PNG、WebP 图片" }, { status: 400 });
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ message: "图片不能超过 5MB" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const uploadDir = path.join(process.cwd(), "public", "uploads", "contact-qr");
  const fileName = `${Date.now()}-${randomUUID()}.${extension}`;
  const filePath = path.join(uploadDir, fileName);

  await mkdir(uploadDir, { recursive: true });
  await writeFile(filePath, bytes);

  const url = `/uploads/contact-qr/${fileName}`;

  await writeAudit({
    admin,
    action: "CONTACT_QR_UPLOAD",
    targetType: "contact_qr",
    targetId: fileName,
    detail: {
      fileName,
      mimeType: file.type,
      size: file.size,
    },
  });

  return NextResponse.json({ url });
}
