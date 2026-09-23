import { useWalletAdjustments } from '../../hooks/useWalletAdjustments'
import WalletAdjustmentHistory from './WalletAdjustmentHistory'
export default function ConnectedWalletAdjustmentHistory({ wallet, onClose }) {
  const history = useWalletAdjustments(wallet.id)
  return <WalletAdjustmentHistory wallet={wallet} onClose={onClose} {...history} />
}
