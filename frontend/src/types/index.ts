export interface User {
  id: string
  email: string
  username: string
  full_name: string | null
  currency: string
  timezone: string
  created_at: string
}

export interface CreditCard {
  id: string
  nickname: string
  bank_name: string
  card_name: string | null
  last_four: string
  network: 'VISA' | 'MASTERCARD' | 'AMEX' | 'RUPAY' | 'DINERS' | 'OTHER'
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED' | 'CLOSED'
  credit_limit: number
  available_limit: number
  current_outstanding: number
  interest_rate: number
  billing_cycle_day: number
  due_date_day: number
  annual_fee: number
  reward_program: string | null
  reward_rate: number
  total_reward_points: number
  lounge_access: boolean
  lounge_quota_quarterly: number
  expiry_month: number | null
  expiry_year: number | null
  card_color: string
  notes: string | null
  created_at: string
}

export interface Transaction {
  id: string
  card_id: string | null
  statement_id: string | null
  transaction_date: string
  description: string
  merchant_name: string | null
  amount: number
  currency: string
  transaction_type: TransactionType
  category: CategoryType
  is_emi: boolean
  emi_id: string | null
  gst_amount: number
  cashback_amount: number
  reward_points: number
  is_recurring: boolean
  is_subscription: boolean
  is_duplicate: boolean
  is_suspicious: boolean
  is_excluded: boolean
  notes: string | null
  tags: string[]
  created_at: string
}

export type TransactionType = 'PURCHASE' | 'EMI' | 'CASH_ADVANCE' | 'PAYMENT' | 'REFUND' | 'FEE' | 'INTEREST' | 'REWARD_REDEMPTION' | 'OTHER'
export type CategoryType = 'FOOD' | 'FUEL' | 'SHOPPING' | 'RENT' | 'EMI' | 'TRAVEL' | 'UTILITIES' | 'ENTERTAINMENT' | 'INVESTMENT' | 'HEALTHCARE' | 'SUBSCRIPTION' | 'EDUCATION' | 'GROCERIES' | 'DINING' | 'CASH_WITHDRAWAL' | 'TRANSFER' | 'FEES' | 'OTHER'

export interface EMI {
  id: string
  card_id: string | null
  friend_id: string | null
  product_name: string
  merchant_name: string | null
  purchase_date: string
  purchase_amount: number
  total_amount: number
  monthly_emi: number
  tenure_months: number
  interest_rate: number
  is_no_cost_emi: boolean
  processing_fee: number
  total_interest: number
  paid_months: number
  remaining_months: number | null
  amount_paid: number
  amount_remaining: number | null
  start_date: string | null
  end_date: string | null
  next_due_date: string | null
  owner_type: 'SELF' | 'FRIEND' | 'FAMILY' | 'OFFICE' | 'SHARED'
  user_share_percent: number
  status: 'ACTIVE' | 'COMPLETED' | 'PRECLOSED' | 'DEFAULTED'
  amount_collected: number
  reminder_enabled: boolean
  reminder_day: number
  notes: string | null
  created_at: string
  payments: EMIPayment[]
}

export interface EMIPayment {
  id: string
  emi_id: string
  installment_no: number
  due_date: string
  paid_date: string | null
  expected_amount: number
  paid_amount: number
  is_paid: boolean
  is_overdue: boolean
  late_fee: number
  notes: string | null
}

export interface Friend {
  id: string
  name: string
  phone: string | null
  whatsapp: string | null
  email: string | null
  relation: string
  avatar_color: string
  is_active: boolean
  total_emi_amount: number
  total_collected: number
  total_pending: number
  active_emi_count: number
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH'
  notes: string | null
  created_at: string
}

export interface Statement {
  id: string
  card_id: string
  filename: string
  statement_date: string | null
  period_from: string | null
  period_to: string | null
  due_date: string | null
  opening_balance: number
  closing_balance: number
  total_due: number
  minimum_due: number
  total_payments: number
  total_purchases: number
  total_emi: number
  total_fees: number
  total_interest: number
  reward_points_earned: number
  status: 'PENDING' | 'PROCESSING' | 'PARSED' | 'FAILED'
  bank_detected: string | null
  parse_error: string | null
  transaction_count: number
  created_at: string
}

export interface Insight {
  id: string
  insight_type: string
  severity: 'INFO' | 'WARNING' | 'CRITICAL'
  title: string
  body: string
  action_label: string | null
  action_url: string | null
  is_read: boolean
  is_dismissed: boolean
  insight_data: Record<string, unknown> | null
  created_at: string
}

export interface DashboardStats {
  total_outstanding: number
  total_credit_limit: number
  total_available: number
  utilization_pct: number
  monthly_spend: number
  monthly_payments: number
  monthly_emi_burden: number
  upcoming_dues: CardSummary[]
  next_due_date: string | null
  next_due_amount: number
  emi_summary: EMISummary
  friend_receivables: FriendReceivable[]
  total_receivables: number
  cashback_earned_month: number
  interest_paid_month: number
  reward_points_balance: number
  monthly_trends: MonthlyTrend[]
  category_spending: CategorySpend[]
  unread_insights: number
}

export interface CardSummary {
  card_id: string
  nickname: string
  bank_name: string
  outstanding: number
  utilization_pct: number
  next_due: string | null
  min_due: number
}

export interface EMISummary {
  active_count: number
  total_monthly: number
  total_outstanding: number
  self_emis: number
  friend_emis: number
  family_emis: number
}

export interface FriendReceivable {
  friend_id: string
  name: string
  total_pending: number
  overdue_count: number
  next_due: string | null
}

export interface CategorySpend {
  category: string
  amount: number
  count: number
  percentage: number
}

export interface MonthlyTrend {
  month: string
  spend: number
  payments: number
  emi: number
  fees: number
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_amount?: number
}

// ── Financial OS: New Types ────────────────────────────────────────────────

export interface BankAccount {
  id: string
  nickname: string
  bank_name: string
  account_type: 'SAVINGS' | 'CURRENT' | 'SALARY' | 'WALLET' | 'UPI' | 'CASH' | 'FD' | 'RD'
  account_number_last4: string | null
  ifsc_code: string | null
  current_balance: string   // Decimal as string from Pydantic
  minimum_balance: string
  interest_rate: string
  maturity_date: string | null
  maturity_amount: string | null
  account_color: string
  is_active: boolean
  is_primary: boolean
  notes: string | null
  created_at: string
}

export interface Investment {
  id: string
  investment_type: 'STOCKS' | 'MUTUAL_FUND' | 'ETF' | 'CRYPTO' | 'GOLD' | 'SILVER' | 'SGB' | 'PPF' | 'EPF' | 'NPS' | 'BONDS' | 'REITS' | 'OTHER'
  name: string
  symbol: string | null
  folio_number: string | null
  units: string
  avg_buy_price: string
  current_price: string
  current_value: string
  invested_amount: string
  is_sip: boolean
  sip_amount: string | null
  sip_date: number | null
  sip_status: string | null
  sip_start_date: string | null
  weight_grams: string | null
  purity: string | null
  broker: string | null
  platform: string | null
  lock_in_until: string | null
  is_locked: boolean
  unrealized_pnl: string
  realized_pnl: string
  xirr: string | null
  cagr: string | null
  purchase_date: string | null
  notes: string | null
  last_price_updated: string | null
  created_at: string
}

export interface Loan {
  id: string
  loan_type: 'HOME' | 'PERSONAL' | 'VEHICLE' | 'EDUCATION' | 'GOLD' | 'BUSINESS' | 'BNPL' | 'INFORMAL' | 'OTHER'
  lender_name: string
  loan_account_number: string | null
  nickname: string | null
  principal_amount: string
  outstanding_balance: string
  emi_amount: string | null
  total_paid: string
  total_interest_paid: string
  interest_rate: string
  tenure_months: number | null
  remaining_months: number | null
  start_date: string
  end_date: string | null
  emi_due_day: number
  status: 'ACTIVE' | 'CLOSED' | 'OVERDUE' | 'WRITTEN_OFF'
  is_secured: boolean
  collateral: string | null
  prepayment_penalty: string
  notes: string | null
  created_at: string
}

export interface Asset {
  id: string
  asset_type: 'REAL_ESTATE' | 'VEHICLE' | 'JEWELRY' | 'ELECTRONICS' | 'FURNITURE' | 'ARTWORK' | 'OTHER'
  name: string
  description: string | null
  purchase_price: string | null
  current_value: string
  purchase_date: string | null
  depreciation_rate: string
  location: string | null
  area_sqft: string | null
  registration_number: string | null
  make_model: string | null
  year_of_manufacture: number | null
  is_insured: boolean
  insurance_expiry: string | null
  insurance_value: string | null
  is_mortgaged: boolean
  mortgage_outstanding: string
  notes: string | null
  created_at: string
}

export interface NetWorthData {
  bank_balance: number
  investment_value: number
  total_invested: number
  investment_pnl: number
  asset_value: number
  total_assets: number
  credit_card_outstanding: number
  loan_outstanding: number
  total_liabilities: number
  net_worth: number
  change_amount: number
  change_pct: number
}

// Banking
export interface BankTransaction {
  id: string
  account_id: string
  transaction_date: string
  description: string
  amount: number
  tx_type: 'CREDIT' | 'DEBIT' | 'TRANSFER'
  category: string
  merchant_name: string | null
  reference_no: string | null
  balance_after: number | null
  is_hidden_charge: boolean
  is_recurring: boolean
  is_duplicate: boolean
  import_source: string
  notes: string | null
}

export interface CashflowIntelligence {
  total_balance: number
  liquid_balance: number
  monthly_avg_in: number
  monthly_avg_out: number
  burn_rate: number
  runway_months: number
  monthly_loan_emi: number
  monthly_emi: number
  hidden_total: number
  hidden_count: number
  monthly_cashflow: { month: string; inflow: number; outflow: number; net: number }[]
  category_breakdown: { category: string; amount: number }[]
  hidden_charges: BankTransaction[]
  upcoming_payments: { label: string; amount: number; days_left: number; type: string }[]
  account_health: {
    id: string; nickname: string; bank_name: string; account_type: string
    balance: number; minimum_balance: number; below_min: boolean
    interest_rate: number; account_color: string; is_primary: boolean
  }[]
  insights: { severity: string; title: string; body: string; action: string | null }[]
}

// ── Investment Intelligence ────────────────────────────────────────────────
export interface InvAllocationSlice {
  key: string; label: string; value: number; pct: number; color: string
}
export interface InvTypeBreakdown {
  type: string; label: string; color: string
  invested: number; current: number; pnl: number; pnl_pct: number
  count: number; sip_amount: number; pct: number
}
export interface InvHolding {
  id: string; name: string; type: string; label: string; color: string
  invested: number; current: number; pnl: number; pnl_pct: number
  is_sip: boolean; sip_amount: number; broker: string; symbol: string
  is_locked: boolean; pct: number
}
export interface InvPerformer { name: string; type: string; pnl: number; pnl_pct: number }
export interface InvInsight { severity: 'CRITICAL'|'WARNING'|'INFO'; title: string; body: string; action: string|null }

export interface InvestmentIntelligence {
  total_invested: number; total_value: number; total_pnl: number; pnl_pct: number
  realized_pnl: number; sip_monthly: number; sip_count: number; locked_value: number
  diversification_score: number
  allocation: InvAllocationSlice[]
  by_type: InvTypeBreakdown[]
  top_holdings: InvHolding[]
  best_performers: InvPerformer[]
  worst_performers: InvPerformer[]
  insights: InvInsight[]
}

// ── Loan Intelligence ──────────────────────────────────────────────────────
export interface LoanTypeBreakdown {
  type: string; label: string; color: string
  outstanding: number; emi: number; count: number; pct: number
}
export interface LoanCard {
  id: string; name: string; lender: string; type: string; label: string; color: string
  principal: number; outstanding: number; paid: number; paid_pct: number
  emi: number; interest_rate: number; remaining_months: number|null
  tenure_months: number|null; emi_due_day: number; status: string
  is_secured: boolean; prepayment_penalty: number; notes: string|null
}
export interface AmortizationMonth { month: string; interest: number; principal: number; emi: number }
export interface HighInterestLoan  { name: string; rate: number; outstanding: number }
export interface LoanInsight        { severity: 'CRITICAL'|'WARNING'|'INFO'; title: string; body: string; action: string|null }

export interface LoanIntelligence {
  total_outstanding: number; total_monthly_emi: number; total_principal: number
  total_paid: number; total_interest_paid: number; weighted_avg_rate: number
  secured_total: number; unsecured_total: number; active_count: number
  by_type: LoanTypeBreakdown[]
  loan_cards: LoanCard[]
  amortization: AmortizationMonth[]
  high_interest: HighInterestLoan[]
  insights: LoanInsight[]
}

// ── Asset Intelligence ─────────────────────────────────────────────────────
export interface AssetTypeBreakdown {
  type: string; label: string; color: string; value: number; count: number; pct: number
}
export interface LiquidityTier  { tier: string; value: number; pct: number; color: string }
export interface AssetCard {
  id: string; name: string; type: string; label: string; color: string; liquidity: string
  purchase_price: number; current_value: number; gain: number; gain_pct: number; cagr: number
  is_insured: boolean; insurance_expiry: string|null; ins_expiry_days: number|null
  insurance_value: number; is_mortgaged: boolean; mortgage_outstanding: number
  depreciation_rate: number; location: string|null; area_sqft: number
  registration_number: string|null; make_model: string|null; year_of_manufacture: number|null
  purchase_date: string|null; notes: string|null
}
export interface AssetInsight { severity: 'CRITICAL'|'WARNING'|'INFO'; title: string; body: string; action: string|null }

export interface AssetIntelligence {
  total_value: number; free_value: number; mortgaged_value: number
  insured_value: number; uninsured_value: number
  purchase_total: number; appreciation: number; asset_count: number
  by_type: AssetTypeBreakdown[]
  liquidity_breakdown: LiquidityTier[]
  asset_cards: AssetCard[]
  insights: AssetInsight[]
}

export interface NetWorthHistoryPoint {
  date: string
  net_worth: number
  total_assets: number
  total_liabilities: number
  change_amount: number
  change_pct: number
}
