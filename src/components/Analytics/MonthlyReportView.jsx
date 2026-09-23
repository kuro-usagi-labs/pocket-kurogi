import { useAuth } from '../../contexts/AuthContext'
import { requestAssistantApi } from '../../lib/assistant/assistantApiClient'
import ReportContent from './ReportContent'

export default function MonthlyReportView(props) {
  const { user } = useAuth()
  // Discard the old account's report and pending exports on sign-out.
  return (
    <ReportContent
      {...props}
      key={user?.id || 'signed-out'}
      ownerId={user?.id}
      request={requestAssistantApi}
    />
  )
}
