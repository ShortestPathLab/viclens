import { Typography } from "@heroui/react";

/** One term and value in a definition list, the value set right. */
export default function Fact({ term, value }: { term: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-3">
      <dt>
        <Typography type="body-sm" color="muted">
          {term}
        </Typography>
      </dt>
      <dd className="max-w-[62%]">
        <Typography type="body-sm" align="end">
          {value || "Not supplied"}
        </Typography>
      </dd>
    </div>
  );
}
