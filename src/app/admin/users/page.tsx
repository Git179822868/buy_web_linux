import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin-shell";
import { AdminUsersTable } from "@/components/admin-users-table";
import { getAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const session = await getAdminSession();

  if (!session) {
    redirect("/admin/login");
  }

  const { q, status } = await searchParams;
  const keyword = q?.trim();
  const users = await prisma.user.findMany({
    where: {
      ...(status === "ACTIVE" || status === "DISABLED" ? { status } : {}),
      ...(keyword
        ? {
            OR: [
              { phone: { contains: keyword } },
              { nickname: { contains: keyword } },
            ],
          }
        : {}),
    },
    include: {
      _count: { select: { orders: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <AdminShell username={session.username}>
      <div className="toolbar">
        <div className="section-title" style={{ marginBottom: 0 }}>
          <div>
            <h1>用户管理</h1>
            <p>查看注册用户、余额和账号状态。</p>
          </div>
        </div>
        <form>
          <input defaultValue={keyword || ""} name="q" placeholder="用户账号 / 手机号" />
          <select defaultValue={status || ""} name="status">
            <option value="">全部状态</option>
            <option value="ACTIVE">正常</option>
            <option value="DISABLED">禁用</option>
          </select>
          <button className="primary-button" type="submit">
            查询
          </button>
        </form>
      </div>
      <AdminUsersTable
        users={users.map((user) => ({
          id: user.id,
          userNo: user.userNo,
          phone: user.phone,
          nickname: user.nickname,
          balanceCent: user.balanceCent,
          status: user.status,
          orderCount: user._count.orders,
          createdAt: user.createdAt,
        }))}
      />
    </AdminShell>
  );
}
