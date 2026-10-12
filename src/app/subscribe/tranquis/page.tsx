import { Metadata } from "next";
import { TransquisSubscribePage } from "./TransquisSubscribePage";

export const metadata: Metadata = { title: "Choose Your Tranquis Plan" };

interface Props {
  searchParams: Promise<{ user_id?: string }>;
}

export default async function Page({ searchParams }: Props) {
  const { user_id } = await searchParams;
  return <TransquisSubscribePage userId={user_id ?? null} />;
}
