/** Role capabilities (enforcement is server-side). */
const MATRIX = [
  { role: 'MEMBER', caps: 'Catalog search, borrow online, place holds, view loans and holds.' },
  { role: 'LIBRARIAN', caps: 'Desk checkout, add books, inventory, hold queue.' },
  { role: 'ADMIN', caps: 'All librarian capabilities plus user management and system/rules configuration.' },
]

export function AdminPermissionsPage() {
  return (
    <div className="b-app space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-[#003366]">Permissions</h1>
        <p className="mt-1 text-sm text-[#5c6b7a]">
          Roles are enforced by the API. Assign roles when creating users under User management.
        </p>
      </div>

      <div className="overflow-x-auto rounded-sm border border-[#e5e8eb] bg-white">
        <table className="b-table w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr className="border-b border-[#e5e8eb] bg-[#f5f5f5]">
              <th className="px-4 py-2 font-medium text-[#3d4f5f]">Role</th>
              <th className="px-4 py-2 font-medium text-[#3d4f5f]">Capabilities</th>
            </tr>
          </thead>
          <tbody>
            {MATRIX.map((row) => (
              <tr key={row.role} className="border-b border-[#f0f2f4]">
                <td className="px-4 py-3">
                  <span className="rounded-sm border border-[#003366]/25 bg-[#e8eef4] px-2 py-0.5 text-xs font-semibold text-[#003366]">
                    {row.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-[#1a2b3c]">{row.caps}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
