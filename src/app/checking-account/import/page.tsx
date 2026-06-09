import { redirect } from "next/navigation";

export default function CheckingAccountImportPage() {
  redirect("/transactions/add?tab=import-csv");
}
