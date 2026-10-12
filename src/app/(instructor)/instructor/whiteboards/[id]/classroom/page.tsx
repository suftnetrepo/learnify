import { Metadata } from "next";
import { WhiteboardClassroomRoute } from "@/components/whiteboard/WhiteboardRoutes";

export const metadata: Metadata = { title: "Live Classroom" };   // the root layout adds " | Learnify"

interface Props {
  params: Promise<{ id: string }>;
}

export default async function InstructorWhiteboardClassroomPage({ params }: Props) {
  const { id } = await params;
  return <WhiteboardClassroomRoute id={id} basePath="/instructor/whiteboards" />;
}
