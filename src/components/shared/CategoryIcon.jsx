import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  BadgeDollarSign,
  BanknoteArrowDown,
  BriefcaseBusiness,
  BusFront,
  Car,
  CircleDollarSign,
  Coffee,
  Gift,
  Goal,
  HandCoins,
  HeartHandshake,
  Home,
  Landmark,
  PiggyBank,
  Pizza,
  Plane,
  Receipt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Soup,
  UtensilsCrossed,
  Wallet,
  WalletCards,
  WalletMinimal,
  Zap,
} from 'lucide-react'

const CATEGORY_ICONS = {
  kopi: Coffee,
  minum: Coffee,
  cafe: Coffee,
  restoran: UtensilsCrossed,
  makan: UtensilsCrossed,
  makanan: UtensilsCrossed,
  jajan: Pizza,
  snack: Pizza,
  camilan: Pizza,
  belanja: ShoppingCart,
  belanjaan: ShoppingCart,
  groceries: ShoppingBag,
  bensin: Car,
  transport: Car,
  perjalanan: Plane,
  travel: Plane,
  gaji: Landmark,
  bonus: Landmark,
  freelance: BriefcaseBusiness,
  komisi: CircleDollarSign,
  fee: CircleDollarSign,
  listrik: Zap,
  air: Home,
  internet: Smartphone,
  rumah: Home,
  kesehatan: HeartHandshake,
  medis: HeartHandshake,
  hadiah: Gift,
  hiburan: BadgeDollarSign,
  dana: Smartphone,
  ovo: Smartphone,
  gopay: Smartphone,
}

const TRANSACTION_ICON_MAP = {
  transfer_out: ArrowUpRight,
  transfer_in: ArrowDownLeft,
  transfer: ArrowLeftRight,
  goal_contribution: PiggyBank,
  goal_initial_contribution: Goal,
  goal_withdrawal: WalletMinimal,
  goal_refund: HandCoins,
  wallet_opening_balance: WalletCards,
  income_salary: BriefcaseBusiness,
  income_bonus: Gift,
  income_general: BanknoteArrowDown,
  expense_food: UtensilsCrossed,
  expense_coffee: Coffee,
  expense_snack: Pizza,
  expense_shopping: ShoppingBag,
  expense_transport: BusFront,
  expense_travel: Plane,
  expense_bills: Zap,
  expense_home: Home,
  expense_digital: Smartphone,
  expense_health: HeartHandshake,
  expense_general: Receipt,
}

export function CategoryIcon({ category, size = 18, strokeWidth = 2, ...props }) {
  const name = (category || '').toLowerCase()
  const Icon = CATEGORY_ICONS[name] || Receipt
  return <Icon size={size} strokeWidth={strokeWidth} {...props} />
}

export function TransactionIcon({ iconKey, category, size = 20, strokeWidth = 2, ...props }) {
  const Icon =
    TRANSACTION_ICON_MAP[String(iconKey || '').toLowerCase()] ||
    CATEGORY_ICONS[String(category || '').toLowerCase()] ||
    Receipt

  return <Icon size={size} strokeWidth={strokeWidth} {...props} />
}

const WALLET_KEYWORDS = {
  bank: Landmark,
  bca: Landmark,
  mandiri: Landmark,
  bni: Landmark,
  bri: Landmark,
  private: Landmark,
  gopay: Smartphone,
  ovo: Smartphone,
  dana: Smartphone,
  shopee: Smartphone,
  linkaja: Smartphone,
  pay: Smartphone,
}

export function WalletIcon({ walletName, size = 20, strokeWidth = 2, ...props }) {
  const lower = (walletName || '').toLowerCase()
  const matchedKey = Object.keys(WALLET_KEYWORDS).find((k) => lower.includes(k))
  const Icon = matchedKey ? WALLET_KEYWORDS[matchedKey] : Wallet
  return <Icon size={size} strokeWidth={strokeWidth} {...props} />
}
