import { MarketHeader } from "@/components/market-header";
import { Storefront } from "@/components/storefront";
import { prisma } from "@/lib/prisma";
import { getUserSession } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const [packages, user] = await Promise.all([
    prisma.servicePackage.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    getUserSession(),
  ]);

  return (
    <div className="market-shell">
      <MarketHeader loginHref="/login" showUserAvatar={Boolean(user)} />
      <main className="market-container">
        <Storefront
          initialQuery={q || ""}
          isSignedIn={Boolean(user)}
          packages={packages.map((item) => ({
            id: item.id,
            name: item.name,
            description: item.description,
            category: item.category,
            categoryLabel: item.categoryLabel,
            filterKey: item.filterKey,
            filterLabel: item.filterLabel,
            platformCode: item.platformCode,
            imageUrl: item.imageUrl,
            unit: item.unit,
            baseQuantity: item.baseQuantity,
            minQuantity: item.minQuantity,
            maxQuantity: item.maxQuantity,
            allowRepeat: item.allowRepeat,
            deliveryTime: item.deliveryTime,
            completionRate: item.completionRate,
            priceCent: item.priceCent,
            currency: item.currency,
          }))}
          supportHref={user ? "/account/support" : `/login?next=${encodeURIComponent("/account/support")}`}
        />
      </main>
    </div>
  );
}
