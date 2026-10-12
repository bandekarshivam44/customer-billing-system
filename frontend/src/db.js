import Dexie from "dexie";

export const db = new Dexie("billingDB");

db.version(1).stores({
  customers: "_id, code, name",
  locations: "_id",
  payments: "_id, clientId, customer, paidAt, synced", // synced: 1 done, 0 pending, -1 rejected
  outbox: "++seq",
});