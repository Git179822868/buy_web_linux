"use client";

import Image from "next/image";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BadgeCheck,
  ChevronsUpDown,
  Clock3,
  CreditCard,
  Headphones,
  MessageCircleOff,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { formatMoney } from "@/lib/money";

type PackageItem = {
  id: string;
  name: string;
  description: string;
  category: string;
  categoryLabel: string;
  filterKey: string;
  filterLabel: string;
  platformCode: string;
  imageUrl: string;
  unit: string;
  baseQuantity: number;
  minQuantity: number;
  maxQuantity: number;
  allowRepeat: boolean;
  deliveryTime: string;
  completionRate: number;
  priceCent: number;
  currency: string;
};

type SortDirection = "asc" | "desc";
type SortKey = "completionRate" | "deliveryTime" | "price";

const categoryCatalog = [
  { key: "account_follow", label: "账号关注" },
  { key: "likes", label: "投放点赞" },
  { key: "plays", label: "投放播放" },
  { key: "video_promotion", label: "视频号推广" },
  { key: "xhs", label: "小红书推广" },
];

const sortOptions: Array<{
  defaultDirection: SortDirection;
  detail: { asc: string; desc: string };
  icon: typeof Clock3;
  key: SortKey;
  label: string;
}> = [
  {
    defaultDirection: "asc",
    detail: { asc: "更快优先", desc: "更慢优先" },
    icon: Clock3,
    key: "deliveryTime",
    label: "完成时间",
  },
  {
    defaultDirection: "desc",
    detail: { asc: "较低在前", desc: "更高优先" },
    icon: BadgeCheck,
    key: "completionRate",
    label: "完成率",
  },
  {
    defaultDirection: "asc",
    detail: { asc: "低价在前", desc: "高价在前" },
    icon: CreditCard,
    key: "price",
    label: "订单价格",
  },
];

function deliveryTimeScore(value: string) {
  const numbers = Array.from(value.matchAll(/\d+(?:\.\d+)?/g), (match) => Number(match[0]));
  const score = numbers.length ? numbers[numbers.length - 1] : Number.MAX_SAFE_INTEGER;

  if (value.includes("天")) {
    return score * 24;
  }

  if (value.includes("分钟")) {
    return score / 60;
  }

  return score;
}

function uniqueBy<T>(items: T[], key: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const value = key(item);

    if (seen.has(value)) {
      return false;
    }

    seen.add(value);
    return true;
  });
}

export function Storefront({
  isSignedIn,
  packages,
  initialQuery = "",
  supportHref,
}: {
  isSignedIn: boolean;
  packages: PackageItem[];
  initialQuery?: string;
  supportHref: string;
}) {
  const router = useRouter();
  const filterRailRef = useRef<HTMLDivElement | null>(null);
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");
  const [pendingPackageId, setPendingPackageId] = useState("");
  const [filterScroll, setFilterScroll] = useState({ left: 0, max: 0 });
  const [sortState, setSortState] = useState<{
    direction: SortDirection;
    key: SortKey;
  } | null>(null);
  const query = initialQuery.trim();
  const pendingPackage = packages.find((item) => item.id === pendingPackageId) || null;

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    const labels = new Map<string, string>();

    packages.forEach((item) => {
      counts.set(item.category, (counts.get(item.category) || 0) + 1);
      labels.set(item.category, item.categoryLabel);
    });

    const configured = categoryCatalog.map((item) => ({
      count: counts.get(item.key) || 0,
      key: item.key,
      label: labels.get(item.key) || item.label,
    }));

    const extras = Array.from(counts.keys())
      .filter((key) => !categoryCatalog.some((item) => item.key === key))
      .map((key) => ({
        count: counts.get(key) || 0,
        key,
        label: labels.get(key) || key,
      }));

    return [
      {
        count: packages.length,
        key: "all",
        label: "全部业务",
      },
      ...configured,
      ...extras,
    ];
  }, [packages]);

  const filters = useMemo(() => {
    const scoped =
      activeCategory === "all"
        ? packages
        : packages.filter((item) => item.category === activeCategory);

    return uniqueBy(scoped, (item) => item.filterKey).map((item) => ({
      count: scoped.filter((pkg) => pkg.filterKey === item.filterKey).length,
      key: item.filterKey,
      label: item.filterLabel,
    }));
  }, [activeCategory, packages]);

  const visiblePackages = useMemo(() => {
    const filtered = packages.filter((item) => {
      const categoryMatched = activeCategory === "all" || item.category === activeCategory;
      const filterMatched = activeFilter === "all" || item.filterKey === activeFilter;
      const keyword = query.trim().toLowerCase();
      const queryMatched =
        !keyword ||
        item.name.toLowerCase().includes(keyword) ||
        item.description.toLowerCase().includes(keyword) ||
        item.platformCode.toLowerCase().includes(keyword) ||
        item.categoryLabel.toLowerCase().includes(keyword) ||
        item.filterLabel.toLowerCase().includes(keyword);

      return categoryMatched && filterMatched && queryMatched;
    });

    if (!sortState) {
      return filtered;
    }

    return [...filtered].sort((left, right) => {
      const diff = (() => {
        if (sortState.key === "deliveryTime") {
          return deliveryTimeScore(left.deliveryTime) - deliveryTimeScore(right.deliveryTime);
        }

        if (sortState.key === "completionRate") {
          return left.completionRate - right.completionRate;
        }

        return left.priceCent - right.priceCent;
      })();

      if (diff === 0) {
        return left.name.localeCompare(right.name, "zh-CN");
      }

      return sortState.direction === "asc" ? diff : -diff;
    });
  }, [activeCategory, activeFilter, packages, query, sortState]);

  function selectCategory(key: string) {
    setActiveCategory(key);
    setActiveFilter("all");
  }

  function toggleSort(key: SortKey) {
    setSortState((current) => {
      if (current?.key === key) {
        return {
          direction: current.direction === "asc" ? "desc" : "asc",
          key,
        };
      }

      const option = sortOptions.find((item) => item.key === key);

      return {
        direction: option?.defaultDirection || "asc",
        key,
      };
    });
  }

  function openPurchaseNotice(packageId: string) {
    const selectedPackage = packages.find((item) => item.id === packageId);

    if (selectedPackage?.category === "xhs" || selectedPackage?.categoryLabel.includes("小红书")) {
      if (!isSignedIn) {
        router.push(`/login?next=${encodeURIComponent(`/checkout?packageId=${selectedPackage.id}`)}`);
        return;
      }

      router.push(`/checkout?packageId=${selectedPackage.id}`);
      return;
    }

    setPendingPackageId(packageId);
  }

  function jumpToSupport() {
    router.push(supportHref);
  }

  function continueToCheckout() {
    if (!pendingPackage) {
      return;
    }

    if (!isSignedIn) {
      router.push(`/login?next=${encodeURIComponent(`/checkout?packageId=${pendingPackage.id}`)}`);
      return;
    }

    router.push(`/checkout?packageId=${pendingPackage.id}`);
  }

  useEffect(() => {
    const node = filterRailRef.current;

    if (!node) {
      return;
    }

    const sync = () => {
      const max = Math.max(0, node.scrollWidth - node.clientWidth);
      setFilterScroll({
        left: Math.min(node.scrollLeft, max),
        max,
      });
    };

    sync();
    node.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);

    return () => {
      node.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, [activeCategory, filters.length]);

  return (
    <>
      <section className="growth-hero">
        <Image
          alt="账号关注投放"
          fill
          priority
          sizes="100vw"
          src="/assets/growth-hero.png"
        />
      </section>

      <section className="service-intro">
        <div className="service-side">
          <div className="service-points" aria-label="服务保障">
            <span>
              <ShieldCheck size={17} /> 真实账号
            </span>
            <span>
              <Clock3 size={17} /> 稳定交付
            </span>
            <span>
              <BadgeCheck size={17} /> 售后保障
            </span>
          </div>
        </div>
      </section>

      <section className="catalog-panel">
        <div className="catalog-toolbar">
          <div className="catalog-toolbar-side">
            <div className="catalog-count">
              <Sparkles size={16} />
              当前 {visiblePackages.length} 个套餐
            </div>
            <button className="catalog-support-button" onClick={jumpToSupport} type="button">
              <Headphones size={16} />
              联系客服
            </button>
          </div>
        </div>

        <div className="category-rail" aria-label="业务分类">
          {categories.map((category) => (
            <button
              className={activeCategory === category.key ? "active" : ""}
              key={category.key}
              onClick={() => selectCategory(category.key)}
              type="button"
            >
              <span>{category.label}</span>
              <b>{category.count}</b>
            </button>
          ))}
        </div>

        <div className="filter-layout">
          <div className="filter-scroll-panel">
            <div className="filter-bar" ref={filterRailRef}>
              <strong>{categories.find((item) => item.key === activeCategory)?.label || "全部业务"}</strong>
              <button
                className={activeFilter === "all" ? "active" : ""}
                onClick={() => setActiveFilter("all")}
                type="button"
              >
                全部
              </button>
              {filters.map((filter) => (
                <button
                  className={activeFilter === filter.key ? "active" : ""}
                  key={filter.key}
                  onClick={() => setActiveFilter(filter.key)}
                  type="button"
                >
                  {filter.label}
                  <span>{filter.count}</span>
                </button>
              ))}
            </div>
            {filterScroll.max > 0 ? (
              <div className="filter-dragbar">
                <input
                  aria-label="筛选条拖动滚动"
                  max={filterScroll.max}
                  min={0}
                  onChange={(event) => {
                    filterRailRef.current?.scrollTo({ left: Number(event.target.value) });
                  }}
                  type="range"
                  value={filterScroll.left}
                />
              </div>
            ) : null}
          </div>

          <div className="sort-actions" aria-label="套餐排序">
            {sortOptions.map((option) => {
              const active = sortState?.key === option.key;
              const direction = active ? sortState.direction : option.defaultDirection;
              const Icon = option.icon;

              return (
                <button
                  aria-label={`${option.label}${direction === "asc" ? "升序" : "降序"}排序`}
                  aria-pressed={active}
                  className={`sort-button ${active ? "active" : ""}`}
                  key={option.key}
                  onClick={() => toggleSort(option.key)}
                  type="button"
                >
                  <span className="sort-button-icon">
                    <Icon size={16} />
                  </span>
                  <span className="sort-button-copy">
                    <strong>{option.label}</strong>
                    <small>{option.detail[direction]}</small>
                  </span>
                  <span className="sort-button-state" aria-hidden="true">
                    {active ? direction === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} /> : <ChevronsUpDown size={14} />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="product-grid">
          {visiblePackages.map((item) => (
            <article className="product-card" key={item.id}>
              <button
                aria-label={`购买 ${item.name}`}
                className="product-image"
                onClick={() => openPurchaseNotice(item.id)}
                type="button"
              >
                <Image alt={item.name} fill sizes="(max-width: 640px) 50vw, 240px" src={item.imageUrl} />
              </button>
              <div className="product-body">
                <div className="product-tags">
                  <span>{item.platformCode}</span>
                  <span>{item.categoryLabel}</span>
                </div>
                <h3>{item.name}</h3>
                <p>{item.description}</p>
                <div className="product-meta">
                  <span>{item.deliveryTime}</span>
                  <span>{item.completionRate}%</span>
                </div>
                <div className="product-range">
                  {item.minQuantity}~{item.maxQuantity} {item.unit}
                </div>
                <div className="product-foot">
                  <strong>{formatMoney(item.priceCent, item.currency)}</strong>
                  <button onClick={() => openPurchaseNotice(item.id)} type="button">
                    立即购买
                    <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>

        {visiblePackages.length === 0 ? (
          <div className="catalog-empty">
            <Search size={24} />
            <span>没有找到匹配套餐，请换一个关键词或分类。</span>
          </div>
        ) : null}
      </section>

      {pendingPackage ? (
        <div aria-modal="true" className="purchase-modal" role="dialog">
          <div className="purchase-modal-backdrop" onClick={() => setPendingPackageId("")} />
          <div className="purchase-modal-panel">
            <button
              aria-label="关闭提示"
              className="purchase-modal-close"
              onClick={() => setPendingPackageId("")}
              type="button"
            >
              <X size={18} />
            </button>
            <h2>温馨提示：下单前请关闭陌生私信</h2>
            <p>为保证投放授权顺利处理，请先在抖音里完成以下设置，再继续购买。</p>
            <div className="purchase-guide">
              <div>
                <Settings size={26} />
                <strong>打开设置</strong>
                <span>抖音右上角进入设置</span>
              </div>
              <div>
                <MessageCircleOff size={26} />
                <strong>进入私信</strong>
                <span>隐私设置里点击私信</span>
              </div>
              <div>
                <UsersRound size={26} />
                <strong>限制私信</strong>
                <span>选择互相关注的人可私信</span>
              </div>
            </div>
            <div className="purchase-modal-actions">
              <button className="secondary-button" onClick={() => setPendingPackageId("")} type="button">
                先不购买
              </button>
              <button className="primary-button" onClick={continueToCheckout} type="button">
                我已关闭私信，继续购买
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
