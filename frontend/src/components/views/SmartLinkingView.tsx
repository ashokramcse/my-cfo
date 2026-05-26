"use client";
/**
 * SmartLinkingView — Smart financial linking dashboard
 *
 * Surfaces:
 * 1. Pending CC payment suggestions (auto-detected DEBITs)
 * 2. Untagged large CREDITs (might be borrowed money)
 * 3. Cash account creation + balance
 * 4. Manual loan disbursement / repayment linking forms
 */

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  Link2,
  Unlink,
  Plus,
  TrendingDown,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { financialLinkingApi, loansApi, cardsApi } from "@/lib/api";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

// ─── CC Payment Suggestions ──────────────────────────────────────────────────

function CCPaymentSuggestions() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["cc-payment-suggestions"],
    queryFn: () => financialLinkingApi.getCCPaymentSuggestions(),
  });

  const confirmMut = useMutation({
    mutationFn: ({ bankTxId, cardId }: { bankTxId: string; cardId: string }) =>
      financialLinkingApi.markCCPayment(bankTxId, cardId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cc-payment-suggestions"] });
      qc.invalidateQueries({ queryKey: ["pending-actions"] });
      qc.invalidateQueries({ queryKey: ["bank-transactions"] });
    },
  });

  const suggestions = data?.data?.suggestions ?? [];

  if (isLoading) return <div className="animate-pulse h-24 bg-slate-800 rounded-xl" />;
  if (suggestions.length === 0) return null;

  return (
    <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertCircle className="w-4 h-4 text-amber-400" />
        <h3 className="text-sm font-semibold text-amber-300">
          CC Payment Suggestions ({suggestions.length})
        </h3>
      </div>
      <p className="text-xs text-slate-400 mb-3">
        These bank debits look like credit card payments. Confirm to link them and avoid
        double-counting them as expenses.
      </p>
      <div className="space-y-2">
        {suggestions.map((s: any) => (
          <div
            key={s.bank_tx_id}
            className="flex items-center justify-between bg-slate-800 rounded-lg px-3 py-2"
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white font-medium truncate">{s.bank_tx_description}</p>
              <p className="text-xs text-slate-400">
                {fmtDate(s.bank_tx_date)} · {fmt(s.bank_tx_amount)} → {s.card_name}
              </p>
            </div>
            <div className="flex items-center gap-2 ml-2 flex-shrink-0">
              <span
                className={`text-xs px-1.5 py-0.5 rounded ${
                  s.confidence === "HIGH"
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-amber-500/20 text-amber-300"
                }`}
              >
                {s.confidence}
              </span>
              <button
                onClick={() =>
                  confirmMut.mutate({ bankTxId: s.bank_tx_id, cardId: s.card_id })
                }
                disabled={confirmMut.isPending}
                className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-1 rounded"
              >
                <CheckCircle2 className="w-3 h-3 inline mr-1" />
                Confirm
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Untagged Large Credits ───────────────────────────────────────────────────

function UntaggedLargeCredits() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["pending-actions"],
    queryFn: () => financialLinkingApi.getPendingActions(),
  });

  const { data: loansData } = useQuery({
    queryKey: ["loans"],
    queryFn: () => loansApi.list?.() ?? Promise.resolve({ data: [] }),
  });

  const [selectedTx, setSelectedTx] = useState<string | null>(null);
  const [selectedLoan, setSelectedLoan] = useState<string>("");

  const linkMut = useMutation({
    mutationFn: ({ bankTxId, loanId }: { bankTxId: string; loanId: string }) =>
      financialLinkingApi.markLoanDisbursement(bankTxId, loanId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-actions"] });
      setSelectedTx(null);
      setSelectedLoan("");
    },
  });

  const credits = data?.data?.untagged_large_credits ?? [];
  const loans = loansData?.data?.loans ?? loansData?.data ?? [];

  if (isLoading) return <div className="animate-pulse h-24 bg-slate-800 rounded-xl" />;
  if (credits.length === 0) return null;

  return (
    <div className="bg-slate-900 border border-blue-500/30 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <ArrowDownCircle className="w-4 h-4 text-blue-400" />
        <h3 className="text-sm font-semibold text-blue-300">
          Large Credits — Is Any of This Borrowed Money? ({credits.length})
        </h3>
      </div>
      <p className="text-xs text-slate-400 mb-3">
        These large bank credits are counted as income. If any were loans received,
        link them to avoid inflating your net worth.
      </p>
      <div className="space-y-2">
        {credits.map((c: any) => (
          <div key={c.id} className="bg-slate-800 rounded-lg px-3 py-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-white font-medium">{c.description}</p>
                <p className="text-xs text-slate-400">
                  {fmtDate(c.date)} · {fmt(c.amount)}
                </p>
              </div>
              <button
                onClick={() =>
                  setSelectedTx(selectedTx === c.id ? null : c.id)
                }
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                <Link2 className="w-3 h-3" />
                {selectedTx === c.id ? "Cancel" : "Mark as Loan"}
              </button>
            </div>
            {selectedTx === c.id && (
              <div className="mt-2 flex gap-2">
                <select
                  value={selectedLoan}
                  onChange={(e) => setSelectedLoan(e.target.value)}
                  className="flex-1 text-xs bg-slate-700 text-white rounded px-2 py-1 border border-slate-600"
                >
                  <option value="">Select loan...</option>
                  {loans.map((l: any) => (
                    <option key={l.id} value={l.id}>
                      {l.lender_name} — {l.nickname || l.loan_type} ({fmt(l.outstanding_balance)})
                    </option>
                  ))}
                </select>
                <button
                  onClick={() =>
                    selectedLoan &&
                    linkMut.mutate({ bankTxId: c.id, loanId: selectedLoan })
                  }
                  disabled={!selectedLoan || linkMut.isPending}
                  className="text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-2 py-1 rounded"
                >
                  Link
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Cash Account Card ────────────────────────────────────────────────────────

function CashAccountSection() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["cash-accounts"],
    queryFn: () => financialLinkingApi.listCashAccounts(),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [nickname, setNickname] = useState("Cash Wallet");
  const [initialBalance, setInitialBalance] = useState("0");

  const createMut = useMutation({
    mutationFn: () =>
      financialLinkingApi.createCashAccount({
        nickname,
        initial_balance: parseFloat(initialBalance) || 0,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cash-accounts"] });
      qc.invalidateQueries({ queryKey: ["bank-accounts"] });
      setShowCreate(false);
    },
  });

  const accounts = data?.data?.accounts ?? [];

  return (
    <div className="bg-slate-900 border border-amber-600/30 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-amber-300">Cash Accounts</h3>
        </div>
        {accounts.length === 0 && !showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Add Cash Wallet
          </button>
        )}
      </div>

      {accounts.length === 0 && !showCreate && (
        <p className="text-xs text-slate-500">
          No cash accounts. Create one to track physical cash — ATM withdrawals,
          cash expenses, cash loans.
        </p>
      )}

      {accounts.map((a: any) => (
        <div key={a.id} className="bg-slate-800 rounded-lg px-3 py-2 mb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: a.account_color }}
              />
              <span className="text-xs text-white font-medium">{a.nickname}</span>
            </div>
            <span className="text-xs font-bold text-amber-300">
              {fmt(a.current_balance)}
            </span>
          </div>
          {a.notes && (
            <p className="text-xs text-slate-500 mt-1">{a.notes}</p>
          )}
        </div>
      ))}

      {showCreate && (
        <div className="bg-slate-800 rounded-lg p-3 space-y-2">
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Account name (e.g. Cash Wallet)"
            className="w-full text-xs bg-slate-700 text-white px-2 py-1.5 rounded border border-slate-600 outline-none"
          />
          <input
            type="number"
            value={initialBalance}
            onChange={(e) => setInitialBalance(e.target.value)}
            placeholder="Opening balance (₹)"
            className="w-full text-xs bg-slate-700 text-white px-2 py-1.5 rounded border border-slate-600 outline-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => createMut.mutate()}
              disabled={createMut.isPending}
              className="flex-1 text-xs bg-amber-600 hover:bg-amber-500 text-white py-1.5 rounded"
            >
              Create
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="text-xs text-slate-400 hover:text-white px-2 py-1.5"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Loan Repayment Linker ────────────────────────────────────────────────────

function LoanRepaymentLinker() {
  const qc = useQueryClient();
  const [bankTxId, setBankTxId] = useState("");
  const [loanId, setLoanId] = useState("");
  const [interestAmount, setInterestAmount] = useState("");
  const [result, setResult] = useState<any>(null);
  const [expanded, setExpanded] = useState(false);

  const { data: loansData } = useQuery({
    queryKey: ["loans"],
    queryFn: () => loansApi.list?.() ?? Promise.resolve({ data: [] }),
  });
  const loans = loansData?.data?.loans ?? loansData?.data ?? [];

  const linkMut = useMutation({
    mutationFn: () =>
      financialLinkingApi.markLoanRepayment(
        bankTxId,
        loanId,
        interestAmount ? parseFloat(interestAmount) : undefined
      ),
    onSuccess: (res) => {
      setResult(res.data);
      qc.invalidateQueries({ queryKey: ["loans"] });
      qc.invalidateQueries({ queryKey: ["bank-transactions"] });
    },
  });

  return (
    <div className="bg-slate-900 border border-purple-500/30 rounded-xl p-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full"
      >
        <div className="flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-semibold text-purple-300">
            Link Loan Repayment + Interest Split
          </h3>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-slate-400">
            Link a bank DEBIT to a loan repayment. The system will split it into
            principal + interest automatically (or you can specify the interest amount).
          </p>

          <input
            value={bankTxId}
            onChange={(e) => setBankTxId(e.target.value)}
            placeholder="Bank Transaction ID (UUID)"
            className="w-full text-xs bg-slate-800 text-white px-2 py-1.5 rounded border border-slate-600 outline-none"
          />

          <select
            value={loanId}
            onChange={(e) => setLoanId(e.target.value)}
            className="w-full text-xs bg-slate-800 text-white px-2 py-1.5 rounded border border-slate-600 outline-none"
          >
            <option value="">Select loan...</option>
            {loans.map((l: any) => (
              <option key={l.id} value={l.id}>
                {l.lender_name} — {l.nickname || l.loan_type} (outstanding:{" "}
                {fmt(l.outstanding_balance)}, {l.interest_rate}% p.a.)
              </option>
            ))}
          </select>

          <input
            type="number"
            value={interestAmount}
            onChange={(e) => setInterestAmount(e.target.value)}
            placeholder="Interest amount (₹) — leave blank to auto-calculate"
            className="w-full text-xs bg-slate-800 text-white px-2 py-1.5 rounded border border-slate-600 outline-none"
          />

          <button
            onClick={() => linkMut.mutate()}
            disabled={!bankTxId || !loanId || linkMut.isPending}
            className="w-full text-xs bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white py-1.5 rounded"
          >
            {linkMut.isPending ? "Linking..." : "Link Repayment"}
          </button>

          {result && (
            <div className="bg-slate-800 rounded-lg p-3 mt-2 text-xs">
              <p className="text-emerald-400 font-semibold mb-1">✓ Linked successfully</p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="text-slate-400">Principal</p>
                  <p className="text-white font-medium">
                    {fmt(result.principal_paid)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Interest</p>
                  <p className="text-orange-300 font-medium">
                    {fmt(result.interest_paid)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Remaining</p>
                  <p className="text-white font-medium">
                    {fmt(result.loan_outstanding_after)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export default function SmartLinkingView() {
  const qc = useQueryClient();

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Smart Linking</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Link bank transactions to CC payments, loans, and cash — for an accurate net worth picture
          </p>
        </div>
        <button
          onClick={() => {
            qc.invalidateQueries({ queryKey: ["cc-payment-suggestions"] });
            qc.invalidateQueries({ queryKey: ["pending-actions"] });
            qc.invalidateQueries({ queryKey: ["cash-accounts"] });
          }}
          className="p-2 text-slate-400 hover:text-white"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Feature explainer */}
      <div className="grid grid-cols-2 gap-2">
        {[
          {
            icon: <CreditCard className="w-4 h-4 text-sky-400" />,
            title: "CC Payments",
            desc: "Tag bank debits as CC bill payments to prevent double-counting",
          },
          {
            icon: <ArrowDownCircle className="w-4 h-4 text-blue-400" />,
            title: "Borrowed Money",
            desc: "Mark large credits as loans received — not income",
          },
          {
            icon: <TrendingDown className="w-4 h-4 text-purple-400" />,
            title: "Interest Split",
            desc: "Auto-split loan repayments into principal + interest expense",
          },
          {
            icon: <Wallet className="w-4 h-4 text-amber-400" />,
            title: "Cash Wallet",
            desc: "Track cash in hand — ATM withdrawals, cash loans, expenses",
          },
        ].map((f) => (
          <div key={f.title} className="bg-slate-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              {f.icon}
              <span className="text-xs font-semibold text-white">{f.title}</span>
            </div>
            <p className="text-xs text-slate-500">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Action sections */}
      <CCPaymentSuggestions />
      <UntaggedLargeCredits />
      <CashAccountSection />
      <LoanRepaymentLinker />
    </div>
  );
}
