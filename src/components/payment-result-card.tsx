import Link from "next/link";
import { CheckCircle2, CircleX, Clock3, RefreshCw } from "lucide-react";

type PaymentResultTone = "success" | "pending" | "failure";

type PaymentResultRow = {
  label: string;
  value: string;
};

const toneIcon = {
  failure: CircleX,
  pending: Clock3,
  success: CheckCircle2,
};

export function PaymentResultCard({
  amountText,
  message,
  primaryHref,
  primaryLabel,
  rows,
  secondaryHref,
  secondaryLabel,
  siteName,
  title,
  tone,
}: {
  amountText: string;
  message: string;
  primaryHref: string;
  primaryLabel: string;
  rows: PaymentResultRow[];
  secondaryHref?: string;
  secondaryLabel?: string;
  siteName: string;
  title: string;
  tone: PaymentResultTone;
}) {
  const Icon = toneIcon[tone];

  return (
    <main className="payment-result-shell">
      <section className="payment-result-card">
        <header className="payment-result-brand">{siteName}</header>
        <div className={`payment-result-hero ${tone}`}>
          <Icon size={88} strokeWidth={1.7} />
          <h1>{title}</h1>
          <strong>{amountText}</strong>
        </div>
        <div className="payment-result-detail">
          <dl>
            {rows.map((row) => (
              <div key={row.label}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
          <p>{message}</p>
          <div className="payment-result-actions">
            <Link className="payment-result-button primary" href={primaryHref}>
              {primaryLabel}
            </Link>
            {secondaryHref && secondaryLabel ? (
              <Link className="payment-result-button secondary" href={secondaryHref}>
                <RefreshCw size={17} />
                {secondaryLabel}
              </Link>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
