import { NextResponse } from "next/server";

import { requireAdminWriteRequest } from "@/lib/admin-api";
import { requireAdminFromRequest, unauthorizedResponse } from "@/lib/admin-auth";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { packageSchema, validationErrorMessage } from "@/lib/validation";

function slugSegment(value: string | undefined, fallback: string) {
  const normalized = (value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);

  return normalized || fallback;
}

async function createPackageSlug(input: { category?: string; filterKey?: string; platformCode?: string; slug?: string }) {
  const provided = input.slug?.trim();
  const base = provided || [
    slugSegment(input.platformCode, "bd"),
    slugSegment(input.category, "product"),
    slugSegment(input.filterKey, "normal"),
    Date.now().toString(36),
  ].join("-");

  for (let index = 0; index < 20; index += 1) {
    const suffix = index ? `-${index}` : "";
    const candidate = `${base.slice(0, 80 - suffix.length)}${suffix}`;
    const exists = await prisma.servicePackage.findUnique({ where: { slug: candidate } });

    if (!exists) {
      return candidate;
    }
  }

  return `${base.slice(0, 66)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function GET(request: Request) {
  const admin = await requireAdminFromRequest(request);

  if (!admin) {
    return unauthorizedResponse();
  }

  const packages = await prisma.servicePackage.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ packages });
}

export async function POST(request: Request) {
  try {
    const { admin, response } = await requireAdminWriteRequest(request);

    if (response) {
      return response;
    }

    const input = packageSchema.parse(await request.json());
    const slug = await createPackageSlug(input);
    const servicePackage = await prisma.servicePackage.create({
      data: {
        ...input,
        description: input.description?.trim() || `${input.name} ${input.deliveryTime}`,
        slug,
        currency: "cny",
      },
    });

    await writeAudit({
      admin,
      action: "PACKAGE_CREATE",
      targetType: "package",
      targetId: servicePackage.id,
      detail: { slug: servicePackage.slug },
    });

    return NextResponse.json({ package: servicePackage });
  } catch (error) {
    return NextResponse.json({ message: validationErrorMessage(error, "创建套餐失败") }, { status: 400 });
  }
}
