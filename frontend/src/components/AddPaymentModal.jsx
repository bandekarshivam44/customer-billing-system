import { useEffect, useState } from "react";
import { X, Check, Loader2 } from "lucide-react";
import api from "../services/api";

const months = [
  { number: 1, name: "January" },
  { number: 2, name: "February" },
  { number: 3, name: "March" },
  { number: 4, name: "April" },
  { number: 5, name: "May" },
  { number: 6, name: "June" },
  { number: 7, name: "July" },
  { number: 8, name: "August" },
  { number: 9, name: "September" },
  { number: 10, name: "October" },
  { number: 11, name: "November" },
  { number: 12, name: "December" },
];

export default function AddPaymentModal({
  customer,
  isOpen,
  onClose,
  onSuccess,
}) {
  const now = new Date();

  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [amount, setAmount] = useState("");
  const [addedBy, setAddedBy] = useState("RAJESH");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Reset form whenever a new customer/modal is opened
  useEffect(() => {
    if (!isOpen || !customer) return;

    const currentDate = new Date();

    setMonth(currentDate.getMonth() + 1);
    setYear(currentDate.getFullYear());

    // Automatically fill package amount
    setAmount(String(customer.packageAmount || ""));

    // Rajesh is default
    setAddedBy("RAJESH");

    setNote("");
    setError("");
  }, [isOpen, customer]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event) => {
      if (event.key === "Escape" && !saving) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, saving, onClose]);

  if (!isOpen || !customer) {
    return null;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");

    const paymentAmount = Number(amount);

    if (!paymentAmount || paymentAmount <= 0) {
      setError("Please enter a valid payment amount.");
      return;
    }

    try {
      setSaving(true);

      await api.post("/payments", {
        customer: customer._id,
        month: Number(month),
        year: Number(year),
        amount: paymentAmount,
        addedBy,
        note: note.trim(),
      });

      // Tell parent that payment was successfully saved
      if (onSuccess) {
        await onSuccess();
      }

      onClose();
    } catch (error) {
      console.error("Payment failed:", error);

      setError(
        error.response?.data?.message ||
          "Failed to save payment. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) {
          onClose();
        }
      }}
    >
      <div
        className="
          w-full
          max-w-md
          rounded-t-3xl
          bg-white
          shadow-2xl
          dark:bg-slate-900
          sm:rounded-3xl
        "
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 p-5 dark:border-slate-700">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
              Add Payment
            </p>

            <h2 className="mt-1 truncate text-xl font-bold text-slate-900 dark:text-white">
              {customer.name}
            </h2>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {customer.code}
              {customer.location?.name
                ? ` • ${customer.location.name}`
                : ""}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="
              cursor-pointer
              flex
              h-10
              w-10
              shrink-0
              items-center
              justify-center
              rounded-xl
              text-slate-400
              transition
              hover:bg-slate-100
              hover:text-slate-700
              disabled:cursor-not-allowed
              dark:hover:bg-slate-800
              dark:hover:text-slate-200
            "
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-5">
          {/* Package information */}
          <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/70">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500 dark:text-slate-400">
                Monthly Package
              </span>

              <span className="font-bold text-slate-900 dark:text-white">
                ₹
                {Number(
                  customer.packageAmount || 0
                ).toLocaleString("en-IN")}
              </span>
            </div>
          </div>

          {/* Month + Year */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                Month
              </label>

              <select
                value={month}
                onChange={(event) =>
                  setMonth(Number(event.target.value))
                }
                disabled={saving}
                className="
                  w-full
                  cursor-pointer
                  rounded-xl
                  border
                  border-slate-200
                  bg-white
                  px-4
                  py-3
                  text-sm
                  text-slate-800
                  outline-none
                  transition
                  focus:border-indigo-500
                  focus:ring-4
                  focus:ring-indigo-500/10
                  dark:border-slate-700
                  dark:bg-slate-800
                  dark:text-white
                "
              >
                {months.map((item) => (
                  <option
                    key={item.number}
                    value={item.number}
                  >
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                Year
              </label>

              <input
                type="number"
                value={year}
                onChange={(event) =>
                  setYear(Number(event.target.value))
                }
                disabled={saving}
                className="
                  w-full
                  rounded-xl
                  border
                  border-slate-200
                  bg-white
                  px-4
                  py-3
                  text-sm
                  text-slate-800
                  outline-none
                  transition
                  focus:border-indigo-500
                  focus:ring-4
                  focus:ring-indigo-500/10
                  dark:border-slate-700
                  dark:bg-slate-800
                  dark:text-white
                "
              />
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">
              Amount Paid
            </label>

            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-slate-500 dark:text-slate-400">
                ₹
              </span>

              <input
                type="number"
                min="1"
                value={amount}
                onChange={(event) =>
                  setAmount(event.target.value)
                }
                disabled={saving}
                autoFocus
                placeholder="Enter amount"
                className="
                  w-full
                  rounded-xl
                  border
                  border-slate-200
                  bg-white
                  py-3
                  pl-9
                  pr-4
                  text-lg
                  font-semibold
                  text-slate-900
                  outline-none
                  transition
                  focus:border-indigo-500
                  focus:ring-4
                  focus:ring-indigo-500/10
                  dark:border-slate-700
                  dark:bg-slate-800
                  dark:text-white
                "
              />
            </div>
          </div>

          {/* Added By */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">
              Added By
            </label>

            <div className="grid grid-cols-2 gap-3">
              {/* Rajesh */}
              <button
                type="button"
                onClick={() => setAddedBy("RAJESH")}
                disabled={saving}
                className={`
                  cursor-pointer
                  flex
                  items-center
                  justify-center
                  gap-2
                  rounded-xl
                  border
                  px-4
                  py-3
                  font-semibold
                  transition
                  ${
                    addedBy === "RAJESH"
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-300"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  }
                `}
              >
                {addedBy === "RAJESH" && (
                  <Check size={17} />
                )}
                Rajesh
              </button>

              {/* Shivam */}
              <button
                type="button"
                onClick={() => setAddedBy("SHIVAM")}
                disabled={saving}
                className={`
                  cursor-pointer
                  flex
                  items-center
                  justify-center
                  gap-2
                  rounded-xl
                  border
                  px-4
                  py-3
                  font-semibold
                  transition
                  ${
                    addedBy === "SHIVAM"
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-300"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  }
                `}
              >
                {addedBy === "SHIVAM" && (
                  <Check size={17} />
                )}
                Shivam
              </button>
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">
              Note
              <span className="ml-1 font-normal text-slate-400">
                (optional)
              </span>
            </label>

            <input
              type="text"
              value={note}
              onChange={(event) =>
                setNote(event.target.value)
              }
              disabled={saving}
              placeholder="Example: Paid partly"
              className="
                w-full
                rounded-xl
                border
                border-slate-200
                bg-white
                px-4
                py-3
                text-sm
                outline-none
                transition
                placeholder:text-slate-400
                focus:border-indigo-500
                focus:ring-4
                focus:ring-indigo-500/10
                dark:border-slate-700
                dark:bg-slate-800
                dark:text-white
              "
            />
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="
                cursor-pointer
                flex-1
                rounded-xl
                border
                border-slate-200
                bg-white
                px-4
                py-3
                font-semibold
                text-slate-700
                transition
                hover:bg-slate-50
                disabled:cursor-not-allowed
                dark:border-slate-700
                dark:bg-slate-800
                dark:text-slate-200
                dark:hover:bg-slate-700
              "
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="
                cursor-pointer
                flex-1
                rounded-xl
                bg-indigo-600
                px-4
                py-3
                font-semibold
                text-white
                shadow-sm
                transition
                hover:bg-indigo-700
                disabled:cursor-not-allowed
                disabled:opacity-60
              "
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2
                    size={17}
                    className="animate-spin"
                  />
                  Saving...
                </span>
              ) : (
                "Save Payment"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}