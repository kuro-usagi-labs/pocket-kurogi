import {
  Coffee, ShoppingBag, ShoppingCart, Car, Landmark,
  Receipt, Smartphone, Wallet, Zap, Home
} from 'lucide-react'

const CATEGORY_ICONS = {
  kopi: Coffee,
  makan: ShoppingBag,
  jajan: ShoppingBag,
  belanja: ShoppingCart,
  bensin: Car,
  transport: Car,
  gaji: Landmark,
  bonus: Landmark,
  listrik: Zap,
  rumah: Home,
}

export function CategoryIcon({ category, size = 18, strokeWidth = 2, ...props }) {
  const name = (category || '').toLowerCase()
  const Icon = CATEGORY_ICONS[name] || Receipt
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
