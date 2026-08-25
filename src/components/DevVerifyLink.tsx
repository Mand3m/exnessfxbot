"use client";

import { useEffect, useState } from "react";

export function DevVerifyLink() {
  const [url, setUrl] = useState("");
  useEffect(() => {
    setUrl(sessionStorage.getItem("exnessfx_verify_url") || "");
  }, []);
  if (!url) return null;
  return (
    <p className="mt-4 text-sm text-muted">
      Mail is not configured on this machine. Open{" "}
      <a href={url} className="text-[#e0b422] underline">
        this verification link
      </a>{" "}
      to confirm the account.
    </p>
  );
}
