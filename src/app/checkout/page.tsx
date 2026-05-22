import { redirect } from "next/navigation";

import { CheckoutForm } from "@/components/checkout-form";
import { MarketHeader } from "@/components/market-header";
import { prisma } from "@/lib/prisma";
import { getUserSession } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ packageId?: string }>;
}) {
  const { packageId } = await searchParams;

  if (!packageId) {
    redirect("/");
  }

  const [packageItem, user] = await Promise.all([
    prisma.servicePackage.findFirst({
      where: {
        id: packageId,
        isActive: true,
      },
    }),
    getUserSession(),
  ]);

  if (!packageItem) {
    redirect("/");
  }

  return (
    <div className="market-shell checkout-shell">
      <MarketHeader
        loginHref={`/login?next=${encodeURIComponent(`/checkout?packageId=${packageItem.id}`)}`}
        showUserAvatar={Boolean(user)}
      />
      <main className="market-container">
        <CheckoutForm
          packageItem={{
            id: packageItem.id,
            name: packageItem.name,
            description: packageItem.description,
            category: packageItem.category,
            categoryLabel: packageItem.categoryLabel,
            filterLabel: packageItem.filterLabel,
            imageUrl: packageItem.imageUrl,
            unit: packageItem.unit,
            baseQuantity: packageItem.baseQuantity,
            minQuantity: packageItem.minQuantity,
            maxQuantity: packageItem.maxQuantity,
            allowRepeat: packageItem.allowRepeat,
            deliveryTime: packageItem.deliveryTime,
            completionRate: packageItem.completionRate,
            priceCent: packageItem.priceCent,
            currency: packageItem.currency,
          }}
          user={user}
        />
      </main>
    </div>
  );
}
