export const academicDisclaimerText =
  "Proyecto académico — no oficial ni afiliado a ninguna entidad financiera.";

export function AcademicDisclaimer({
  className = "",
}: {
  readonly className?: string;
}) {
  return (
    <p className={`academic-disclaimer${className ? ` ${className}` : ""}`} role="note">
      {academicDisclaimerText}
    </p>
  );
}
