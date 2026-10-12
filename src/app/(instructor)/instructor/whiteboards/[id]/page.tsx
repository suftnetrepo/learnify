import { Metadata } from "next";
import { WhiteboardEditorRoute, whiteboardTitle } from "@/components/whiteboard/WhiteboardRoutes";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: await whiteboardTitle(id) };   // the root layout adds " | Learnify"
}

export default async function InstructorWhiteboardEditorPage({ params }: Props) {
  const { id } = await params;
  return <WhiteboardEditorRoute id={id} basePath="/instructor/whiteboards" />;
}
