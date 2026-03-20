import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '../components/ui/button'
import { deleteUserApi, listUsers, updateUserAdmin } from '../lib/api'

export function UserManagementPage() {
  const queryClient = useQueryClient()

  const usersQuery = useQuery({ queryKey: ['users'], queryFn: listUsers })

  const toggleAdmin = useMutation({
    mutationFn: ({ id, isAdmin }: { id: number; isAdmin: boolean }) => updateUserAdmin(id, isAdmin),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  })

  const deleteUser = useMutation({
    mutationFn: (id: number) => deleteUserApi(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  })

  if (usersQuery.isLoading) {
    return <div className="p-8 text-muted">Loading users...</div>
  }

  if (usersQuery.error) {
    return (
      <div className="p-8 text-reject">
        Failed to load users:{' '}
        {usersQuery.error instanceof Error ? usersQuery.error.message : 'Unknown error'}
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-text">User Management</h1>
      <div className="space-y-2">
        {usersQuery.data?.length === 0 && <p className="text-sm text-muted">No users found.</p>}
        {usersQuery.data?.map((user) => (
          <div
            key={user.id}
            className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface"
          >
            <div>
              <span className="font-medium text-text">{user.username}</span>
              {user.email && <span className="text-sm text-muted ml-2">{user.email}</span>}
              <div className="flex gap-2 mt-1">
                {user.isAdmin && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-accent/10 text-accent">
                    admin
                  </span>
                )}
                <span className="text-xs px-1.5 py-0.5 rounded bg-bg text-muted border border-border">
                  {user.authProvider}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => toggleAdmin.mutate({ id: user.id, isAdmin: !user.isAdmin })}
                disabled={toggleAdmin.isPending}
              >
                {user.isAdmin ? 'Remove admin' : 'Make admin'}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  if (confirm(`Delete user "${user.username}"?`)) {
                    deleteUser.mutate(user.id)
                  }
                }}
                disabled={deleteUser.isPending}
              >
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
