import { Metadata } from "next";
import { WhiteboardListRoute } from "@/components/whiteboard/WhiteboardRoutes";

export const metadata: Metadata = { title: "My Whiteboards" };

export default function InstructorWhiteboardsPage() {
  return (
    <WhiteboardListRoute
      basePath="/instructor/whiteboards"
      homeCrumb={{ label: "Dashboard", href: "/instructor" }}
    />
  );
}
