import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/dashboard/")({
  component: DashboardIndex,
});

function DashboardIndex() {
  useEffect(() => {
    window.location.replace("/dashboard/overview");
  }, []);
  return null;
}

