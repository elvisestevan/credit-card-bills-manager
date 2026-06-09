export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { BudgetForm } from "@/components/settings/BudgetForm";

export default async function BudgetSettingsPage() {
  let budgetGoal = await prisma.budgetGoal.findFirst();
  if (!budgetGoal) {
    budgetGoal = await prisma.budgetGoal.create({
      data: { amount: 10000 },
    });
  }
  const currentAmount = (budgetGoal.amount as Prisma.Decimal).toNumber();

  return (
    <div>
      <h2 className="text-lg font-medium text-zinc-200 mb-6">Budget Goal</h2>
      <BudgetForm currentAmount={currentAmount} />
    </div>
  );
}
