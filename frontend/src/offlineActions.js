import { v4 as uuid } from "uuid";
import { db } from "./db";
import { requestSync } from "./sync";

export async function submitPayment({ customer, amount, addedBy, note, month, year }) {
  const id = uuid();
  const numericAmount = Number(amount);

  const payment = {
    _id: id,
    clientId: id,
    customer,
    amount: numericAmount,
    addedBy: String(addedBy).trim().toUpperCase(),
    paidAt: new Date().toISOString(),
    note: note ? String(note).trim() : "",
    allocations: [{ month: Number(month), year: Number(year), amount: numericAmount }],
    synced: 0,
  };

  await db.transaction("rw", db.payments, db.outbox, async () => {
    await db.payments.add(payment);
    await db.outbox.add({ type: "PAYMENT_CREATE", payload: payment, createdAt: Date.now() });
  });

  requestSync(); // runs in background, never blocks the UI
  return payment;
}

// For payments that never reached the server (pending or rejected)
export async function deleteLocalPayment(clientId) {
  await db.transaction("rw", db.payments, db.outbox, async () => {
    await db.payments.where("clientId").equals(clientId).delete();
    await db.outbox.filter((o) => o.payload?.clientId === clientId).delete();
  });
}