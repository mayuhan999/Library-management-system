import { useAuth } from '@/context/AuthContext'

export function ReaderAccountPage() {
  const { user } = useAuth()

  return (
    <div className="b-app max-w-lg space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-[#003366]">Account</h1>
        <p className="mt-1 text-sm text-[#5c6b7a]">Summary of your reader profile.</p>
      </div>

      <dl className="rounded-sm border border-[#e5e8eb] bg-white p-5 text-sm">
        <div className="flex justify-between border-b border-[#f0f2f4] py-2">
          <dt className="text-[#5c6b7a]">Name</dt>
          <dd className="font-medium text-[#1a2b3c]">{user?.fullName}</dd>
        </div>
        <div className="flex justify-between border-b border-[#f0f2f4] py-2">
          <dt className="text-[#5c6b7a]">Email</dt>
          <dd className="font-mono text-xs text-[#1a2b3c]">{user?.email}</dd>
        </div>
        <div className="flex justify-between py-2">
          <dt className="text-[#5c6b7a]">Role</dt>
          <dd>
            <span className="rounded-sm border border-[#003366]/25 bg-[#e8eef4] px-2 py-0.5 text-xs font-medium text-[#003366]">
              Reader
            </span>
          </dd>
        </div>
      </dl>
    </div>
  )
}
