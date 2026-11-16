import { collectionStatus } from "@/lib/momo";
import { decidePayment, type Payment } from "@/lib/payments";

export async function syncMomo(payment: Payment): Promise<Payment> {
  if (payment.status !== "pending" || !payment.momoRef) return payment;
  let status = "PENDING";
  try {
    status = await collectionStatus(payment.momoRef);
  } catch {
    return payment;
  }
  if (status === "SUCCESSFUL") {
    const decided = decidePayment(payment.id, "approved");
    return decided.ok ? decided.payment : payment;
  }
  if (status === "FAILED" || status === "REJECTED" || status === "TIMEOUT") {
    const decided = decidePayment(payment.id, "rejected");
    return decided.ok ? decided.payment : payment;
  }
  return payment;
}
