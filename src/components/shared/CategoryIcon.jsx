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
  private: Landmark,
  pay: Smartphone,
}

const BRAND_WALLETS = [
  {
    keys: ['bca'],
    label: 'BCA',
    bg: '#EAF3FF',
    fg: '#0066B3',
    textClass: 'font-black tracking-[-0.03em]',
  },
  {
    keys: ['dana'],
    label: 'DANA',
    bg: '#EAF6FF',
    fg: '#118EEA',
    textClass: 'font-black tracking-[-0.02em]',
  },
  {
    keys: ['gopay', 'go pay'],
    label: 'Go',
    subLabel: 'Pay',
    bg: '#E8F7FF',
    fg: '#00AED6',
    textClass: 'font-black tracking-[-0.04em]',
  },
  {
    keys: ['ovo'],
    label: 'OVO',
    bg: '#F2ECFF',
    fg: '#4C2A86',
    textClass: 'font-black tracking-[-0.02em]',
  },
  {
    keys: ['shopeepay', 'shopee pay', 'shopee'],
    label: 'S',
    subLabel: 'Pay',
    bg: '#FFF0EA',
    fg: '#EE4D2D',
    textClass: 'font-black',
  },
  {
    keys: ['linkaja', 'link aja'],
    label: 'Link',
    subLabel: 'Aja',
    bg: '#FFEDEE',
    fg: '#E2231A',
    textClass: 'font-black tracking-[-0.06em]',
  },
  {
    keys: ['mandiri'],
    label: 'M',
    subLabel: 'Mandiri',
    bg: '#FFF8DB',
    fg: '#003D79',
    accent: '#F7C600',
    textClass: 'font-black',
  },
  {
    keys: ['bni'],
    label: 'BNI',
    bg: '#FFF2E8',
    fg: '#F15A24',
    accent: '#006B5B',
    textClass: 'font-black tracking-[-0.03em]',
  },
  {
    keys: ['bri'],
    label: 'BRI',
    bg: '#EDF4FF',
    fg: '#00529C',
    textClass: 'font-black tracking-[-0.03em]',
  },
  {
    keys: ['jago'],
    label: 'Jago',
    bg: '#FFF4E4',
    fg: '#F37021',
    textClass: 'font-black tracking-[-0.05em]',
  },
  {
    keys: ['seabank', 'sea bank'],
    label: 'Sea',
    subLabel: 'Bank',
    bg: '#FFF3E8',
    fg: '#F36F21',
    textClass: 'font-black tracking-[-0.04em]',
  },
]

function normalizeWalletName(name = '') {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function findBrandWallet(walletName) {
  const normalized = normalizeWalletName(walletName)
  const compact = normalized.replace(/\s+/g, '')
  const tokens = normalized.split(' ').filter(Boolean)

  return BRAND_WALLETS.find((brand) => (
    brand.keys.some((key) => {
      const normalizedKey = normalizeWalletName(key)
      const compactKey = normalizedKey.replace(/\s+/g, '')

      if (normalizedKey.includes(' ')) {
        return normalized.includes(normalizedKey) || compact.includes(compactKey)
      }

      return tokens.some((token) => token === normalizedKey || new RegExp(`^${normalizedKey}\\d+$`).test(token))
    })
  ))
}

function BrandWalletIcon({ brand, size = 20, className = '', ...props }) {
  const width = typeof size === 'number' ? size + 8 : size
  const height = size

  return (
    <span
      aria-label={brand.label + (brand.subLabel ? ` ${brand.subLabel}` : '')}
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[6px] ${className}`}
      role="img"
      style={{
        width,
        height,
        backgroundColor: brand.bg,
        color: brand.fg,
      }}
      {...props}
    >
      {brand.accent ? (
        <span
          className="absolute bottom-0 left-0 h-[3px] w-full"
          style={{ backgroundColor: brand.accent }}
        />
      ) : null}
      <span className={`relative font-jakarta text-[9px] leading-none ${brand.textClass}`}>
        {brand.label}
      </span>
      {brand.subLabel ? (
        <span className="relative ml-0.5 font-jakarta text-[6px] font-black uppercase leading-none tracking-[-0.04em]">
          {brand.subLabel}
        </span>
      ) : null}
    </span>
  )
}

export function WalletIcon({ walletName, size = 20, strokeWidth = 2, ...props }) {
  const lower = (walletName || '').toLowerCase()
  const brand = findBrandWallet(walletName)

  if (brand) {
    return <BrandWalletIcon brand={brand} size={size} {...props} />
  }

  const matchedKey = Object.keys(WALLET_KEYWORDS).find((k) => lower.includes(k))
  const Icon = matchedKey ? WALLET_KEYWORDS[matchedKey] : Wallet
  return <Icon size={size} strokeWidth={strokeWidth} {...props} />
}
