import { Landmark } from "lucide-react";
import { Link } from "react-router-dom";

export function BrandMark({
  inverse = false,
  compact = false,
}: {
  readonly inverse?: boolean;
  readonly compact?: boolean;
}) {
  return (
    <Link
      className={`brand-mark${inverse ? " brand-mark--inverse" : ""}`}
      to="/"
      aria-label="Banco GNB Atención Digital, inicio"
    >
      <span className="brand-mark__icon">
        <Landmark aria-hidden="true" />
      </span>
      <span className="brand-mark__text">
        <strong>Banco GNB</strong>
        {compact ? null : <small>Atención Digital</small>}
      </span>
    </Link>
  );
}
