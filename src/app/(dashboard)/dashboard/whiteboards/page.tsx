import { Metadata } from "next";
import { WhiteboardListRoute } from "@/components/whiteboard/WhiteboardRoutes";

export const metadata: Metadata = { title: "My Whiteboards" };

export default function StudentWhiteboardsPage() {
  return (
    <WhiteboardListRoute
      basePath="/dashboard/whiteboards"
      homeCrumb={{ label: "Dashboard", href: "/dashboard" }}
    />
  );
}
