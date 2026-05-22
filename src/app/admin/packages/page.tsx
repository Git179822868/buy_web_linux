import { redirect } from "next/navigation";

import { AdminPackagesManager } from "@/components/admin-packages-manager";
import { AdminShell } from "@/components/admin-shell";
import { getAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminPackagesPage() {
  const session = await getAdminSession();

  if (!session) {
    redirect("/admin/login");
  }

  const packages = await prisma.servicePackage.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return (
    <AdminShell username={session.username}>
      <div className="section-title">
        <div>
          <h1>商品管理</h1>
          <p>管理商品图片、前台分类、数量范围、价格和上架状态。</p>
        </div>
      </div>
      <AdminPackagesManager
        packages={packages.map((item) => ({
          id: item.id,
          slug: item.slug,
          name: item.name,
          description: item.description,
          category: item.category,
          categoryLabel: item.categoryLabel,
          filterKey: item.filterKey,
          filterLabel: item.filterLabel,
          platformCode: item.platformCode,
          imageUrl: item.imageUrl,
          unit: item.unit,
          productType: item.productType,
          priceTemplate: item.priceTemplate,
          baseQuantity: item.baseQuantity,
          minQuantity: item.minQuantity,
          maxQuantity: item.maxQuantity,
          allowRepeat: item.allowRepeat,
          deliveryTime: item.deliveryTime,
          completionRate: item.completionRate,
          priceCent: item.priceCent,
          currency: item.currency,
          sortOrder: item.sortOrder,
          isActive: item.isActive,
        }))}
      />
    </AdminShell>
  );
}
