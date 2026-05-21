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

export interface NetWorthHistoryPoint {
  date: string
  net_worth: number
  total_assets: number
  total_liabilities: number
  change_amount: number
  change_pct: number
}
