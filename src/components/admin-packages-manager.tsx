"use client";

import { PackagePlus, Save, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

import { formatMoney } from "@/lib/money";

type ServicePackage = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  categoryLabel: string;
  filterKey: string;
  filterLabel: string;
  platformCode: string;
  imageUrl: string;
  unit: string;
  productType: "NORMAL" | "API";
  priceTemplate: string | null;
  baseQuantity: number;
  minQuantity: number;
  maxQuantity: number;
  allowRepeat: boolean;
  deliveryTime: string;
  completionRate: number;
  priceCent: number;
  currency: string;
  sortOrder: number;
  isActive: boolean;
};

function FieldHint({ children }: { children: ReactNode }) {
  return <small className="field-hint">{children}</small>;
}

const categoryOptions = [
  { key: "account_follow", label: "账号关注" },
  { key: "likes", label: "投放点赞" },
  { key: "plays", label: "投放播放" },
  { key: "video_promotion", label: "视频号推广" },
  { key: "xhs", label: "小红书推广" },
];

const emptyForm = {
  name: "",
  description: "",
  category: "account_follow",
  categoryLabel: "账号关注",
  filterKey: "normal",
  filterLabel: "普通粉丝",
  platformCode: "BD",
  imageUrl: "/assets/package-thumb.png",
  unit: "个",
  productType: "NORMAL" as const,
  priceTemplate: "默认模板",
  baseQuantity: 1000,
  minQuantity: 1000,
  maxQuantity: 1000000,
  allowRepeat: true,
  deliveryTime: "24-72小时",
  completionRate: 95,
  priceYuan: "0.10",
  sortOrder: 0,
  isActive: true,
};

export function AdminPackagesManager({ packages }: { packages: ServicePackage[] }) {
  const router = useRouter();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function patchForm(key: keyof typeof emptyForm, value: string | number | boolean) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function createPackage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      const priceYuan = Number(form.priceYuan);
      const formData = new FormData(event.currentTarget);
      const category = String(formData.get("category") || form.category);
      const categoryLabel = categoryOptions.find((item) => item.key === category)?.label || form.categoryLabel;

      if (!Number.isFinite(priceYuan) || priceYuan < 0.1) {
        setError("销售价格最低 0.1 元");
        return;
      }

      const payload = {
        ...form,
        category,
        categoryLabel,
        description: form.description.trim() || `${form.name.trim()} ${form.deliveryTime}`,
        priceCent: Math.round(priceYuan * 100),
      };

      const response = await fetch("/api/admin/packages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json();

      if (!response.ok) {
        setError(json.message || "新增套餐失败");
        return;
      }

      setForm(emptyForm);
      router.refresh();
    });
  }

  function togglePackage(item: ServicePackage) {
    startTransition(async () => {
      await fetch(`/api/admin/packages/${item.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      router.refresh();
    });
  }

  function deletePackage(item: ServicePackage) {
    const confirmed = window.confirm(`确认删除商品“${item.name}”吗？已有订单的商品不能删除，只能下架隐藏。`);

    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/admin/packages/${item.id}`, {
        method: "DELETE",
      });
      const json = await response.json();

      if (!response.ok) {
        setError(json.message || "删除商品失败");
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="form-stack">
      <div className="panel" style={{ padding: 18 }}>
        <div className="package-form-note">
          <strong>先填这几项就能上架</strong>
          <p>如果你第一次接触后台，优先填写商品名称、价格、最小数量、最大数量和完成时间。系统编号会自动生成，不需要手动填写。</p>
        </div>
        <form className="package-form-grid" onSubmit={createPackage}>
          <div className="field">
            <label htmlFor="name">商品名称</label>
            <input
              id="name"
              onChange={(event) => patchForm("name", event.target.value)}
              placeholder="例如：抖音账号关注 1000 粉"
              value={form.name}
            />
          </div>
          <div className="field wide">
            <label htmlFor="description">商品说明</label>
            <textarea
              id="description"
              onChange={(event) => patchForm("description", event.target.value)}
              placeholder="写清楚适合谁、多久完成、是否包有效"
              rows={2}
              value={form.description}
            />
          </div>
          <div className="field">
            <label>前台分类</label>
            <div className="package-category-options" role="radiogroup" aria-label="前台分类">
              {categoryOptions.map((item) => (
                <label className="package-category-option" key={item.key}>
                  <input
                    defaultChecked={form.category === item.key}
                    name="category"
                    type="radio"
                    value={item.key}
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
            <FieldHint>这里决定商品在前台哪个分类下展示，小红书和视频号也在这里选择。</FieldHint>
          </div>
          <div className="field">
            <label htmlFor="filterLabel">筛选名称</label>
            <input
              id="filterLabel"
              onChange={(event) => patchForm("filterLabel", event.target.value)}
              placeholder="例如：普通粉丝"
              value={form.filterLabel}
            />
          </div>
          <div className="field">
            <label htmlFor="unit">计量单位</label>
            <input
              id="unit"
              onChange={(event) => patchForm("unit", event.target.value)}
              placeholder="例如：个、次、单"
              value={form.unit}
            />
          </div>
          <div className="field">
            <label htmlFor="productType">商品类型</label>
            <select
              id="productType"
              onChange={(event) => patchForm("productType", event.target.value as "NORMAL" | "API")}
              value={form.productType}
            >
              <option value="NORMAL">普通商品</option>
              <option value="API">接口对接商品</option>
            </select>
            <FieldHint>普通商品走人工处理，接口对接商品通常由系统自动对接。</FieldHint>
          </div>
          <div className="field">
            <label htmlFor="baseQuantity">下单步长</label>
            <input
              id="baseQuantity"
              min={1}
              onChange={(event) => patchForm("baseQuantity", Number(event.target.value))}
              type="number"
              value={form.baseQuantity}
            />
            <FieldHint>用户每次下单必须按这个步长递增，例如 1000、2000、3000。</FieldHint>
          </div>
          <div className="field">
            <label htmlFor="minQuantity">最小数量</label>
            <input
              id="minQuantity"
              min={1}
              onChange={(event) => patchForm("minQuantity", Number(event.target.value))}
              type="number"
              value={form.minQuantity}
            />
          </div>
          <div className="field">
            <label htmlFor="maxQuantity">最大数量</label>
            <input
              id="maxQuantity"
              min={1}
              onChange={(event) => patchForm("maxQuantity", Number(event.target.value))}
              type="number"
              value={form.maxQuantity}
            />
          </div>
          <div className="field">
            <label htmlFor="deliveryTime">完成时间</label>
            <input
              id="deliveryTime"
              onChange={(event) => patchForm("deliveryTime", event.target.value)}
              placeholder="例如：24-72小时"
              value={form.deliveryTime}
            />
          </div>
          <div className="field">
            <label htmlFor="completionRate">完成率</label>
            <input
              id="completionRate"
              max={100}
              min={0}
              onChange={(event) => patchForm("completionRate", Number(event.target.value))}
              type="number"
              value={form.completionRate}
            />
            <FieldHint>填写预估完成率，例如 95 代表预计能完成 95%。</FieldHint>
          </div>
          <div className="field">
            <label htmlFor="imageUrl">商品图片地址</label>
            <input
              id="imageUrl"
              onChange={(event) => patchForm("imageUrl", event.target.value)}
              placeholder="可填写商品缩略图地址"
              value={form.imageUrl}
            />
          </div>
          <div className="field">
            <label htmlFor="allowRepeat">重复下单</label>
            <select
              id="allowRepeat"
              onChange={(event) => patchForm("allowRepeat", event.target.value === "true")}
              value={String(form.allowRepeat)}
            >
              <option value="true">允许</option>
              <option value="false">不允许</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="priceYuan">销售价格（元）</label>
            <input
              id="priceYuan"
              min={0.1}
              onChange={(event) => patchForm("priceYuan", event.target.value)}
              step={0.01}
              type="number"
              value={form.priceYuan}
            />
            <FieldHint>最低 0.1 元，系统会自动换算成订单金额。</FieldHint>
          </div>
          <div className="field">
            <label htmlFor="sortOrder">展示排序</label>
            <input
              id="sortOrder"
              min={0}
              onChange={(event) => patchForm("sortOrder", Number(event.target.value))}
              type="number"
              value={form.sortOrder}
            />
          </div>
          {error ? <p className="error-text wide">{error}</p> : null}
          <button className="primary-button wide" disabled={isPending} type="submit">
            <PackagePlus size={17} />
            新增商品
          </button>
        </form>
      </div>

      <div className="panel table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>套餐</th>
              <th>分类</th>
              <th>筛选</th>
              <th>数量范围</th>
              <th>完成时效</th>
              <th>价格</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {packages.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.categoryLabel}</td>
                <td>{item.filterLabel}</td>
                <td>
                  {item.minQuantity} ~ {item.maxQuantity} / {item.baseQuantity}
                </td>
                <td>{item.deliveryTime} / {item.completionRate}%</td>
                <td>{formatMoney(item.priceCent, item.currency)}</td>
                <td>
                  <span className={`status ${item.isActive ? "PAID" : "CLOSED"}`}>
                    {item.isActive ? "上架" : "下架"}
                  </span>
                </td>
                <td>
                  <div className="button-row">
                    <button className="secondary-button" disabled={isPending} onClick={() => togglePackage(item)} type="button">
                      <Save size={15} />
                      {item.isActive ? "下架" : "上架"}
                    </button>
                    <button className="danger-button" disabled={isPending} onClick={() => deletePackage(item)} type="button">
                      <Trash2 size={15} />
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
