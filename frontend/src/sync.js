import { db } from "./db";
import api from "./services/api";

let currentSync = null;
let dirty = false;
let started = false;

async function push() {
  for (;;) {
    const batch = await db.outbox.orderBy("seq").limit(20).toArray();
    if (batch.length === 0) break;
    const { data } = await api.post("/sync/push", { items: batch }, { timeout: 15000 });
    let stuck = false;
    await db.transaction("rw", db.outbox, db.payments, async () => {
      for (const r of data.results) {
        const item = batch.find((b) => b.seq === r.seq);
        if (!item) continue;
        if (r.status === "ok") {
          await db.payments.update(item.payload._id, { synced: 1 });
          await db.outbox.delete(item.seq);
        } else if (r.status === "rejected") {
          await db.payments.update(item.payload._id, { synced: -1, syncError: r.error });
          await db.outbox.delete(item.seq);
        } else {
          stuck = true;
        }
      }
    });
    if (stuck) throw new Error("server asked to retry");
  }
}
async function pull() {
  const since = localStorage.getItem("lastSync") || 0;
  const { data } = await api.get("/sync/pull", { params: { since }, timeout: 30000 });
  const { customers, payments, locations, customerIds, paymentIds, serverTime } = data;
  await db.transaction("rw", db.customers, db.payments, db.locations, async () => {
    await db.customers.bulkPut(customers);
    await db.locations.bulkPut(locations);
    const clientIds = payments.map((p) => p.clientId).filter(Boolean);
    if (clientIds.length) await db.payments.where("clientId").anyOf(clientIds).delete();
    await db.payments.bulkPut(payments.map((p) => ({ ...p, synced: 1 })));
    const keepC = new Set(customerIds);
    const keepP = new Set(paymentIds);
    await db.customers.filter((c) => !keepC.has(c._id)).delete();
    await db.payments.filter((p) => p.synced === 1 && !keepP.has(p._id)).delete();
  });

  localStorage.setItem("lastSync", String(serverTime));
}
async function doSync() {
  try {
    do {
      dirty = false;
      await push();
    } while (dirty);
    await pull();
  } catch (err) {
    console.log("Sync failed, will retry:", err.message);
  }
}
export function syncNow() {
  if (!navigator.onLine) return Promise.resolve();
  if (currentSync) return currentSync;
  currentSync = doSync().finally(() => {
    currentSync = null;
  });
  return currentSync;
}
export function requestSync() {
  dirty = true;
  return syncNow();
}
export function startAutoSync() {
  if (started) return;
  started = true;
  window.addEventListener("online", syncNow);
  setInterval(syncNow, 30000);
  syncNow();
}
export async function clearLocalData() {
  await Promise.all([db.customers.clear(), db.payments.clear(), db.locations.clear(), db.outbox.clear()]);
  localStorage.removeItem("lastSync");
}
