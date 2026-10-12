import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";
import { syncNow } from "../sync";

export default function SyncStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  const pending = useLiveQuery(() => db.outbox.count(), [], 0);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return (
    <div className="flex items-center gap-2 text-xs font-bold">
      <span className={online ? "text-emerald-600" : "text-red-600"}>
        {online ? "● Online" : "● Offline"}
      </span>
      {pending > 0 && (
        <button
          type="button"
          onClick={syncNow}
          className="rounded-lg bg-amber-100 px-2 py-1 text-amber-700"
        >
          {pending} pending {online ? "· Sync now" : ""}
        </button>
      )}
    </div>
  );
}