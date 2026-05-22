"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { formatMoney } from "@/lib/money";

type AdminUserRow = {
  id: string;
  userNo: number;
  phone: string;
  nickname: string | null;
  balanceCent: number;
  status: "ACTIVE" | "DISABLED";
  orderCount: number;
  createdAt: string | Date;
};

export function AdminUsersTable({ users }: { users: AdminUserRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState("");

  function updateStatus(id: string, status: "ACTIVE" | "DISABLED") {
    setPendingId(id);
    startTransition(async () => {
      await fetch(`/api/admin/users/${id}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setPendingId("");
      router.refresh();
    });
  }

  return (
    <div className="panel table-wrap">
      <table className="data-table mobile-card-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>用户账号</th>
            <th>用户昵称</th>
            <th>可用金额</th>
            <th>订单数</th>
            <th>状态</th>
            <th>注册时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td data-label="ID">{user.userNo}</td>
              <td data-label="用户账号">{user.phone}</td>
              <td data-label="用户昵称">{user.nickname || "-"}</td>
              <td data-label="可用金额">{formatMoney(user.balanceCent, "cny")}</td>
              <td data-label="订单数">{user.orderCount}</td>
              <td data-label="状态">
                <span className={`status ${user.status === "ACTIVE" ? "PAID" : "CLOSED"}`}>
                  {user.status === "ACTIVE" ? "正常" : "禁用"}
                </span>
              </td>
              <td data-label="注册时间">{new Date(user.createdAt).toLocaleString("zh-CN")}</td>
              <td data-label="操作">
                <select
                  disabled={isPending && pendingId === user.id}
                  onChange={(event) => updateStatus(user.id, event.target.value as "ACTIVE" | "DISABLED")}
                  value={user.status}
                >
                  <option value="ACTIVE">正常</option>
                  <option value="DISABLED">禁用</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
