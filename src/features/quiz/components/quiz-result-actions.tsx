import Link from "next/link";

import { Button } from "@/components/ui/button";

export function QuizResultActions() {
  return (
    <div className="mt-6 flex flex-wrap gap-3">
      <Button asChild>
        <Link href="/quiz/mode">Chơi lại</Link>
      </Button>
      <Button asChild variant="outline">
        <Link href="/quiz/mode">Quay lại</Link>
      </Button>
    </div>
  );
}
