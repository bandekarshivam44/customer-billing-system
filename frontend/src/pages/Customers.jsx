import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import {
  Search,
  SlidersHorizontal,
  LayoutGrid,
  Table2,
  UserPlus,
  ChevronRight,
  MapPin,
  RefreshCw,
  User,
  X,
  Trash2,
  Plus,
  Users,
  UserCheck,
  IndianRupee,
  Clock3,
  Moon,
  Sun,
  Download,
  Upload,
  FileSpreadsheet,
  Edit3,
  Save,
  FileText,
  CheckCircle2,
  Phone,
  CreditCard,
  CalendarDays,
  Copy,
  Check,
} from "lucide-react";
import { setFakeNow, isFakeNowActive, clearFakeNow } from "../utils/testClock";
import api from "../services/api";
import { useTheme } from "../context/ThemeContext";
// ======================================================
// MONTHS
// ======================================================

const months = [
  { number: 1, short: "JAN", name: "January" },
  { number: 2, short: "FEB", name: "February" },
  { number: 3, short: "MAR", name: "March" },
  { number: 4, short: "APR", name: "April" },
  { number: 5, short: "MAY", name: "May" },
  { number: 6, short: "JUN", name: "June" },
  { number: 7, short: "JUL", name: "July" },
  { number: 8, short: "AUG", name: "August" },
  { number: 9, short: "SEP", name: "September" },
  { number: 10, short: "OCT", name: "October" },
  { number: 11, short: "NOV", name: "November" },
  { number: 12, short: "DEC", name: "December" },
];
const currentMonth = new Date().getMonth() + 1;
const currentYear = new Date().getFullYear();

const getMonthInfo = (offset) => {
  const date = new Date(currentYear, currentMonth - 1 + offset, 1);

  return {
    number: date.getMonth() + 1,
    year: date.getFullYear(),
    short: months[date.getMonth()].short,
    name: months[date.getMonth()].name,
  };
};

const monthBeforePrevious = getMonthInfo(-2);
const previousMonth = getMonthInfo(-1);
const currentMonthInfo = getMonthInfo(0);
function useCurrentMonthInfo() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const checkDate = () => {
      const fresh = new Date();
      if (
        fresh.getMonth() !== now.getMonth() ||
        fresh.getFullYear() !== now.getFullYear()
      ) {
        setNow(fresh);
      }
    };
    const interval = setInterval(checkDate, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [now]);

  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const getInfo = (offset) => {
    const date = new Date(year, month - 1 + offset, 1);
    return {
      number: date.getMonth() + 1,
      year: date.getFullYear(),
      short: months[date.getMonth()].short,
      name: months[date.getMonth()].name,
    };
  };

  return {
    monthBeforePrevious: getInfo(-2),
    previousMonth: getInfo(-1),
    currentMonthInfo: getInfo(0),
  };
}

const getPackageAmountForMonth = (customer, month, year) => {
  let amount = Number(customer.packageAmount || 0);

  const targetKey = Number(year) * 12 + Number(month);

  const history = [...(customer.packageHistory || [])].sort((a, b) => {
    const aKey = Number(a.year) * 12 + Number(a.month);
    const bKey = Number(b.year) * 12 + Number(b.month);

    return aKey - bKey;
  });

  for (const item of history) {
    const itemKey = Number(item.year) * 12 + Number(item.month);

    if (itemKey <= targetKey) {
      amount = Number(item.amount || 0);
    }
  }

  return amount;
};
function getStatusForMonth(customer, month, year) {
  const targetKey = year * 12 + month;
  let status = "active";
  [...(customer.statusHistory || [])]
    .sort((a, b) => a.year * 12 + a.month - (b.year * 12 + b.month))
    .forEach((s) => {
      if (s.year * 12 + s.month <= targetKey) status = s.status;
    });
  return status;
}

function getEffectivePackageForMonth(customer, month, year) {
  const status = getStatusForMonth(customer, month, year);
  if (status === "inactive" || status === "free") return 0;
  return getPackageAmountForMonth(customer, month, year);
}
function TestClockWidget() {
  const [value, setValue] = useState(() => {
    const saved = localStorage.getItem("app_fake_now");
    return saved ? saved.slice(0, 10) : "";
  });
  const active = isFakeNowActive();

  const apply = () => {
    if (!value) return;
    setFakeNow(new Date(value).toISOString());
    window.location.reload();
  };

  const reset = () => {
    clearFakeNow();
    window.location.reload();
  };

  return (
    <div className="fixed bottom-4 left-4 z-[200] flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs shadow-lg dark:border-amber-800 dark:bg-amber-950">
      <span className="font-bold text-amber-700 dark:text-amber-300">
        TEST DATE
      </span>
      <input
        type="date"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="rounded-lg border border-amber-300 bg-white px-2 py-1 text-xs dark:border-amber-700 dark:bg-slate-900 dark:text-white"
      />
      <button
        type="button"
        onClick={apply}
        className="rounded-lg bg-amber-600 px-2 py-1 font-bold text-white hover:bg-amber-700"
      >
        Set
      </button>
      {active && (
        <button
          type="button"
          onClick={reset}
          className="rounded-lg border border-amber-400 px-2 py-1 font-bold text-amber-700 hover:bg-amber-100 dark:text-amber-300"
        >
          Reset to real time
        </button>
      )}
    </div>
  );
}

function getMonthBalanceCalc(customer, payments, month, year) {
  const startM = Number(customer.billingStartMonth) || month;
  const startY = Number(customer.billingStartYear) || year;
  const targetKey = year * 12 + month;
  if (customer.status === "free") return 0;

  let due = 0,
    m = startM,
    y = startY;
  while (y * 12 + m <= targetKey) {
    due += getEffectivePackageForMonth(customer, m, y);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  const adjustmentTotal = (customer.balanceOverrides || [])
    .filter((o) => o.year * 12 + o.month <= targetKey)
    .reduce((sum, o) => sum + (o.type === "deduct" ? -o.amount : o.amount), 0);
  due += adjustmentTotal;
  const customerPayments = payments.filter((p) => {
    const pc = p.customer?._id || p.customer;
    return String(pc) === String(customer._id);
  });
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
  const paid = customerPayments
    .filter((p) => new Date(p.paidAt) <= monthEnd)
    .reduce((s, p) => s + Number(p.amount || 0), 0);
  return Math.max(0, due - paid);
}

function buildScheduleRows(customer, uptoMonth, uptoYear) {
  const overridesByMonth = new Map();
  (customer.balanceOverrides || []).forEach((o) => {
    const key = `${o.year}-${o.month}`;
    if (!overridesByMonth.has(key)) overridesByMonth.set(key, []);
    overridesByMonth.get(key).push(o);
  });

  const startM = Number(customer.billingStartMonth) || uptoMonth;
  const startY = Number(customer.billingStartYear) || uptoYear;

  const rows = [];
  let m = startM,
    y = startY;
  while (y * 12 + m <= uptoYear * 12 + uptoMonth) {
    const pkg = getEffectivePackageForMonth(customer, m, y);
    const monthLabel = months.find((mo) => mo.number === m)?.name || m;
    const adjustments = overridesByMonth.get(`${y}-${m}`) || [];
    const adjustmentSum = adjustments.reduce(
      (s, o) => s + (o.type === "deduct" ? -o.amount : o.amount),
      0,
    );
    const netDue = Math.max(0, pkg + adjustmentSum);

    rows.push({
      month: m,
      year: y,
      label: `${monthLabel} ${y}`,
      pkgAmount: pkg,
      adjustments,
      netDue,
    });

    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return rows;
}

function getFullSchedule(customer, payments) {
  if (customer.status === "free") return [];

  const customerPayments = payments.filter((p) => {
    const pc = p.customer?._id || p.customer;
    return String(pc) === String(customer._id);
  });
  const totalPaid = customerPayments.reduce(
    (s, p) => s + Number(p.amount || 0),
    0,
  );

  const now = new Date();
  let uptoMonth = now.getMonth() + 1,
    uptoYear = now.getFullYear();

  let rows = buildScheduleRows(customer, uptoMonth, uptoYear);
  let totalDue = rows.reduce((s, r) => s + r.netDue, 0);

  let safety = 0;
  while (totalDue < totalPaid && safety < 240) {
    uptoMonth++;
    if (uptoMonth > 12) {
      uptoMonth = 1;
      uptoYear++;
    }
    rows = buildScheduleRows(customer, uptoMonth, uptoYear);
    totalDue = rows.reduce((s, r) => s + r.netDue, 0);
    safety++;
  }

  let remainingPaid = totalPaid;
  return rows.map((r) => {
    const applied = Math.min(remainingPaid, r.netDue);
    remainingPaid -= applied;
    return {
      ...r,
      paidAmount: applied,
      remaining: r.netDue - applied,
      cleared: r.netDue === 0 || applied >= r.netDue,
    };
  });
}

function getFullDueBreakdownWithStatus(customer, payments) {
  const schedule = getFullSchedule(customer, payments);
  const entries = [];
  schedule.forEach((r) => {
    entries.push({
      label: r.label,
      amount: r.pkgAmount,
      isAdjustment: false,
      month: r.month,
      year: r.year,
      paidAmount: r.paidAmount,
      remaining: r.remaining,
      cleared: r.cleared,
    });
    r.adjustments.forEach((o) => {
      entries.push({
        label: `${o.type === "deduct" ? "Deducted" : "Added"} — ${r.label}${o.reason ? ` (${o.reason})` : ""}`,
        amount: o.type === "deduct" ? -o.amount : o.amount,
        isAdjustment: true,
        month: r.month,
        year: r.year,
        paidAmount: 0,
        remaining: 0,
        cleared: true,
      });
    });
  });
  return entries;
}

function getEarliestUnresolvedMonth(customer, payments) {
  const schedule = getFullSchedule(customer, payments);
  const first = schedule.find((r) => r.remaining > 0);
  if (first) return { month: first.month, year: first.year };

  const last = schedule[schedule.length - 1];
  const now = new Date();
  if (!last) return { month: now.getMonth() + 1, year: now.getFullYear() };
  let m = last.month + 1,
    y = last.year;
  if (m > 12) {
    m = 1;
    y++;
  }
  return { month: m, year: y };
}
// ======================================================
// BALANCE MODAL
// ======================================================
function BalanceModal({ customer, payments = [], onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [adjType, setAdjType] = useState("deduct");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const now = new Date();
  const currentBalance = getMonthBalanceCalc(
    customer,
    payments,
    now.getMonth() + 1,
    now.getFullYear(),
  );
  const dueBreakdown = getFullDueBreakdownWithStatus(customer, payments).filter(
    (d) => {
      if (d.isAdjustment) return true;
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - 6);
      return new Date(d.year, d.month - 1, 1) >= cutoff;
    },
  );
  const target = getEarliestUnresolvedMonth(customer, payments);
  const targetLabel = `${months.find((m) => m.number === target.month)?.name} ${target.year}`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      alert("Enter a valid amount");
      return;
    }
    try {
      setSaving(true);
      await api.post(`/customers/${customer._id}/balance-adjustments`, {
        month: target.month,
        year: target.year,
        type: adjType,
        amount: Number(amount),
        reason,
        paidAt: new Date().toISOString(),
      });
      setAmount("");
      setReason("");
      await onSaved?.();
    } catch (error) {
      console.error(
        "FAILED TO SAVE ADJUSTMENT:",
        error.response?.data || error,
      );
      alert(error.response?.data?.message || "Failed to save adjustment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
              Customer Balance
            </p>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {String(customer?.name || "").toUpperCase()}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X size={20} />
          </button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto p-5">
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 dark:border-indigo-900/50 dark:bg-indigo-950/30">
            <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
              Current Outstanding Balance
            </p>
            <p className="text-xl font-black text-indigo-700 dark:text-indigo-300">
              ₹{currentBalance.toLocaleString("en-IN")}
            </p>
          </div>

          <div className="mt-4 space-y-1.5">
            {dueBreakdown.map((d, i) => {
              if (d.isAdjustment) {
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900/40 dark:bg-amber-950/20"
                  >
                    <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                      {d.label}
                    </span>
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-300">
                      {d.amount < 0 ? "−" : ""}₹
                      {Math.abs(d.amount).toLocaleString("en-IN")}
                    </span>
                  </div>
                );
              }

              const realBalance = getMonthBalanceCalc(
                customer,
                payments,
                d.month,
                d.year,
              );
              const paidThisMonth = getMonthPaidAmount(
                payments,
                customer._id,
                d.month,
                d.year,
              );

              return (
                <div
                  key={i}
                  className={`rounded-lg border px-3 py-2 ${
                    d.cleared
                      ? "border-emerald-100 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20"
                      : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                  }`}
                >
                  <p
                    className={`mb-1.5 text-xs font-semibold ${d.cleared ? "text-slate-400 line-through" : "text-slate-700 dark:text-slate-200"}`}
                  >
                    {d.label}
                  </p>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">
                        Due
                      </p>
                      <p
                        className={`text-xs font-bold ${d.cleared ? "text-slate-400 line-through" : "text-slate-700 dark:text-slate-200"}`}
                      >
                        ₹{Number(d.amount).toLocaleString("en-IN")}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">
                        Paid
                      </p>
                      <p className="text-xs font-bold text-emerald-600">
                        ₹{paidThisMonth.toLocaleString("en-IN")}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">
                        Balance
                      </p>
                      <p
                        className={`text-xs font-bold ${realBalance > 0 ? "text-red-600" : "text-emerald-600"}`}
                      >
                        ₹{realBalance.toLocaleString("en-IN")}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <form
            onSubmit={handleSubmit}
            className="mt-5 space-y-3 border-t border-slate-200 pt-4 dark:border-slate-700"
          >
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Adjust balance — will apply to{" "}
              <span className="text-indigo-600 dark:text-indigo-400">
                {targetLabel}
              </span>
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAdjType("deduct")}
                className={`rounded-xl border px-4 py-3 text-sm font-bold ${adjType === "deduct" ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30" : "border-slate-200 text-slate-600 dark:border-slate-700"}`}
              >
                − Deduct
              </button>
              <button
                type="button"
                onClick={() => setAdjType("add")}
                className={`rounded-xl border px-4 py-3 text-sm font-bold ${adjType === "add" ? "border-red-500 bg-red-50 text-red-700 dark:bg-red-950/30" : "border-slate-200 text-slate-600 dark:border-slate-700"}`}
              >
                + Add
              </button>
            </div>

            <div className="relative">
              <IndianRupee
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Amount"
                className="w-full rounded-xl border border-slate-300 py-3 pl-9 pr-4 text-sm font-bold dark:border-slate-600 dark:bg-slate-900 dark:text-white"
              />
            </div>

            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (optional) — e.g. 'Discount', 'Late fee'"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : `${adjType === "deduct" ? "Deduct" : "Add"} ₹${amount || 0} on ${targetLabel}`}
            </button>
          </form>
        </div>

        <div className="flex gap-3 border-t border-slate-200 p-4 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
// ======================================================
// PaymentModal ONLY
// ======================================================
function PaymentModal({ customer, payments = [], onClose, onSaved }) {
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);
  const now = new Date();
  const currentBalance = getMonthBalanceCalc(
    customer,
    payments,
    now.getMonth() + 1,
    now.getFullYear(),
  );
  const [amount, setAmount] = useState(String(customer.packageAmount || ""));
  const [addedBy, setAddedBy] = useState("RAJESH");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!amount || Number(amount) <= 0) {
      alert("Enter a valid payment amount");
      return;
    }

    try {
      setSaving(true);

      await api.post("/payments", {
        customer: customer._id,
        month: Number(month),
        year: Number(year),
        amount: Number(amount),
        addedBy,
        note,
        paidAt: new Date().toISOString(),
      });

      setAmount(String(customer.packageAmount || ""));
      setNote("");

      await onSaved();
    } catch (error) {
      console.error(error);

      alert(error.response?.data?.message || "Failed to save payment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        {/* ================= HEADER ================= */}
        <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-4 dark:border-slate-700 dark:bg-slate-800/60">
          <div className="flex items-start justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                  <IndianRupee size={18} />
                </div>

                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    Payment
                  </p>

                  <h2 className="text-lg font-bold leading-tight text-slate-900 dark:text-white">
                    Add Payment
                  </h2>
                </div>
              </div>

              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {customer.name}
                </span>
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-xl p-2 text-slate-400 transition hover:bg-white hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-white"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {/* ================= MONTH + YEAR ================= */}
          <div className="grid grid-cols-2 gap-3">
            {/* Month */}
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Month
              </label>

              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:ring-indigo-950"
              >
                {months.map((item) => (
                  <option key={item.number} value={item.number}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Year */}
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Year
              </label>

              <input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:ring-indigo-950"
              />
            </div>
          </div>

          {/* ================= CURRENT BALANCE ================= */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Current Outstanding
                </p>

                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Balance before this payment
                </p>
              </div>

              <div className="text-right">
                <p
                  className={`text-2xl font-black ${
                    currentBalance > 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  ₹{currentBalance.toLocaleString("en-IN")}
                </p>

                <div
                  className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    currentBalance > 0
                      ? "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400"
                      : "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
                  }`}
                >
                  {currentBalance > 0 ? "OUTSTANDING" : "PAID"}
                </div>
              </div>
            </div>
          </div>

          {/* ================= AMOUNT ================= */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Amount Paid
            </label>

            <div className="relative">
              <IndianRupee
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter payment amount"
                autoFocus
                className="w-full rounded-xl border border-slate-200 bg-white py-3.5 pl-11 pr-4 text-base font-semibold text-slate-800 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:ring-indigo-950"
              />
            </div>
          </div>

          {/* ================= ADDED BY ================= */}
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Added By
            </label>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAddedBy("RAJESH")}
                className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition ${
                  addedBy === "RAJESH"
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm dark:border-indigo-500 dark:bg-indigo-950 dark:text-indigo-300"
                    : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-indigo-700"
                }`}
              >
                {addedBy === "RAJESH" && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-xs text-white">
                    ✓
                  </span>
                )}
                Rajesh
              </button>

              <button
                type="button"
                onClick={() => setAddedBy("SHIVAM")}
                className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition ${
                  addedBy === "SHIVAM"
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm dark:border-indigo-500 dark:bg-indigo-950 dark:text-indigo-300"
                    : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-indigo-700"
                }`}
              >
                {addedBy === "SHIVAM" && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-xs text-white">
                    ✓
                  </span>
                )}
                Shivam
              </button>
            </div>
          </div>

          {/* ================= NOTE ================= */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Note{" "}
              <span className="font-normal normal-case tracking-normal text-slate-400">
                (optional)
              </span>
            </label>

            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Example: Cash payment"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:ring-indigo-950"
            />
          </div>

          {/* ================= ACTIONS ================= */}
          <div className="flex gap-3 border-t border-slate-100 pt-4 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                "Saving..."
              ) : (
                <>
                  <IndianRupee size={16} />
                  Save Payment
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
// ======================================================
// COLLECTION MODAL
// ======================================================
function CollectionModal({ summary, onClose }) {
  const rows = [
    { key: "old", label: "old" },
    { key: "previous", label: "previous" },
    { key: "current", label: "current" },
  ];

  const grandTotal =
    summary.old.total + summary.previous.total + summary.current.total;
  const grandRajesh =
    summary.old.rajesh + summary.previous.rajesh + summary.current.rajesh;
  const grandShivam =
    summary.old.shivam + summary.previous.shivam + summary.current.shivam;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
              Payment Collection
            </p>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Last 3 Months
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Collection summary by month
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
          >
            <X size={20} />
          </button>
        </div>

        {/* CONTENT */}
        <div className="max-h-[65vh] overflow-y-auto p-5">
          <div className="space-y-3">
            {rows.map(({ key }) => {
              const m = summary[key];
              return (
                <div
                  key={key}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {m.name} {m.year}
                    </p>
                    <span className="text-xs font-semibold text-slate-400">
                      {m.count} payment{m.count !== 1 ? "s" : ""}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-white p-3 text-center dark:bg-slate-900">
                      <p className="text-[10px] font-bold uppercase text-slate-400">
                        Rajesh
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-700 dark:text-slate-200">
                        ₹{m.rajesh.toLocaleString("en-IN")}
                      </p>
                    </div>
                    <div className="rounded-xl bg-white p-3 text-center dark:bg-slate-900">
                      <p className="text-[10px] font-bold uppercase text-slate-400">
                        Shivam
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-700 dark:text-slate-200">
                        ₹{m.shivam.toLocaleString("en-IN")}
                      </p>
                    </div>
                    <div className="rounded-xl bg-indigo-600 p-3 text-center">
                      <p className="text-[10px] font-bold uppercase text-indigo-200">
                        Total
                      </p>
                      <p className="mt-1 text-sm font-bold text-white">
                        ₹{m.total.toLocaleString("en-IN")}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* GRAND TOTAL */}
          <div className="mt-4 rounded-2xl bg-indigo-600 p-5 text-white">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-200">
              3-Month Total
            </p>
            <p className="mt-2 text-3xl font-bold">
              ₹{grandTotal.toLocaleString("en-IN")}
            </p>
            <div className="mt-3 flex justify-between text-sm text-indigo-200">
              <span>Rajesh: ₹{grandRajesh.toLocaleString("en-IN")}</span>
              <span>Shivam: ₹{grandShivam.toLocaleString("en-IN")}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
// ======================================================
// CUSTOMER DETAILS MODAL
// ======================================================
function getDueTotalUpTo(customer, month, year) {
  const startM = Number(customer.billingStartMonth) || month;
  const startY = Number(customer.billingStartYear) || year;
  const targetKey = year * 12 + month;

  let due = 0,
    m = startM,
    y = startY;
  while (y * 12 + m <= targetKey) {
    due += getPackageAmountForMonth(customer, m, y);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }

  const adjustmentTotal = (customer.balanceOverrides || [])
    .filter((o) => o.year * 12 + o.month <= targetKey)
    .reduce((sum, o) => sum + (o.type === "deduct" ? -o.amount : o.amount), 0);

  return due + adjustmentTotal;
}
function addMonths(month, year, n) {
  let m = month + n,
    y = year;
  while (m > 12) {
    m -= 12;
    y += 1;
  }
  while (m < 1) {
    m += 12;
    y -= 1;
  }
  return { month: m, year: y };
}
function buildDueBuckets(customer, uptoMonth, uptoYear) {
  const startM = Number(customer.billingStartMonth) || uptoMonth;
  const startY = Number(customer.billingStartYear) || uptoYear;
  const targetKey = uptoYear * 12 + uptoMonth;

  const buckets = [];
  let m = startM,
    y = startY;

  while (y * 12 + m <= targetKey) {
    const pkg = getPackageAmountForMonth(customer, m, y);
    const monthLabel = months.find((mo) => mo.number === m)?.name || m;

    let amount = pkg;
    (customer.balanceOverrides || [])
      .filter((o) => o.month === m && o.year === y)
      .forEach((o) => {
        amount += o.type === "deduct" ? -o.amount : o.amount;
      });

    buckets.push({
      month: m,
      year: y,
      label: `${monthLabel} ${y}`,
      amount: Math.max(0, amount),
    });
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }

  return buckets;
}

function computePaymentAllocations(customer, payments) {
  const now = new Date(); // swap to getNow() once the test-clock widget is wired in
  const buckets = buildDueBuckets(
    customer,
    now.getMonth() + 1,
    now.getFullYear(),
  ).map((b) => ({ ...b, remaining: b.amount }));

  const sorted = payments.slice().sort((a, b) => {
    const diff = new Date(a.paidAt) - new Date(b.paidAt);
    if (diff !== 0) return diff;
    return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
  });

  let bucketIndex = 0;

  return sorted.map((payment) => {
    let amount = Number(payment.amount || 0);
    const allocations = [];

    // Skip any already-cleared buckets, then fill oldest-unpaid-first —
    // this naturally covers a past unpaid month before ever touching the future
    while (amount > 0 && bucketIndex < buckets.length) {
      const bucket = buckets[bucketIndex];
      if (bucket.remaining <= 0) {
        bucketIndex++;
        continue;
      }

      const applied = Math.min(amount, bucket.remaining);
      bucket.remaining -= applied;
      amount -= applied;
      allocations.push({ label: bucket.label, amount: applied });

      if (bucket.remaining > 0) break; // this payment ran out mid-bucket
    }

    // Payment still has leftover after clearing everything known so far —
    // only NOW do we push forward into a brand-new future month
    if (amount > 0) {
      const last = buckets[buckets.length - 1];
      let m = last ? last.month : now.getMonth() + 1;
      let y = last ? last.year : now.getFullYear();

      while (amount > 0) {
        const next = addMonths(m, y, 1);
        m = next.month;
        y = next.year;

        const pkg = getPackageAmountForMonth(customer, m, y);
        const monthLabel = months.find((mo) => mo.number === m)?.name || m;
        const newBucket = {
          month: m,
          year: y,
          label: `${monthLabel} ${y}`,
          amount: pkg,
          remaining: pkg,
        };
        buckets.push(newBucket);

        const applied = Math.min(amount, newBucket.remaining);
        newBucket.remaining -= applied;
        amount -= applied;
        allocations.push({ label: newBucket.label, amount: applied });
      }
    }

    return { ...payment, allocations };
  });
}

function buildTimeline(customer, payments) {
  if (!customer) return [];

  const allocations = computePaymentAllocations(customer, payments);
  const paymentEntries = allocations.map((p) => ({
    type: "payment",
    date: p.paidAt,
    data: p,
  }));

  const overrideEntries = (customer.balanceOverrides || []).map((o) => ({
    type: "adjustment",
    date: o.createdAt,
    data: o,
  }));

  return [...paymentEntries, ...overrideEntries].sort(
    (a, b) => new Date(b.date) - new Date(a.date),
  );
}

function PaymentEntryCard({ payment }) {
  const paymentDate = new Date(payment.paidAt);
  const paymentMonth = paymentDate.toLocaleString("en-IN", { month: "long" });
  const paymentYear = paymentDate.getFullYear();

  return (
    <div className="border-l-4 border-emerald-500 p-5 pl-4 transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-bold text-slate-900 dark:text-white">
              {paymentMonth}
            </p>
            <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {paymentYear}
            </span>
          </div>

          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            Collected by{" "}
            <span className="font-bold text-slate-700 dark:text-slate-200">
              {payment.addedBy || "Rajesh"}
            </span>
          </p>

          {payment.note && (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-400">
              <FileText size={13} className="mt-0.5 shrink-0" />
              {payment.note}
            </p>
          )}

          {payment.allocations && payment.allocations.length > 0 && (
            <div className="mt-3 space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
              {payment.allocations.map((a, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-slate-500 dark:text-slate-400">
                    Applied to {a.label}
                  </span>
                  <span className="font-bold text-slate-700 dark:text-slate-200">
                    ₹{Number(a.amount).toLocaleString("en-IN")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0 text-right">
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
            +₹{Number(payment.amount).toLocaleString("en-IN")}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            {paymentDate.toLocaleDateString("en-IN")}
          </p>
        </div>
      </div>
    </div>
  );
}

function AdjustmentEntryCard({ override }) {
  const monthLabel =
    months.find((m) => m.number === override.month)?.name || override.month;
  const isDeduct = override.type === "deduct";

  return (
    <div className="border-l-4 border-amber-500 p-5 pl-4 transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-slate-900 dark:text-white">
              {monthLabel}
            </p>
            <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {override.year}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {isDeduct ? "Deducted from" : "Added to"} balance
            {override.reason && (
              <span className="italic"> — {override.reason}</span>
            )}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p
            className={`text-lg font-bold ${isDeduct ? "text-emerald-600" : "text-red-600"}`}
          >
            {isDeduct ? "−" : "+"}₹
            {Number(override.amount).toLocaleString("en-IN")}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            {new Date(override.createdAt).toLocaleDateString("en-IN")}
          </p>
        </div>
      </div>
    </div>
  );
}

function DetailItem({ icon, label, value }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-slate-400">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
          {label}
        </p>
        <p className="mt-0.5 truncate text-sm font-semibold text-slate-700 dark:text-slate-200">
          {value}
        </p>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, icon, positive = false, className = "" }) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-xl ${positive ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"}`}
        >
          {icon}
        </span>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          {label}
        </p>
      </div>
      <p
        className={`mt-3 text-xl font-bold ${positive ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-white"}`}
      >
        {value}
      </p>
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">
        {label}
      </label>
      {children}
    </div>
  );
}

function CustomerDetailsModal({ customerId, onClose }) {
  const id = customerId;
  const now = new Date();

  const [customer, setCustomer] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [showPayment, setShowPayment] = useState(false);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [amount, setAmount] = useState("");
  const [addedBy, setAddedBy] = useState("RAJESH");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const loadCustomer = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/customers/${id}`);
      setCustomer(response.data.data);
    } catch (error) {
      console.error("Failed to load customer:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadPayments = async () => {
    try {
      setPaymentsLoading(true);
      const response = await api.get(`/payments/customer/${id}`);
      setPayments(response.data.data || []);
    } catch (error) {
      console.error("Failed to load payments:", error);
    } finally {
      setPaymentsLoading(false);
    }
  };

  useEffect(() => {
    loadCustomer();
    loadPayments();
  }, [id]);

  const handlePayment = async (e) => {
    e.preventDefault();
    const numericAmount = Number(amount);
    if (!amount || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      alert("Enter a valid payment amount.");
      return;
    }
    try {
      setSaving(true);
      await api.post("/payments", {
        customer: id,
        month: Number(month),
        year: Number(year),
        amount: numericAmount,
        addedBy,
        note: note.trim(),
      });
      setAmount("");
      setNote("");
      setShowPayment(false);
      await Promise.all([loadCustomer(), loadPayments()]);
    } catch (error) {
      console.error("Payment failed:", error);
      alert(error.response?.data?.message || "Failed to save payment.");
    } finally {
      setSaving(false);
    }
  };

  const totalPaid = useMemo(
    () =>
      payments.reduce(
        (total, payment) => total + Number(payment.amount || 0),
        0,
      ),
    [payments],
  );

  const timeline = useMemo(() => {
    const full = buildTimeline(customer, payments);
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 6);
    return full.filter((entry) => new Date(entry.date) >= cutoff);
  }, [customer, payments]);

  const currentBalance = customer
    ? getMonthBalanceCalc(
        customer,
        payments,
        now.getMonth() + 1,
        now.getFullYear(),
      )
    : 0;

  const packageAmount = Number(customer?.packageAmount || 0);

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
        <div className="rounded-2xl bg-white p-8 text-center dark:bg-slate-900">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600 dark:border-slate-700 dark:border-t-indigo-400" />
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            Loading customer...
          </p>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="font-semibold text-slate-700 dark:text-slate-200">
            Customer not found
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-5 h-11 rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white hover:bg-indigo-700"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-slate-50 p-4 shadow-2xl dark:bg-slate-950 sm:p-6">
        <div className="border-b rounded-t-2xl border-slate-200 bg-slate-50/80 px-5 py-4 dark:border-slate-700 dark:bg-slate-800/60">
          {" "}
          <div className="flex items-center justify-between">
            {" "}
            <div className="flex items-center gap-3">
              {" "}
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                {" "}
                <User size={18} />{" "}
              </div>{" "}
              <div>
                {" "}
                <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  {" "}
                  Customer Details{" "}
                </p>{" "}
                <h2 className="text-lg font-bold leading-tight text-slate-900 dark:text-white">
                  {" "}
                  {customer.name}{" "}
                </h2>{" "}
              </div>{" "}
            </div>{" "}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="cursor-pointer rounded-xl p-2 text-slate-400 transition hover:bg-white hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-white"
            >
              {" "}
              <X size={20} />{" "}
            </button>{" "}
          </div>{" "}
        </div>

        <div className="overflow-hidden rounded-b-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400">
                    {customer.code}
                  </span>
                  {customer.active !== false && (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold tracking-wide text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                      ACTIVE
                    </span>
                  )}
                </div>

                <h1 className="break-words text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
                  {customer.name}
                </h1>

                <div className="mt-4 grid grid-cols-1 gap-5 text-sm sm:grid-cols-2">
                  <DetailItem
                    icon={<CreditCard size={15} />}
                    label="NUID"
                    value={customer.nuid || "-"}
                  />
                  <DetailItem
                    icon={<MapPin size={15} />}
                    label="Location"
                    value={customer.location?.name || "-"}
                  />
                  <DetailItem
                    icon={<CreditCard size={15} />}
                    label="Package"
                    value={`₹${packageAmount.toLocaleString("en-IN")} / month`}
                  />
                  <DetailItem
                    icon={<Phone size={15} />}
                    label="Mobile"
                    value={customer.mobile || "-"}
                  />
                  <DetailItem
                    icon={<CalendarDays size={15} />}
                    label="Billing Start"
                    value={
                      customer.billingStartMonth && customer.billingStartYear
                        ? `${months.find((m) => m.number === Number(customer.billingStartMonth))?.name} ${customer.billingStartYear}`
                        : "-"
                    }
                  />
                </div>
              </div>
            </div>
          </div>
          <div
            className={`border-t px-5 py-4 sm:px-6 ${currentBalance > 0 ? "border-red-100 bg-red-50 dark:border-red-500/10 dark:bg-red-500/10" : "border-emerald-100 bg-emerald-50 dark:border-emerald-500/10 dark:bg-emerald-500/10"}`}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p
                  className={`text-xs font-bold uppercase tracking-wide ${currentBalance > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}
                >
                  {currentBalance > 0
                    ? "Outstanding Balance"
                    : "Account Status"}
                </p>
                <p
                  className={`mt-1 text-2xl font-black ${currentBalance > 0 ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}
                >
                  ₹{Number(currentBalance || 0).toLocaleString("en-IN")}
                </p>
                <p
                  className={`mt-0.5 text-xs font-medium ${currentBalance > 0 ? "text-red-500 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}
                >
                  {currentBalance > 0
                    ? "Amount currently outstanding"
                    : "All payments are up to date"}
                </p>
              </div>
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${currentBalance > 0 ? "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400" : "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"}`}
              >
                {currentBalance > 0 ? (
                  <CreditCard size={21} />
                ) : (
                  <CheckCircle2 size={21} />
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <SummaryCard
            label="Monthly Package"
            value={`₹${packageAmount.toLocaleString("en-IN")}`}
            icon={<CreditCard size={17} />}
          />
          <SummaryCard
            label="Total Paid"
            value={`₹${totalPaid.toLocaleString("en-IN")}`}
            icon={<CheckCircle2 size={17} />}
            positive
          />
          <SummaryCard
            label="Payment Records"
            value={payments.length}
            icon={<FileText size={17} />}
            className="col-span-2 sm:col-span-1"
          />
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                <CalendarDays size={19} />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 dark:text-white">
                  Payment History
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Payments and balance adjustments
                </p>
              </div>
            </div>
            {timeline.length > 0 && (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {timeline.length} {timeline.length === 1 ? "entry" : "entries"}
              </span>
            )}
          </div>

          {paymentsLoading ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {[1, 2, 3].map((item) => (
                <div key={item} className="p-5">
                  <div className="h-5 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                  <div className="mt-3 h-4 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                </div>
              ))}
            </div>
          ) : timeline.length === 0 ? (
            <div className="p-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                <CreditCard size={24} className="text-slate-400" />
              </div>
              <h3 className="mt-4 font-bold text-slate-900 dark:text-white">
                No activity yet
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Payments and balance adjustments will appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {timeline.map((entry, i) =>
                entry.type === "payment" ? (
                  <PaymentEntryCard
                    key={entry.data._id || i}
                    payment={entry.data}
                  />
                ) : (
                  <AdjustmentEntryCard key={`adj-${i}`} override={entry.data} />
                ),
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
// ======================================================
// CUSTOMER CARD
// ======================================================
function CustomerCard({
  customer,
  payments,
  currentMonthInfo,
  onClick,
  onAddPayment,
  onEdit,
  onBalance,
}) {
  const currentMonth = currentMonthInfo.number;
  const currentYear = currentMonthInfo.year;

  const currentMonthPaid = getMonthPaidAmount(
    payments,
    customer._id,
    currentMonth,
    currentYear,
  );

  // Total outstanding carried forward through current month
  const balance = getMonthBalanceCalc(
    customer,
    payments,
    currentMonth,
    currentYear,
  );

  // Existing detailed billing/payment allocation
  const breakdown = getFullDueBreakdownWithStatus(
    customer,
    payments,
    currentMonth,
    currentYear,
  );

  // Show only months that still have money outstanding
  const outstandingMonths = breakdown.filter(
    (item) => !item.isAdjustment && item.remaining > 0,
  );
const currentStatus =
  customer.statusHistory?.length > 0
    ? customer.statusHistory[customer.statusHistory.length - 1].status
    : customer.status;
  return (
    <div className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900">
      {/* CUSTOMER HEADER */}
      <button
        type="button"
        onClick={onClick}
        className="w-full cursor-pointer p-5 text-left"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2">
              <span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                {customer.code}
              </span>
{currentStatus === "active" && (
  <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
    ACTIVE
  </span>
)}

{currentStatus === "inactive" && (
  <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
    INACTIVE
  </span>
)}

{currentStatus === "free" && (
  <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
    FREE
  </span>
)}

{currentStatus === "dc" && (
  <span className="rounded-full bg-red-50 px-2 py-1 text-[10px] font-bold text-red-700 dark:bg-red-950 dark:text-red-300">
    DC
  </span>
)}
            </div>

            <h2 className="truncate text-lg font-bold text-slate-900 dark:text-white">
              {customer.name}
            </h2>
          </div>

          <ChevronRight
            size={20}
            className="shrink-0 text-slate-300 transition group-hover:translate-x-1 group-hover:text-indigo-500"
          />
        </div>

        {/* DETAILS */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          {/* NUID */}
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              NUID
            </p>

            <p className="mt-1 truncate text-sm font-semibold text-slate-700 dark:text-slate-200">
              {customer.nuid || "-"}
            </p>
          </div>

          {/* PACKAGE */}
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Package
            </p>

            <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
              ₹{Number(customer.packageAmount || 0).toLocaleString("en-IN")}
              <span className="ml-1 text-[10px] font-medium text-slate-400">
                / month
              </span>
            </p>
          </div>

          {/* CURRENT MONTH PAID */}
          <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/30">
            <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
              Paid
            </p>

            <p className="mt-1 text-sm font-bold text-emerald-700 dark:text-emerald-400">
              ₹{currentMonthPaid.toLocaleString("en-IN")}
            </p>
          </div>

          {/* TOTAL BALANCE */}
          <div
            className={`rounded-xl p-3 ${
              balance > 0
                ? "bg-red-50 dark:bg-red-950/30"
                : "bg-emerald-50 dark:bg-emerald-950/30"
            }`}
          >
            <p
              className={`text-[10px] font-bold uppercase tracking-wide ${
                balance > 0
                  ? "text-red-600 dark:text-red-400"
                  : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              Balance
            </p>

            <p
              className={`mt-1 text-sm font-bold ${
                balance > 0
                  ? "text-red-700 dark:text-red-400"
                  : "text-emerald-700 dark:text-emerald-400"
              }`}
            >
              ₹{balance.toLocaleString("en-IN")}
            </p>
          </div>
        </div>
      </button>

      {/* BALANCE BREAKDOWN */}
      <div className="mx-5 mb-4 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            Balance Breakdown
          </p>

          <span
            className={`rounded-md px-2 py-1 text-[9px] font-black ${
              balance > 0
                ? "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400"
                : "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
            }`}
          >
            {balance > 0 ? "DUE" : "CLEAR"}
          </span>
        </div>

        {outstandingMonths.length > 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {outstandingMonths.map((item, index) => (
              <div
                key={`${item.label}-${index}`}
                className="flex items-center justify-between px-3 py-2.5"
              >
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {item.label}
                </span>

                <span className="text-xs font-bold text-red-600 dark:text-red-400">
                  ₹{Number(item.remaining || 0).toLocaleString("en-IN")}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-3 py-3 text-center">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              No outstanding balance
            </span>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
            Total Outstanding
          </span>

          <span
            className={`text-sm font-black ${
              balance > 0
                ? "text-red-600 dark:text-red-400"
                : "text-emerald-600 dark:text-emerald-400"
            }`}
          >
            ₹{balance.toLocaleString("en-IN")}
          </span>
        </div>
      </div>

      {/* ACTIONS */}
<div className="grid grid-cols-2 gap-2 border-t border-slate-100 px-5 py-4 dark:border-slate-800">
  {/* PAYMENT */}
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      onAddPayment();
    }}
    className="flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 text-sm font-bold text-white transition hover:bg-indigo-700 active:scale-[0.98]"
  >
    <Plus size={16} />
    Payment
  </button>

  {/* EDIT */}
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      onEdit();
    }}
    className="flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-indigo-700 dark:hover:bg-indigo-950 dark:hover:text-indigo-300"
  >
    <Edit3 size={16} />
    Edit
  </button>

  {/* BALANCE */}
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      onBalance();
    }}
    className="flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 text-sm font-bold text-amber-700 transition hover:bg-amber-100 active:scale-[0.98] dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300 dark:hover:bg-amber-900"
  >
    <IndianRupee size={16} />
    Balance
  </button>

  {/* DETAILS */}
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    className="flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-indigo-700 dark:hover:bg-indigo-950 dark:hover:text-indigo-300"
  >
    <ChevronRight size={16} />
    Details
  </button>
</div>
    </div>
  );
}

// ======================================================
// MONTH BALANCE
// ======================================================
// "Paid" column — real payment made in that calendar month
function getMonthPaidAmount(payments, customerId, month, year) {
  return payments
    .filter((p) => {
      const pc = p.customer?._id || p.customer;
      if (String(pc) !== String(customerId)) return false;
      const d = new Date(p.paidAt);
      return d.getMonth() + 1 === month && d.getFullYear() === year;
    })
    .reduce((s, p) => s + Number(p.amount || 0), 0);
}

// ======================================================
// EXPORT MODAL
// ======================================================

function ExportModal({
  customers,
  selectedCustomers,
  onClose,
  payments,
  monthBeforePrevious,
  previousMonth,
  currentMonthInfo,
}) {
  const [format, setFormat] = useState("excel");

  const [selectedColumns, setSelectedColumns] = useState([
    "code",
    "name",
    "nuid",
    "package",
    "oldPaid",
    "oldBalance",
    "previousPaid",
    "previousBalance",
    "currentPaid",
    "currentBalance",
  ]);

  const columns = [
    { key: "code", label: "CODE" },
    { key: "name", label: "NAME" },
    { key: "nuid", label: "NUID" },
    { key: "package", label: "PACKAGE" },

    {
      key: "oldPaid",
      label: `${monthBeforePrevious.short} PAID`,
    },
    {
      key: "oldBalance",
      label: `${monthBeforePrevious.short} BAL`,
    },

    {
      key: "previousPaid",
      label: `${previousMonth.short} PAID`,
    },
    {
      key: "previousBalance",
      label: `${previousMonth.short} BAL`,
    },

    {
      key: "currentPaid",
      label: `${currentMonthInfo.short} PAID`,
    },
    {
      key: "currentBalance",
      label: `${currentMonthInfo.short} BAL`,
    },
  ];

  const toggleColumn = (key) => {
    setSelectedColumns((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key],
    );
  };

  const getMonthPaymentForCustomer = (customer, monthNumber, year) => {
    const paymentsForCustomer = customer.payments || [];

    return paymentsForCustomer
      .filter((payment) => {
        const date = new Date(payment.paidAt);

        return (
          date.getMonth() + 1 === monthNumber && date.getFullYear() === year
        );
      })
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  };

  const getExportRows = () => {
    return selectedCustomers
      .map((customerId) => {
        const customer = customers.find(
          (item) => String(item._id) === String(customerId),
        );

        if (!customer) return null;

        const oldPaid = getMonthPaymentForCustomer(
          customer,
          monthBeforePrevious.number,
          monthBeforePrevious.year,
        );

        const previousPaid = getMonthPaymentForCustomer(
          customer,
          previousMonth.number,
          previousMonth.year,
        );

        const currentPaid = getMonthPaymentForCustomer(
          customer,
          currentMonthInfo.number,
          currentMonthInfo.year,
        );

        const row = {
          code: customer.code || "",
          name: customer.name || "",
          nuid: customer.nuid || "",
          package: Number(customer.packageAmount || 0),

          oldPaid,
          oldBalance: getMonthBalanceCalc(
            customer,
            customer.payments || [],
            monthBeforePrevious.number,
            monthBeforePrevious.year,
          ),

          previousPaid,
          previousBalance: getMonthBalanceCalc(
            customer,
            customer.payments || [],
            previousMonth.number,
            previousMonth.year,
          ),

          currentPaid,
          currentBalance: getMonthBalanceCalc(
            customer,
            customer.payments || [],
            currentMonthInfo.number,
            currentMonthInfo.year,
          ),
        };

        return row;
      })
      .filter(Boolean);
  };

  const exportExcel = () => {
    const rows = getExportRows();

    if (!rows.length) {
      alert("Please select at least one customer.");
      return;
    }

    if (!selectedColumns.length) {
      alert("Please select at least one column.");
      return;
    }

    const data = rows.map((row) => {
      const result = {};

      selectedColumns.forEach((key) => {
        const column = columns.find((item) => item.key === key);

        result[column.label] =
          key.includes("Paid") || key.includes("Balance") || key === "package"
            ? `₹${Number(row[key] || 0).toLocaleString("en-IN")}`
            : row[key];
      });

      return result;
    });

    const worksheet = XLSX.utils.json_to_sheet(data);

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Customers");

    XLSX.writeFile(
      workbook,
      `customer-billing-${currentMonthInfo.short}-${currentMonthInfo.year}.xlsx`,
    );

    onClose();
  };

  const exportPDF = () => {
    const rows = getExportRows();

    if (!rows.length) {
      alert("Please select at least one customer.");
      return;
    }

    if (!selectedColumns.length) {
      alert("Please select at least one column.");
      return;
    }

    const doc = new jsPDF({
      orientation: selectedColumns.length > 6 ? "landscape" : "portrait",
      unit: "mm",
      format: "a4",
    });

    doc.setFontSize(14);
    doc.text("CUSTOMER BILLING REPORT", 10, 12);

    doc.setFontSize(8);

    const headers = selectedColumns.map(
      (key) => columns.find((item) => item.key === key)?.label || key,
    );

    let y = 22;

    const pageWidth = doc.internal.pageSize.getWidth();

    const columnWidth = (pageWidth - 20) / headers.length;

    headers.forEach((header, index) => {
      doc.text(header, 10 + index * columnWidth, y);
    });

    y += 7;

    rows.forEach((row) => {
      if (y > 190) {
        doc.addPage();
        y = 15;
      }

      selectedColumns.forEach((key, index) => {
        let value = row[key];

        if (
          key === "package" ||
          key.includes("Paid") ||
          key.includes("Balance")
        ) {
          value = `₹${Number(value || 0).toLocaleString("en-IN")}`;
        }

        doc.text(String(value ?? ""), 10 + index * columnWidth, y, {
          maxWidth: columnWidth - 2,
        });
      });

      y += 6;
    });

    doc.save(
      `customer-billing-${currentMonthInfo.short}-${currentMonthInfo.year}.pdf`,
    );

    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        {/* HEADER */}

        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5 dark:border-slate-700">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-indigo-600">
              Export Customers
            </p>

            <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
              Export Billing Report
            </h2>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {selectedCustomers.length} customer
              {selectedCustomers.length !== 1 ? "s" : ""} selected
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6 p-6">
          {/* FORMAT */}

          <div>
            <p className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-200">
              Export Format
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormat("excel")}
                className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 text-left transition ${
                  format === "excel"
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                    : "border-slate-200 hover:border-emerald-300 dark:border-slate-700"
                }`}
              >
                <FileSpreadsheet size={22} className="text-emerald-600" />

                <div>
                  <p className="font-bold text-slate-900 dark:text-white">
                    Excel
                  </p>

                  <p className="text-xs text-slate-500">.xlsx</p>
                </div>

                {format === "excel" && (
                  <span className="ml-auto text-emerald-600">✓</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setFormat("pdf")}
                className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 text-left transition ${
                  format === "pdf"
                    ? "border-red-500 bg-red-50 dark:bg-red-950/30"
                    : "border-slate-200 hover:border-red-300 dark:border-slate-700"
                }`}
              >
                <FileText size={22} className="text-red-600" />

                <div>
                  <p className="font-bold text-slate-900 dark:text-white">
                    PDF
                  </p>

                  <p className="text-xs text-slate-500">.pdf</p>
                </div>

                {format === "pdf" && (
                  <span className="ml-auto text-red-600">✓</span>
                )}
              </button>
            </div>
          </div>

          {/* COLUMNS */}

          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                Columns
              </p>

              <button
                type="button"
                onClick={() =>
                  setSelectedColumns(columns.map((column) => column.key))
                }
                className="cursor-pointer text-xs font-bold text-indigo-600 hover:text-indigo-700"
              >
                Select All
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {columns.map((column) => {
                const checked = selectedColumns.includes(column.key);

                return (
                  <label
                    key={column.key}
                    className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition ${
                      checked
                        ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
                        : "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleColumn(column.key)}
                      className="h-4 w-4 cursor-pointer accent-indigo-600"
                    />

                    {column.label}
                  </label>
                );
              })}
            </div>
          </div>

          {/* BUTTONS */}

          <div className="flex gap-3 border-t border-slate-200 pt-5 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 cursor-pointer rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={format === "excel" ? exportExcel : exportPDF}
              className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700"
            >
              <Download size={17} />
              Export {format === "excel" ? "Excel" : "PDF"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
// ======================================================
// TABLE ROW
// ======================================================
function StatusPill({ status }) {
  return (
    <span
      className={`inline-block rounded-md px-2.5 py-1.5 text-xs font-bold ${
        status === "free"
          ? "bg-blue-200 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
          : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
      }`}
    >
      {status === "free" ? "FREE" : "DC"}
    </span>
  );
}
function CustomerTableRow({
  customer,
  payments,
  monthBeforePrevious,
  previousMonth,
  currentMonthInfo,
  selected,
  onSelect,
  onClick,
  onAddPayment,
  onEdit,
  onBalance,
}) {
  // --------------------------------------------
  // MONTH CALCULATIONS
  // --------------------------------------------
  const oldMonthStatus = getStatusForMonth(customer, monthBeforePrevious.number, monthBeforePrevious.year);
const previousMonthStatus = getStatusForMonth(customer, previousMonth.number, previousMonth.year);
const currentMonthStatus = getStatusForMonth(customer, currentMonthInfo.number, currentMonthInfo.year);

const getMonthlyEntry = (month, year) =>
  (customer.monthlyBilling || []).find((m) => m.month === month && m.year === year);

const oldEntry = getMonthlyEntry(monthBeforePrevious.number, monthBeforePrevious.year);
const previousEntry = getMonthlyEntry(previousMonth.number, previousMonth.year);
const currentEntry = getMonthlyEntry(currentMonthInfo.number, currentMonthInfo.year);

const oldMonthPaid = oldEntry?.paid ?? 0;
const oldMonthBalance = oldEntry?.balance ?? 0;
const previousPaid = previousEntry?.paid ?? 0;
const previousBalance = previousEntry?.balance ?? 0;
const currentPaid = currentEntry?.paid ?? 0;
const currentMonthBalance = currentEntry?.balance ?? 0;
  return (
    <tr className="border-b border-slate-100 transition hover:bg-indigo-50/40 dark:border-slate-800 dark:hover:bg-slate-800/50">
      {/* CHECKBOX */}

      <td className="w-12 px-4 py-4">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          className="h-4 w-4 cursor-pointer rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
        />
      </td>

      {/* CODE */}

      <td onClick={onClick} className="whitespace-nowrap px-4 py-4">
        <span className="font-bold text-indigo-600">{customer.code}</span>
      </td>

      {/* CUSTOMER */}

      <td onClick={onClick} className="min-w-[220px] px-4 py-4">
        <div className="font-semibold text-slate-900 dark:text-white">
          {customer.name}
        </div>

        {customer.mobile && (
          <div className="mt-0.5 text-xs text-slate-400">{customer.mobile}</div>
        )}
      </td>

      {/* NUID */}

      <td
        onClick={onClick}
        className="whitespace-nowrap px-4 py-4 text-sm text-slate-600 dark:text-slate-300"
      >
        {customer.nuid || "-"}
      </td>

      {/* PACKAGE */}

      <td
        onClick={onClick}
        className="whitespace-nowrap px-4 py-4 font-semibold text-slate-700 dark:text-slate-200"
      >
        ₹{Number(customer.packageAmount || 0).toLocaleString("en-IN")}
      </td>

      {/* ============================== */}
      {/* OLD MONTH PAID */}
      {/* ============================== */}
      <td className="whitespace-nowrap px-4 py-4">
        {oldMonthStatus !== "active" && oldMonthPaid === 0 ? (
          <StatusPill status={oldMonthStatus} />
        ) : (
          <span className="font-semibold text-emerald-600">
            ₹{oldMonthPaid.toLocaleString("en-IN")}
          </span>
        )}
      </td>

      {/* OLD MONTH BALANCE */}

      <td className="whitespace-nowrap px-4 py-4">
        {oldMonthStatus === "free" ||
        (oldMonthStatus === "inactive" && oldMonthBalance === 0) ? (
          <StatusPill status={oldMonthStatus} />
        ) : (
          <span className="font-semibold text-red-600">
            ₹{oldMonthBalance.toLocaleString("en-IN")}
          </span>
        )}
      </td>

      {/* ============================== */}
      {/* PREVIOUS MONTH PAID */}
      {/* ============================== */}
      <td className="whitespace-nowrap px-4 py-4">
        {previousMonthStatus !== "active" && previousPaid === 0 ? (
          <StatusPill status={previousMonthStatus} />
        ) : (
          <span className="font-semibold text-emerald-600">
            ₹{previousPaid.toLocaleString("en-IN")}
          </span>
        )}
      </td>
      {/* PREVIOUS MONTH BALANCE */}
      <td className="whitespace-nowrap px-4 py-4">
        {previousMonthStatus === "free" ||
        (previousMonthStatus === "inactive" && previousBalance === 0) ? (
          <StatusPill status={previousMonthStatus} />
        ) : (
          <span className="font-semibold text-red-600">
            ₹{previousBalance.toLocaleString("en-IN")}
          </span>
        )}
      </td>
      {/* ============================== */}
      {/* CURRENT MONTH PAID */}
      {/* ============================== */}
      <td className="whitespace-nowrap px-4 py-4">
        {currentMonthStatus !== "active" && currentPaid === 0 ? (
          <StatusPill status={currentMonthStatus} />
        ) : (
          <span className="font-semibold text-emerald-600">
            ₹{currentPaid.toLocaleString("en-IN")}
          </span>
        )}
      </td>
      {/* CURRENT MONTH BALANCE */}
      <td className="whitespace-nowrap px-4 py-4">
        {currentMonthStatus === "free" ||
        (currentMonthStatus === "inactive" && currentMonthBalance === 0) ? (
          <StatusPill status={currentMonthStatus} />
        ) : (
          <span className="font-semibold text-red-600">
            ₹{currentMonthBalance.toLocaleString("en-IN")}
          </span>
        )}
      </td>
      {/* ACTIONS */}

      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {/* PAYMENT */}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAddPayment();
            }}
            className="group flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-indigo-700 hover:shadow-md active:translate-y-0 active:scale-[0.98]"
          >
            <Plus
              size={16}
              strokeWidth={2.5}
              className="transition-transform duration-200 group-hover:rotate-90"
            />
            Payment
          </button>

          {/* EDIT */}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="group flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 hover:shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <Edit3
              size={16}
              className="transition-transform duration-200 group-hover:scale-110"
            />
            Edit
          </button>

          {/* BALANCE button */}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              console.log("BALANCE CLICKED", customer);
              onBalance(customer);
            }}
            className="group flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-300 hover:bg-amber-100 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300"
          >
            <IndianRupee size={16} strokeWidth={2.5} />
            Balance
          </button>

          {/* DETAILS */}

          <button
            type="button"
            onClick={(e) => {
              onClick();
            }}
            className="group flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            Details
            <ChevronRight
              size={16}
              className="transition-transform duration-200 group-hover:translate-x-1"
            />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ======================================================
// STAT CARD
// ======================================================
function StatCard({
  icon: Icon,
  title,
  value,
  subtitle,
  iconClass,
  onClick,
  customers = [],
}) {
  const activeCount = customers.filter((c) => {
    const status = c.statusHistory?.length
      ? c.statusHistory[c.statusHistory.length - 1]?.status
      : c.status;

    return status === "active";
  }).length;

  const freeCount = customers.filter((c) => {
    const status = c.statusHistory?.length
      ? c.statusHistory[c.statusHistory.length - 1]?.status
      : c.status;

    return status === "free";
  }).length;

  const inactiveCount = customers.filter((c) => {
    const status = c.statusHistory?.length
      ? c.statusHistory[c.statusHistory.length - 1]?.status
      : c.status;

    return status === "inactive";
  }).length;

  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 ${
        onClick
          ? "cursor-pointer transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg"
          : ""
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {title}
          </p>

          {/* Show status counts ONLY for Customer Status card */}
          {title === "Customer Status" ? (
            <div className="mt-3 flex flex-col items-right gap-x-3 gap-y-1 text-sm">
              <span className="font-black text-emerald-600 dark:text-emerald-400">
                Active - {activeCount} 
              </span>

              <span className="font-black text-blue-600 dark:text-blue-400">
                Free - {freeCount} 
              </span>

              <span className="font-black text-red-600 dark:text-red-400">
                DC - {inactiveCount} 
              </span>
            </div>
          ) : (
            <>
              <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                {value}
              </p>

              {subtitle && (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {subtitle}
                </p>
              )}
            </>
          )}
        </div>

        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconClass}`}
        >
          <Icon size={19} />
        </div>
      </div>
    </div>
  );
}
// ======================================================
// ADD / EDIT CUSTOMER MODAL
// ======================================================
function BulkAssignLocationModal({
  customers,
  locations,
  onClose,
  onAssigned,
}) {
  const [codePrefix, setCodePrefix] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [saving, setSaving] = useState(false);

  const matches = customers.filter(
    (c) =>
      codePrefix.trim() &&
      c.code?.toUpperCase().startsWith(codePrefix.trim().toUpperCase()),
  );

  const handleAssign = async () => {
    if (!selectedLocation) {
      alert("Select a location");
      return;
    }
    if (matches.length === 0) {
      alert("No customers match this code");
      return;
    }

    try {
      setSaving(true);
      await Promise.all(
        matches.map((c) =>
          api.put(`/customers/${c._id}`, { ...c, location: selectedLocation }),
        ),
      );
      await onAssigned();
    } catch (error) {
      console.error("Bulk assign failed:", error);
      alert(error.response?.data?.message || "Failed to assign location");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-indigo-600">
              Bulk Assign
            </p>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Assign Location by Code
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">
              Code starts with
            </label>
            <input
              value={codePrefix}
              onChange={(e) => setCodePrefix(e.target.value)}
              placeholder="e.g. KEL"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {codePrefix.trim() && (
            <div className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800 dark:text-slate-300">
              <strong>{matches.length}</strong> customer
              {matches.length !== 1 ? "s" : ""} match:
              <div className="mt-2 flex flex-wrap gap-1.5">
                {matches.slice(0, 15).map((c) => (
                  <span
                    key={c._id}
                    className="rounded-lg bg-indigo-50 px-2 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                  >
                    {c.code}
                  </span>
                ))}
                {matches.length > 15 && (
                  <span className="text-xs text-slate-400">
                    +{matches.length - 15} more
                  </span>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">
              Assign to Location
            </label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="">Select Location</option>
              {locations.map((l) => (
                <option key={l._id} value={l._id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-3 font-semibold dark:border-slate-700"
            >
              Cancel
            </button>
            <button
              onClick={handleAssign}
              disabled={saving || matches.length === 0}
              className="flex-1 rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white disabled:opacity-50"
            >
              {saving
                ? "Assigning..."
                : `Assign ${matches.length || ""} Customers`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
function CustomerFormModal({ customer, locations, onClose, onSaved }) {
  const editing = Boolean(customer);

  const now = new Date();

  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const [form, setForm] = useState({
    code: customer?.code || "",
    name: customer?.name || "",
    nuid: customer?.nuid || "",
    mobile: customer?.mobile || "",
    packageAmount:
      customer?.packageAmount !== undefined
        ? String(customer.packageAmount)
        : "",

    // Edit = existing value
    // Add = current month/year
    billingStartMonth: customer?.billingStartMonth
      ? String(customer.billingStartMonth)
      : String(currentMonth),

    billingStartYear: customer?.billingStartYear
      ? String(customer.billingStartYear)
      : String(currentYear),

    location: customer?.location?._id || "",
    active: customer?.active !== false,
    status: customer?.status || "active",
    statusMonth: String(currentMonth),
    statusYear: String(currentYear),
  });

  const [saving, setSaving] = useState(false);

  const updateField = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (
      !form.code ||
      !form.name ||
      !form.packageAmount ||
      !form.location ||
      !form.billingStartMonth ||
      !form.billingStartYear
    ) {
      alert("Code, name, package, billing start and location are required");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        ...form,
        packageAmount: Number(form.packageAmount),
        billingStartMonth: Number(form.billingStartMonth),
        billingStartYear: Number(form.billingStartYear),
        statusMonth: Number(form.statusMonth),
        statusYear: Number(form.statusYear),
      };

      if (editing) {
        await api.put(`/customers/${customer._id}`, payload);
      } else {
        await api.post("/customers", payload);
      }

      await onSaved();
    } catch (error) {
      console.error(error);

      alert(error.response?.data?.message || "Failed to save customer");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
              Customer
            </p>

            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {editing ? "Edit Customer" : "Add Customer"}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X size={20} />
          </button>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {/* CODE + NUID */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-semibold">Code</label>

              <input
                value={form.code}
                onChange={(e) =>
                  updateField("code", e.target.value.toUpperCase())
                }
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                placeholder="C001"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold">NUID</label>

              <input
                value={form.nuid}
                onChange={(e) =>
                  updateField("nuid", e.target.value.toUpperCase())
                }
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          {/* NAME */}
          <div>
            <label className="mb-1 block text-sm font-semibold">Name</label>

            <input
              value={form.name}
              onChange={(e) =>
                updateField("name", e.target.value.toUpperCase())
              }
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* MOBILE + PACKAGE */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-semibold">Mobile</label>

              <input
                value={form.mobile}
                onChange={(e) => updateField("mobile", e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold">
                Package
              </label>

              <input
                type="number"
                min="0"
                value={form.packageAmount}
                onChange={(e) => updateField("packageAmount", e.target.value)}
                placeholder="₹500"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          {/* BILLING START */}
          <div>
            <label className="mb-1 block text-sm font-semibold">
              Billing Start
            </label>

            <div className="grid grid-cols-2 gap-3">
              {/* MONTH */}
              <select
                value={form.billingStartMonth}
                onChange={(e) =>
                  updateField("billingStartMonth", e.target.value)
                }
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="">Select Month</option>

                {[
                  "January",
                  "February",
                  "March",
                  "April",
                  "May",
                  "June",
                  "July",
                  "August",
                  "September",
                  "October",
                  "November",
                  "December",
                ].map((month, index) => (
                  <option key={index + 1} value={index + 1}>
                    {month}
                  </option>
                ))}
              </select>

              {/* YEAR */}
              <select
                value={form.billingStartYear}
                onChange={(e) =>
                  updateField("billingStartYear", e.target.value)
                }
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="">Select Year</option>

                {Array.from(
                  { length: 6 },
                  (_, index) => currentYear - index,
                ).map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {/* STATUS */}
          <div>
            <label className="mb-1 block text-sm font-semibold">Status</label>

            <div className="grid grid-cols-3 gap-3">
              {[
                { value: "active", label: "Active" },
                { value: "inactive", label: "DC" },
                { value: "free", label: "Free" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateField("status", opt.value)}
                  className={`rounded-xl border px-3 py-3 text-sm font-bold transition ${
                    form.status === opt.value
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-500/10 dark:text-indigo-400"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {editing && (
              <div className="mt-3">
                <label className="mb-1 block text-xs font-semibold text-slate-500">
                  Apply this status starting from
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={form.statusMonth}
                    onChange={(e) => updateField("statusMonth", e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {[
                      "January",
                      "February",
                      "March",
                      "April",
                      "May",
                      "June",
                      "July",
                      "August",
                      "September",
                      "October",
                      "November",
                      "December",
                    ].map((m, i) => (
                      <option key={i + 1} value={i + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <select
                    value={form.statusYear}
                    onChange={(e) => updateField("statusYear", e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {Array.from({ length: 6 }, (_, i) => currentYear - i).map(
                      (y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ),
                    )}
                  </select>
                </div>
              </div>
            )}
          </div>
          {/* LOCATION */}
          <div>
            <label className="mb-1 block text-sm font-semibold">Location</label>

            <select
              value={form.location}
              onChange={(e) => updateField("location", e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="">Select Location</option>

              {locations.map((location) => (
                <option key={location._id} value={location._id}>
                  {location.name}
                </option>
              ))}
            </select>
          </div>
          {/* BUTTONS */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold dark:border-slate-700"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <Save size={17} />

              {saving
                ? "Saving..."
                : editing
                  ? "Update Customer"
                  : "Add Customer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
// ======================================================
// IMPORT MODAL
// ======================================================

function ImportCustomersModal({ onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);

  const handleImport = async () => {
    if (!file) {
      alert("Select an Excel file first");
      return;
    }

    try {
      setUploading(true);

      const formData = new FormData();

      formData.append("file", file);

      const response = await api.post("/customers/import", formData);

      setResult(response.data);

      await onImported();
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || "Import failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
              Bulk Import
            </p>

            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Import Customers
            </h2>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <label
            htmlFor="excel-file-upload"
            className="block cursor-pointer rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center transition-all hover:border-emerald-400 hover:bg-emerald-50/50 dark:border-slate-700 dark:hover:border-emerald-500 dark:hover:bg-emerald-500/5"
          >
            <FileSpreadsheet size={40} className="mx-auto text-emerald-600" />

            <p className="mt-3 font-bold text-slate-900 dark:text-white">
              Select Excel file
            </p>
            <p className="mt-4 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              Click anywhere here to choose a file
            </p>

            <input
              id="excel-file-upload"
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="hidden"
            />
          </label>

          {file && (
            <div className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800 dark:text-slate-200">
              Selected: <span className="font-bold">{file.name}</span>
            </div>
          )}

          {result?.summary && (
            <div className="rounded-2xl bg-emerald-50 p-4 text-sm dark:bg-emerald-950">
              <p className="font-bold text-emerald-700 dark:text-emerald-300">
                Import completed
              </p>

              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xs">Created</p>

                  <p className="font-bold">{result.summary.created}</p>
                </div>

                <div>
                  <p className="text-xs">Updated</p>

                  <p className="font-bold">{result.summary.updated}</p>
                </div>

                <div>
                  <p className="text-xs">Skipped</p>

                  <p className="font-bold">{result.summary.skipped}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-3 font-semibold dark:border-slate-700"
            >
              Close
            </button>

            <button
              type="button"
              onClick={handleImport}
              disabled={!file || uploading}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white disabled:opacity-50"
            >
              <Upload size={17} />

              {uploading ? "Importing..." : "Import Customers"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ======================================================
// MAIN
// ======================================================

export default function Customers() {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";
  const { monthBeforePrevious, previousMonth, currentMonthInfo } =
    useCurrentMonthInfo();
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [customers, setCustomers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [payments, setPayments] = useState([]);
  const [showBulkAssign, setShowBulkAssign] = useState(false);
  const [balanceCustomer, setBalanceCustomer] = useState(null);
  const [paymentCustomer, setPaymentCustomer] = useState(null);

  const [collectionStats, setCollectionStats] = useState({
    total: 0,
    rajesh: 0,
    shivam: 0,
    count: 0,
    month: currentMonth,
    year: currentYear,
  });
  const [search, setSearch] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("ALL");

  const [view, setView] = useState(
    () => localStorage.getItem("customerView") || "cards",
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showFilters, setShowFilters] = useState(false);

  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [showCustomerForm, setShowCustomerForm] = useState(false);

  const [editingCustomer, setEditingCustomer] = useState(null);

  const [showImportModal, setShowImportModal] = useState(false);

  const [showExportModal, setShowExportModal] = useState(false);
  const [viewingCustomerId, setViewingCustomerId] = useState(null);
  const [selectedCustomers, setSelectedCustomers] = useState([]);
  const [exportOpen, setExportOpen] = useState(false);
  // ====================================================
  // FILTER
  // ====================================================

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return customers.filter((customer) => {
      if (customer.active === false) return false;

      const matchesSearch =
        !query ||
        customer.code?.toLowerCase().includes(query) ||
        customer.name?.toLowerCase().includes(query) ||
        String(customer.nuid || "")
          .toLowerCase()
          .includes(query) ||
        String(customer.mobile || "")
          .toLowerCase()
          .includes(query);

      const matchesLocation =
        selectedLocation === "ALL" ||
        customer.location?._id === selectedLocation;

      return matchesSearch && matchesLocation;
    });
  }, [customers, search, selectedLocation]);
  const displayedCustomers = filteredCustomers.slice(0, rowsPerPage);
  const handleBulkDelete = async () => {
    if (selectedCustomers.length === 0) return;

    const password = window.prompt("Enter password to confirm deletion:");
    if (password === null) return;

    if (password !== "CN") {
      alert("Incorrect password. Deletion cancelled.");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedCustomers.length} customer${selectedCustomers.length > 1 ? "s" : ""}? This cannot be undone.`,
    );
    if (!confirmed) return;

    try {
      await Promise.all(
        selectedCustomers.map((id) => api.delete(`/customers/${id}`)),
      );
      setSelectedCustomers([]);
      await loadCustomers();
    } catch (error) {
      console.error("Bulk delete failed:", error);
      alert(error.response?.data?.message || "Failed to delete some customers");
    }
  };
  const toggleCustomerSelection = (id) => {
    setSelectedCustomers((prev) =>
      prev.includes(id)
        ? prev.filter((customerId) => customerId !== id)
        : [...prev, id],
    );
  };
const tableFooterTotals = useMemo(() => {
  const getEntry = (customer, month, year) =>
    (customer.monthlyBilling || []).find((m) => m.month === month && m.year === year);

  return filteredCustomers.reduce(
    (acc, customer) => {
      const old = getEntry(customer, monthBeforePrevious.number, monthBeforePrevious.year);
      const prev = getEntry(customer, previousMonth.number, previousMonth.year);
      const curr = getEntry(customer, currentMonthInfo.number, currentMonthInfo.year);

      acc.oldPaid += old?.paid ?? 0;
      acc.oldBalance += old?.balance ?? 0;
      acc.prevPaid += prev?.paid ?? 0;
      acc.prevBalance += prev?.balance ?? 0;
      acc.currPaid += curr?.paid ?? 0;
      acc.currBalance += curr?.balance ?? 0;
      return acc;
    },
    { oldPaid: 0, oldBalance: 0, prevPaid: 0, prevBalance: 0, currPaid: 0, currBalance: 0 },
  );
}, [filteredCustomers, monthBeforePrevious, previousMonth, currentMonthInfo]);

  const toggleSelectAll = () => {
    if (selectedCustomers.length === customers.length) {
      setSelectedCustomers([]);
    } else {
      setSelectedCustomers(customers.map((customer) => customer._id));
    }
  };

  // ====================================================
  // LOAD CUSTOMERS
  // ====================================================

  const loadCustomers = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/customers");

      setCustomers(response.data.data || []);
    } catch (error) {
      console.error("Failed to load customers:", error);
      setError(error.response?.data?.message || "Unable to load customers");
    } finally {
      setLoading(false);
    }
  };

  // ====================================================
  // LOAD LOCATIONS
  // ====================================================

  const loadLocations = async () => {
    try {
      const response = await api.get("/locations");

      setLocations(response.data.data || []);
    } catch (error) {
      console.error("Failed to load locations:", error);
    }
  };
  // ====================================================
  // LOAD ALL PAYMENT RECORDS
  // ====================================================
  const loadPayments = async () => {
    try {
      const response = await api.get("/payments");

      console.log("PAYMENTS API RESPONSE:", response.data);
      const paymentData = response.data?.data || response.data?.payments || [];
      console.log("PAYMENTS LOADED:", paymentData);
      setPayments(Array.isArray(paymentData) ? paymentData : []);
    } catch (error) {
      console.error(
        "FAILED TO LOAD PAYMENTS:",
        error.response?.data || error.message,
      );

      setPayments([]);
    }
  };

  // ====================================================
  // LOAD CURRENT MONTH COLLECTION
  // ====================================================
  const loadCollection = async () => {
    try {
      const response = await api.get("/payments/current-month");

      console.log("CURRENT MONTH COLLECTION:", response.data);

      const data = response.data?.data || response.data || {};

      setCollectionStats({
        total: Number(data.total || 0),
        rajesh: Number(data.rajesh || 0),
        shivam: Number(data.shivam || 0),
        count: Number(data.count || 0),
        month: Number(data.month || currentMonth),
        year: Number(data.year || currentYear),
      });
    } catch (error) {
      console.error(
        "FAILED TO LOAD COLLECTION:",
        error.response?.data || error.message,
      );
    }
  };
  // ====================================================
  // INITIAL LOAD
  // ====================================================

  useEffect(() => {
    loadCustomers();
    loadLocations();
    loadPayments();
    loadCollection();
  }, []);

  // ====================================================
  // REFRESH ALL DATA
  // ====================================================
  const refreshData = async () => {
    await Promise.all([loadCustomers(), loadPayments(), loadCollection()]);
  };

  // ====================================================
  // CUSTOMER ACTIONS
  // ====================================================

  const handleCustomerClick = (customer) => {
    setViewingCustomerId(customer._id);
  };

  const handleAddPayment = (customer) => {
    setPaymentCustomer(customer);
  };

  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    setShowCustomerForm(true);
  };

  const handleBalance = (customer) => {
    setBalanceCustomer(customer);
  };

  // ====================================================
  // VIEW
  // ====================================================

  const changeView = (newView) => {
    setView(newView);

    localStorage.setItem("customerView", newView);
  };

  // ====================================================
  // STATS
  // ====================================================
  const activeCustomersList = useMemo(
  () => customers.filter((c) => c.active !== false),
  [customers],
);
const totalCustomers = activeCustomersList.length;
const inactiveCount = customers.length - activeCustomersList.length;
const activeCustomerIds = useMemo(
  () => new Set(activeCustomersList.map((c) => String(c._id))),
  [activeCustomersList],
);

const activePayments = useMemo(
  () => payments.filter((p) => {
    const pc = p.customer?._id || p.customer;
    return activeCustomerIds.has(String(pc));
  }),
  [payments, activeCustomerIds],
);
const pendingAmount = useMemo(
  () => activeCustomersList.reduce((sum, c) => sum + Number(c.currentBalance || 0), 0),
  [activeCustomersList],
);

const totalPaid = useMemo(
  () => activePayments.reduce((sum, p) => sum + Number(p.amount || 0), 0),
  [activePayments],
);

const rajeshTotal = useMemo(
  () => activePayments.filter((p) => p.addedBy === "RAJESH").reduce((s, p) => s + Number(p.amount || 0), 0),
  [activePayments],
);

const shivamTotal = useMemo(
  () => activePayments.filter((p) => p.addedBy === "SHIVAM").reduce((s, p) => s + Number(p.amount || 0), 0),
  [activePayments],
);

  const monthCollectionSummary = useMemo(() => {
    const buildSummary = (monthInfo) => {
      const monthPayments = activePayments.filter((p) => {
        const d = new Date(p.paidAt);
        return (
          d.getMonth() + 1 === monthInfo.number &&
          d.getFullYear() === monthInfo.year
        );
      });

      const total = monthPayments.reduce(
        (s, p) => s + Number(p.amount || 0),
        0,
      );
      const rajesh = monthPayments
        .filter((p) => String(p.addedBy || "").toUpperCase() === "RAJESH")
        .reduce((s, p) => s + Number(p.amount || 0), 0);
      const shivam = monthPayments
        .filter((p) => String(p.addedBy || "").toUpperCase() === "SHIVAM")
        .reduce((s, p) => s + Number(p.amount || 0), 0);

      return {
        ...monthInfo,
        total,
        rajesh,
        shivam,
        count: monthPayments.length,
      };
    };

    return {
      old: buildSummary(monthBeforePrevious),
      previous: buildSummary(previousMonth),
      current: buildSummary(currentMonthInfo),
    };
  }, [activePayments, monthBeforePrevious, previousMonth, currentMonthInfo]);
  // ====================================================
  // LOADING
  // ====================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="mx-auto max-w-7xl p-4 sm:p-6">
          <div className="h-16 animate-pulse rounded-2xl bg-white dark:bg-slate-900" />

          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="h-28 animate-pulse rounded-2xl bg-white dark:bg-slate-900"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ====================================================
  // PAGE
  // ====================================================

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl p-4 sm:p-6">
        {/* ================================================= */}
        {/* NAVBAR */}
        {/* ================================================= */}

        <header className="mb-5 rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex min-h-[68px] items-center justify-between gap-3 px-4 sm:px-5">
            {/* Brand */}

            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600">
                Cable Billing
              </p>

              <h1 className="truncate text-lg font-bold text-slate-900 dark:text-white sm:text-xl">
                Customers
              </h1>
            </div>
            {/* <TestClockWidget /> */}
            {/* Actions */}

            <div className="flex items-center gap-2">
              {/* DARK MODE */}
              <button
                type="button"
                onClick={toggleTheme}
                title={dark ? "Switch to light mode" : "Switch to dark mode"}
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                {dark ? <Sun size={19} /> : <Moon size={19} />}
              </button>
              <button
                type="button"
                onClick={() => setShowBulkAssign(true)}
                className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <MapPin size={17} />
                <span className="hidden md:inline">Bulk Assignn</span>
              </button>
              {/* IMPORT button*/}

              {/* <button
                type="button"
                onClick={() => setShowImportModal(true)}
                className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <Upload size={17} />

                <span className=" md:inline">Import</span>
              </button> */}
              {/* ADD CUSTOMER */}

              <button
                type="button"
                onClick={() => {
                  setEditingCustomer(null);
                  setShowCustomerForm(true);
                }}
                className="flex cursor-pointer items-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700"
              >
                <UserPlus size={18} />

                <span className="hidden sm:inline">Add Customer</span>

                <span className="sm:hidden">Add</span>
              </button>
            </div>
          </div>
        </header>

        {/* ================================================= */}
        {/* STATS */}
        {/* ================================================= */}

        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
  icon={Users}
  title="Total Customers"
  value={customers.length}
  subtitle="All registered customers"
  iconClass="bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300"
/>
       <StatCard
  icon={UserCheck}
  title="Customer Status"
  customers={customers}
  iconClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300"
/>

          <div
            onClick={() => setShowCollectionModal(true)}
            className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Total Payment Paid
                </p>

               <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
  {monthCollectionSummary.current.name} Collection
</p>

<p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
  ₹{Number(monthCollectionSummary.current.total || 0).toLocaleString("en-IN")}
</p>

<div className="mt-3 space-y-1.5">
  <div className="flex items-center justify-between gap-6">
    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Rajesh</p>
    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
      ₹{monthCollectionSummary.current.rajesh.toLocaleString("en-IN")}
    </p>
  </div>
  <div className="flex items-center justify-between gap-6">
    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Shivam</p>
    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
      ₹{monthCollectionSummary.current.shivam.toLocaleString("en-IN")}
    </p>
  </div>
</div>

                <p className="mt-3 text-xs font-medium text-indigo-600 dark:text-indigo-400">
                  Click to view monthly collection
                </p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
                <IndianRupee size={19} />
              </div>
            </div>
          </div>

          <StatCard
            icon={Clock3}
            title="Payment Pending"
            value={`₹${pendingAmount.toLocaleString("en-IN")}`}
            subtitle="Outstanding balance"
            iconClass="bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300"
          />
        </div>

        {/* ================================================= */}
        {/* SEARCH */}
        {/* ================================================= */}

        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <Search
                size={19}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, code, NUID or mobile..."
                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-10 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:bg-slate-800"
              />

              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className={`flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition ${
                  showFilters || selectedLocation !== "ALL"
                    ? "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                <SlidersHorizontal size={17} />
                Filter
              </button>

              <div className="hidden h-12 items-center rounded-xl border border-slate-200 bg-slate-50 p-1 sm:flex dark:border-slate-700 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => changeView("cards")}
                  className={`flex h-10 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${
                    view === "cards"
                      ? "bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-indigo-300"
                      : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                  }`}
                >
                  <LayoutGrid size={17} />
                  Cards
                </button>

                <button
                  type="button"
                  onClick={() => changeView("table")}
                  className={`flex h-10 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${
                    view === "table"
                      ? "bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-indigo-300"
                      : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                  }`}
                >
                  <Table2 size={17} />
                  Table
                </button>
              </div>

              <button
                type="button"
                onClick={refreshData}
                className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                title="Refresh"
              >
                <RefreshCw size={17} />
              </button>
            </div>
          </div>

          {/* FILTER */}

          {showFilters && (
            <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <label className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                  Location
                </label>

                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="ALL">All Locations</option>

                  {locations.map((location) => (
                    <option key={location._id} value={location._id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* ================================================= */}
        {/* RESULTS */}
        {/* ================================================= */}

        <div className="mt-5 flex items-center justify-between">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Showing{" "}
            <span className="font-bold text-slate-700 dark:text-slate-200">
              {Math.min(rowsPerPage, filteredCustomers.length)}
            </span>{" "}
            of{" "}
            <span className="font-bold text-slate-700 dark:text-slate-200">
              {filteredCustomers.length}
            </span>
          </p>

          <div className="flex items-center gap-2">
            <label
              htmlFor="rows-per-page"
              className="text-xs font-medium text-slate-500 dark:text-slate-400"
            >
              Show
            </label>

            <select
              id="rows-per-page"
              value={rowsPerPage}
              onChange={(e) => setRowsPerPage(Number(e.target.value))}
              className="cursor-pointer rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={75}>75</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={300}>300</option>
            </select>
          </div>

          <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1 sm:hidden dark:border-slate-700 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => changeView("cards")}
              className={`cursor-pointer rounded-lg p-2 ${
                view === "cards"
                  ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300"
                  : "text-slate-400"
              }`}
            >
              <LayoutGrid size={17} />
            </button>

            <button
              type="button"
              onClick={() => changeView("table")}
              className={`cursor-pointer rounded-lg p-2 ${
                view === "table"
                  ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300"
                  : "text-slate-400"
              }`}
            >
              <Table2 size={17} />
            </button>
          </div>
        </div>

        {/* ERROR */}

        {error && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {/* ================================================= */}
        {/* CARDS */}
        {/* ================================================= */}

        {!error && filteredCustomers.length > 0 && view === "cards" && (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {displayedCustomers.map((customer) => (
            <CustomerCard
  key={customer._id}
  customer={customer}
  payments={payments}
  currentMonthInfo={currentMonthInfo}
  onClick={() => handleCustomerClick(customer)}
  onAddPayment={() => handleAddPayment(customer)}
  onEdit={() => handleEdit(customer)}
  onBalance={() => handleBalance(customer)}
/>
            ))}
          </div>
        )}

        {/* ================================================= */}
        {/* TABLE */}
        {/* ================================================= */}

        {!error && filteredCustomers.length > 0 && view === "table" && (
          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="overflow-x-auto">
              <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
                <div className="text-sm text-slate-500">
                  {selectedCustomers.length > 0
                    ? `${selectedCustomers.length} customer${
                        selectedCustomers.length > 1 ? "s" : ""
                      } selected`
                    : "Select customers"}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={selectedCustomers.length === 0}
                    onClick={handleBulkDelete}
                    className="flex cursor-pointer items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
                  >
                    Delete
                    {selectedCustomers.length > 0 &&
                      ` (${selectedCustomers.length})`}
                  </button>
                  <button
                    type="button"
                    disabled={selectedCustomers.length === 0}
                    onClick={() => setShowExportModal(true)}
                    className="flex cursor-pointer items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Download size={17} />
                    Export
                    {selectedCustomers.length > 0 &&
                      ` (${selectedCustomers.length})`}
                  </button>
                </div>
              </div>
              <table className="min-w-[1650px] w-full border-collapse text-center">
                <thead className="bg-slate-50 dark:bg-slate-800/80">
                  <tr>
                    {/* SELECT ALL */}
                    <th className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={
                          customers.length > 0 &&
                          selectedCustomers.length === customers.length
                        }
                        onChange={toggleSelectAll}
                        className="h-4 w-4 cursor-pointer accent-indigo-600"
                      />
                    </th>
                    <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      Code
                    </th>
                    <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      Customer
                    </th>
                    <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      NUID
                    </th>
                    <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      Package
                    </th>
                    {/* JUNE */}
                    <th className="px-4 py-4 text-right text-xs font-bold uppercase tracking-wide text-slate-500">
                      {monthBeforePrevious.name} Paid
                    </th>
                    <th className="px-4 py-4 text-right text-xs font-bold uppercase tracking-wide text-slate-500">
                      {monthBeforePrevious.name} Bal
                    </th>
                    {/* JULY */}
                    <th className="px-4 py-4 text-right text-xs font-bold uppercase tracking-wide text-slate-500">
                      {previousMonth.name} Paid
                    </th>
                    <th className="px-4 py-4 text-right text-xs font-bold uppercase tracking-wide text-slate-500">
                      {previousMonth.name} Bal
                    </th>
                    {/* AUG */}
                    <th className="px-4 py-4 text-right text-xs font-bold uppercase tracking-wide text-slate-500">
                      {currentMonthInfo.name} Paid
                    </th>
                    <th className="px-4 py-4 text-right text-xs font-bold uppercase tracking-wide text-slate-500">
                      {currentMonthInfo.name} Bal
                    </th>
                    <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {displayedCustomers.map((customer) => (
                    <CustomerTableRow
                      key={customer._id}
                      customer={customer}
                      payments={payments}
                      monthBeforePrevious={monthBeforePrevious}
                      previousMonth={previousMonth}
                      currentMonthInfo={currentMonthInfo}
                      selected={selectedCustomers.includes(customer._id)}
                      onSelect={() => toggleCustomerSelection(customer._id)}
                      onClick={() => handleCustomerClick(customer)}
                      onAddPayment={() => handleAddPayment(customer)}
                      onEdit={() => handleEdit(customer)}
                      onBalance={() => handleBalance(customer)}
                    />
                  ))}
                </tbody>
                <tfoot className="border-t-2 text-m border-indigo-200 bg-indigo-50/60 dark:border-indigo-900 dark:bg-indigo-950/30">
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-4 font-bold text-slate-700 dark:text-slate-200"
                    >
                      {selectedLocation === "ALL"
                        ? "TOTAL (All Locations)"
                        : "TOTAL (Filtered)"}
                    </td>
                    <td className="px-4 py-4 font-bold text-emerald-700">
                      ₹{tableFooterTotals.oldPaid.toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-4 font-bold text-red-700">
                      ₹{tableFooterTotals.oldBalance.toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-4 font-bold text-emerald-700">
                      ₹{tableFooterTotals.prevPaid.toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-4 font-bold text-red-700">
                      ₹{tableFooterTotals.prevBalance.toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-4 font-bold text-emerald-700">
                      ₹{tableFooterTotals.currPaid.toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-4 font-bold text-red-700">
                      ₹{tableFooterTotals.currBalance.toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-4" />
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-400 dark:border-slate-800 dark:bg-slate-800">
              Swipe horizontally to view all billing columns.
            </div>
          </div>
        )}

        {/* ================================================= */}
        {/* PAYMENT MODAL */}
        {/* ================================================= */}
        {showBulkAssign && (
          <BulkAssignLocationModal
            customers={customers}
            locations={locations}
            onClose={() => setShowBulkAssign(false)}
            onAssigned={async () => {
              setShowBulkAssign(false);
              await loadCustomers();
            }}
          />
        )}
        {viewingCustomerId && (
          <CustomerDetailsModal
            customerId={viewingCustomerId}
            onClose={() => setViewingCustomerId(null)}
          />
        )}
        {showCustomerForm && (
          <CustomerFormModal
            customer={editingCustomer}
            locations={locations}
            onClose={() => {
              setShowCustomerForm(false);
              setEditingCustomer(null);
            }}
            onSaved={async () => {
              setShowCustomerForm(false);
              setEditingCustomer(null);
              await loadCustomers();
            }}
          />
        )}
        {balanceCustomer && (
          <BalanceModal
            customer={balanceCustomer}
            payments={payments}
            onClose={() => setBalanceCustomer(null)}
            onSaved={async () => {
              setBalanceCustomer(null);
              await Promise.all([loadCustomers(), loadPayments()]);
            }}
          />
        )}
        {paymentCustomer && (
          <PaymentModal
            customer={paymentCustomer}
            payments={payments}
            onClose={() => setPaymentCustomer(null)}
            onSaved={async () => {
              setPaymentCustomer(null);

              await Promise.all([
                loadCustomers(),
                loadPayments(),
                loadCollection(),
              ]);
            }}
          />
        )}
        {showExportModal && (
          <ExportModal
            customers={customers}
            selectedCustomers={selectedCustomers}
            payments={payments}
            monthBeforePrevious={monthBeforePrevious}
            previousMonth={previousMonth}
            currentMonthInfo={currentMonthInfo}
            onClose={() => setShowExportModal(false)}
          />
        )}
        {showCollectionModal && (
          <CollectionModal
            summary={monthCollectionSummary}
            onClose={() => setShowCollectionModal(false)}
          />
        )}
        {showImportModal && (
          <ImportCustomersModal
            onClose={() => setShowImportModal(false)}
            onImported={async () => {
              setShowImportModal(false);
              await loadCustomers();
            }}
          />
        )}
        {/* ================================================= */}
        {/* NO RESULTS */}
        {/* ================================================= */}

        {!error && filteredCustomers.length === 0 && (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
              <Search size={24} className="text-slate-400" />
            </div>

            <h2 className="mt-4 font-bold text-slate-900 dark:text-white">
              No customers found
            </h2>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Try a different name, code, NUID or location.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
