"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  Info,
  ShieldAlert,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { payMethodOptions, type PayMethod } from "@/lib/payment-gateway";
import { formatMoney, maskPhone } from "@/lib/money";
import { usePaymentSurface } from "@/lib/use-payment-surface";

type CheckoutPackage = {
  id: string;
  name: string;
  description: string;
  category: string;
  categoryLabel: string;
  filterLabel: string;
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

type CheckoutUser = {
  phone: string;
} | null;

function WechatPayIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="24" viewBox="0 0 24 24" width="24">
      <rect fill="#07C160" height="24" rx="7" width="24" />
      <path
        d="M10.2 6.2C6.8 6.2 4 8.35 4 11.02c0 1.53.92 2.9 2.35 3.78l-.45 1.62 1.96-.96c.72.22 1.51.34 2.34.34 3.42 0 6.2-2.14 6.2-4.78S13.62 6.2 10.2 6.2Z"
        fill="#fff"
      />
      <path
        d="M14.25 11.38c-2.78 0-5.04 1.72-5.04 3.84 0 2.13 2.26 3.86 5.04 3.86.67 0 1.3-.1 1.88-.28l1.58.78-.36-1.3c1.15-.7 1.9-1.8 1.9-3.06 0-2.12-2.25-3.84-5-3.84Z"
        fill="#fff"
        opacity=".82"
      />
      <circle cx="8.1" cy="10.55" fill="#07C160" r=".75" />
      <circle cx="12.2" cy="10.55" fill="#07C160" r=".75" />
      <circle cx="12.8" cy="14.75" fill="#07C160" r=".62" />
      <circle cx="16" cy="14.75" fill="#07C160" r=".62" />
    </svg>
  );
}

function AlipayIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="24" viewBox="0 0 24 24" width="24">
      <rect fill="#1677FF" height="24" rx="7" width="24" />
      <path d="M7 8.05H17.15V9.75H7V8.05Z" fill="#fff" />
      <path d="M11.18 5.7H13.1V8.95H11.18V5.7Z" fill="#fff" />
      <path
        d="M15.35 10.02C14.95 12.12 14.12 13.78 12.84 15.02C11.74 16.1 10.28 16.9 8.45 17.44L7.35 15.92C8.93 15.52 10.2 14.92 11.15 14.1C12.2 13.2 12.88 11.84 13.2 10.02H15.35Z"
        fill="#fff"
      />
      <path
        d="M6.45 13.1C10.48 13.3 14.12 14.33 17.42 16.18L16.3 18.02C13.34 16.18 9.9 15.1 6 14.82L6.45 13.1Z"
        fill="#fff"
      />
    </svg>
  );
}

export function CheckoutForm({ packageItem, user }: { packageItem: CheckoutPackage; user: CheckoutUser }) {
  const router = useRouter();
  const [douyinAccount, setDouyinAccount] = useState("");
  const [cooperationCode, setCooperationCode] = useState("");
  const [orderQuantity, setOrderQuantity] = useState(packageItem.minQuantity);
  const [remark, setRemark] = useState("");
  const [payMethod, setPayMethod] = useState<PayMethod>("wechat_native");
  const [error, setError] = useState("");
  const [showSummaryDetail, setShowSummaryDetail] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { isMobileSurface, isWeChatBrowser } = usePaymentSurface();
  const isXiaohongshu = packageItem.category === "xhs" || packageItem.categoryLabel.includes("小红书");
  const targetLabel = isXiaohongshu ? "红薯账号" : "抖音号";
  const targetPlaceholder = isXiaohongshu ? "请输入需要投放的红薯账号" : "请输入需要投放的抖音号";
  const targetInputId = isXiaohongshu ? "redbookAccount" : "douyinAccount";

  const normalizedQuantity = useMemo(() => {
    const safeQuantity = Number.isFinite(orderQuantity) ? orderQuantity : packageItem.minQuantity;
    return Math.max(packageItem.minQuantity, Math.min(safeQuantity, packageItem.maxQuantity));
  }, [orderQuantity, packageItem.maxQuantity, packageItem.minQuantity]);
  const totalCent = packageItem.priceCent * normalizedQuantity;
  const currentCheckoutPath = `/checkout?packageId=${packageItem.id}`;
  const supportHref = user ? "/account/support" : `/login?next=${encodeURIComponent("/account/support")}`;
  const visiblePayMethods = useMemo(() => {
    const surface = isMobileSurface ? "mobile" : "desktop";
    return payMethodOptions.filter((method) => method.surfaces.includes(surface));
  }, [isMobileSurface]);
  const activePayMethod = useMemo(() => {
    const visibleIds = new Set(visiblePayMethods.map((method) => method.id));

    if (visibleIds.has(payMethod)) {
      return payMethod;
    }

    return isMobileSurface ? "wechat_h5" : "wechat_native";
  }, [isMobileSurface, payMethod, visiblePayMethods]);

  function paymentMethodHint(method: PayMethod) {
    if (method === "wechat_native") {
      return "微信扫码";
    }

    if (method === "wechat_h5") {
      return "手机浏览器";
    }

    if (method === "alipay_wap") {
      return "手机跳转";
    }

    return "支付宝支付";
  }

  function submitOrder() {
    setError("");

    if (!user) {
      router.push(`/login?next=${encodeURIComponent(currentCheckoutPath)}`);
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          packageId: packageItem.id,
          douyinAccount,
          cooperationCode,
          orderQuantity: normalizedQuantity,
          remark,
          payMethod: activePayMethod,
        }),
      });
      const json = await response.json();

      if (!response.ok) {
        setError(json.message || "订单创建失败");
        return;
      }

      if (json.payment?.status === "FAILED") {
        router.push(`/order/${json.order.orderNo}/payment/failure`);
        return;
      }

      router.push(`/order/${json.order.orderNo}`);
    });
  }

  return (
    <div className="checkout-page-shell">
      <section className="checkout-main-panel">
        <Link className="checkout-back" href="/">
          <ArrowLeft size={17} />
          返回套餐列表
        </Link>

        <div className="checkout-heading">
          <div>
            <h1>确认订单</h1>
            <p>
              {isXiaohongshu
                ? "请确认套餐、红薯账号、数量和支付方式，提交后会生成正式订单。"
                : "请确认套餐、抖音号、合作码、数量和支付方式，提交后会生成正式订单。"}
            </p>
          </div>
          {user ? (
            <Link className="checkout-user" href="/account">
              <UserRound size={17} />
              {maskPhone(user.phone)}
            </Link>
          ) : (
            <Link className="checkout-user" href={`/login?next=${encodeURIComponent(currentCheckoutPath)}`}>
              登录/注册
            </Link>
          )}
        </div>

        <div className="checkout-product">
          <div className="checkout-product-image">
            <Image alt={packageItem.name} fill sizes="180px" src={packageItem.imageUrl} />
          </div>
          <div>
            <div className="product-tags">
              <span>{packageItem.categoryLabel}</span>
              <span>{packageItem.filterLabel}</span>
            </div>
            <h2>{packageItem.name}</h2>
            <p>{packageItem.description}</p>
            <div className="checkout-product-meta">
              <span>{packageItem.deliveryTime}</span>
              <span>完成率 {packageItem.completionRate}%</span>
              <span>{packageItem.allowRepeat ? "允许重复下单" : "不允许重复下单"}</span>
            </div>
            {isXiaohongshu ? (
              <div className="checkout-warning">
                <ShieldAlert size={17} />
                <span>请确认红薯账号填写正确，提交后客服会按该账号安排处理。</span>
              </div>
            ) : (
              <div className="checkout-warning">
                <ShieldAlert size={17} />
                <span>下单前请将私信设置为“互相关注的人可私信”，避免陌生私信影响授权处理。</span>
              </div>
            )}
          </div>
        </div>

        <div className="checkout-form-grid">
          <div className="field">
            <label htmlFor={targetInputId}>
              {targetLabel}
              <span className="required-mark">*</span>
            </label>
            <input
              id={targetInputId}
              onChange={(event) => setDouyinAccount(event.target.value)}
              placeholder={targetPlaceholder}
              value={douyinAccount}
            />
          </div>

          {!isXiaohongshu ? (
            <div className="field">
              <label htmlFor="cooperationCode">
                合作码
                <span className="required-mark">*</span>
              </label>
              <input
                id="cooperationCode"
                onChange={(event) => setCooperationCode(event.target.value)}
                placeholder="请输入抖音合作码"
                value={cooperationCode}
              />
              <span className="field-hint">获取路径：抖音「我」→ 右上角设置 → 账号与安全 → 我的合作码。</span>
            </div>
          ) : null}

          <div className="field">
            <label htmlFor="orderQuantity">
              下单数量（{packageItem.unit}，{packageItem.minQuantity}~{packageItem.maxQuantity}）
            </label>
            <input
              id="orderQuantity"
              max={packageItem.maxQuantity}
              min={packageItem.minQuantity}
              onBlur={() => setOrderQuantity(normalizedQuantity)}
              onChange={(event) => setOrderQuantity(Number(event.target.value))}
              step={packageItem.baseQuantity}
              type="number"
              value={orderQuantity}
            />
          </div>

          <div className="field wide">
            <label>支付方式</label>
            <div className="checkout-inline-total">
              <span>应付金额</span>
              <strong>{formatMoney(totalCent, packageItem.currency)}</strong>
            </div>
            <div className="checkout-method-grid">
              {visiblePayMethods.map((method) => (
                <button
                  className={`checkout-method ${activePayMethod === method.id ? "active" : ""}`}
                  key={method.id}
                  onClick={() => setPayMethod(method.id)}
                  title={method.helper}
                  type="button"
                >
                  <span className={`checkout-method-icon ${method.id}`} aria-hidden="true">
                    {method.id === "wechat_native" || method.id === "wechat_h5" ? (
                      <WechatPayIcon />
                    ) : (
                      <AlipayIcon />
                    )}
                  </span>
                  <span className="checkout-method-copy">
                    <strong>{method.label}</strong>
                    <small>{paymentMethodHint(method.id)}</small>
                  </span>
                </button>
              ))}
            </div>
          {isWeChatBrowser ? (
              <span className="field-hint">
                当前是微信内浏览器，一期不支持直接拉起微信 H5 支付。请使用系统浏览器打开，或在电脑端扫码支付。
              </span>
            ) : null}
            <button className="checkout-inline-submit" disabled={isPending} onClick={submitOrder} type="button">
              <ShieldCheck size={18} />
              {isPending ? "正在提交" : user ? "确认支付" : "登录后继续"}
            </button>
          </div>

          <div className="field wide">
            <label htmlFor="remark">备注</label>
            <textarea
              id="remark"
              onChange={(event) => setRemark(event.target.value)}
              placeholder="可填写投放要求、客服备注或特殊说明"
              rows={4}
              value={remark}
            />
          </div>
        </div>

        <details className="checkout-detail-panel checkout-notes">
          <summary>
            <span>购买须知</span>
            <a className="checkout-inline-link" href={supportHref} onClick={(event) => event.stopPropagation()}>
              在线客服
              <ExternalLink size={14} />
            </a>
          </summary>

          <div className="checkout-detail-content">
            <div className="checkout-detail-brief" id="checkout-support">
              <span>订单问题直接联系在线客服</span>
              <span>工作时间：早上 9 点 - 晚上 12 点</span>
            </div>

            {!isXiaohongshu ? (
              <div className="checkout-important-note" id="binding-guide">
                <div>
                  <strong>没有合作码 / 个人账号，下单前请先绑定蓝V账号</strong>
                  <p>订单完成后可解绑。</p>
                </div>
                <a
                  className="checkout-inline-link solid"
                  href="https://kizw88h0rg6.feishu.cn/docx/VSBOd5R6EoyraJxfzO1cvdTanph"
                  rel="noreferrer"
                  target="_blank"
                >
                  绑定教程：点我查看
                </a>
              </div>
            ) : null}

            <div className="checkout-detail-stack">
              {isXiaohongshu ? (
                <>
                  <article className="checkout-detail-block">
                    <div className="checkout-detail-number">1</div>
                    <div className="checkout-detail-copy">
                      <h3>下单信息</h3>
                      <p>小红书套餐只需要填写红薯账号，请确认账号准确后再提交。</p>
                    </div>
                  </article>

                  <article className="checkout-detail-block">
                    <div className="checkout-detail-number">2</div>
                    <div className="checkout-detail-copy">
                      <h3>交付时间</h3>
                      <p>通常售后 3 天内处理；当天 6 点前的订单，隔天 6 点左右完成，大单量一般 7 天内完成。</p>
                    </div>
                  </article>

                  <article className="checkout-detail-block alert">
                    <div className="checkout-detail-number">3</div>
                    <div className="checkout-detail-copy">
                      <h3>注意事项</h3>
                      <ul className="checkout-detail-list">
                        <li>单次建议上限 8000 左右，已经下过的账号不要重复下同类订单。</li>
                        <li>如遇缺量请及时联系在线客服处理。</li>
                        <li>真实地推粉丝，可同步蒲公英。</li>
                      </ul>
                    </div>
                  </article>
                </>
              ) : (
                <>
                  <article className="checkout-detail-block" id="cooperation-guide">
                    <div className="checkout-detail-number">1</div>
                    <div className="checkout-detail-copy">
                      <h3>怎么查看合作码</h3>
                      <p>抖音 → 我 → 左上角 → 设置 → 账号与安全 → 我的合作码。</p>
                    </div>
                  </article>

                  <article className="checkout-detail-block">
                    <div className="checkout-detail-number">2</div>
                    <div className="checkout-detail-copy">
                      <h3>没有合作码怎么办</h3>
                      <p>没有合作码或当前为个人账号，请先绑定蓝V账号后再购买。</p>
                      <p>
                        <a
                          className="checkout-inline-link"
                          href="https://kizw88h0rg6.feishu.cn/docx/VSBOd5R6EoyraJxfzO1cvdTanph"
                          rel="noreferrer"
                          target="_blank"
                        >
                          点我查看获取合作码教程
                          <ExternalLink size={14} />
                        </a>
                      </p>
                    </div>
                  </article>

                  <article className="checkout-detail-block">
                    <div className="checkout-detail-number">3</div>
                    <div className="checkout-detail-copy">
                      <h3>购买之后要做什么</h3>
                      <p>付款后 10-30 分钟内，抖音会收到授权信息。</p>
                      <p>请在抖音消息列表或合作码页面确认授权，确认后客服才会开始处理。</p>
                    </div>
                  </article>

                  <article className="checkout-detail-block alert">
                    <div className="checkout-detail-number">4</div>
                    <div className="checkout-detail-copy">
                      <h3>订单进行中的注意事项</h3>
                      <ul className="checkout-detail-list">
                        <li>建议关闭账号私信功能，至少改为“互相关注的人可私信”。</li>
                        <li>不要设置私密账号。</li>
                        <li>不要删除我们的投放素材，如想调整素材，请联系客服处理。</li>
                      </ul>
                    </div>
                  </article>

                  <article className="checkout-detail-block">
                    <div className="checkout-detail-number">5</div>
                    <div className="checkout-detail-copy">
                      <h3>订单长时间不到账怎么办</h3>
                      <p>请先确认自己是否已经完成授权，不授权的话是操作不了的。</p>
                      <p>如果授权之后长时间没有操作，请及时联系客服处理。</p>
                    </div>
                  </article>
                </>
              )}
            </div>
          </div>
        </details>
      </section>

      <aside className={`checkout-summary-panel ${showSummaryDetail ? "expanded" : ""}`}>
        <button
          aria-expanded={showSummaryDetail}
          className="checkout-summary-mobile-preview"
          onClick={() => setShowSummaryDetail((current) => !current)}
          type="button"
        >
          <span>应付金额</span>
          <strong>{formatMoney(totalCent, packageItem.currency)}</strong>
          <small>{showSummaryDetail ? "收起明细" : "展开明细"}</small>
        </button>

        <div className="checkout-summary-content">
          <h2>结算信息</h2>
          <div className="checkout-summary-row">
            <span>单价</span>
            <strong>{formatMoney(packageItem.priceCent, packageItem.currency)}</strong>
          </div>
          <div className="checkout-summary-row">
            <span>数量</span>
            <strong>
              {normalizedQuantity} {packageItem.unit}
            </strong>
          </div>
          <div className="checkout-summary-row">
            <span>完成时间</span>
            <strong>{packageItem.deliveryTime}</strong>
          </div>
          <div className="checkout-tip">
            <Info size={16} />
            <span>
              {isXiaohongshu
                ? "请确保红薯账号正确。支付成功后，订单会进入客服处理队列。"
                : "请确保抖音号和合作码正确。支付成功后，订单会进入客服处理队列。"}
            </span>
          </div>
        </div>

        {error ? <p className="error-text">{error}</p> : null}

        <button className="checkout-submit" disabled={isPending} onClick={submitOrder} type="button">
          <ShieldCheck size={18} />
          {isPending ? "正在提交" : user ? "确认支付" : "登录后继续"}
        </button>
      </aside>
    </div>
  );
}
