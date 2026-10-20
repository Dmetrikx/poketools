import type { ReactNode } from 'react'
import Navbar from './Navbar'
import type { User } from '@/types/auth'
import styles from './AppShell.module.css'

interface Props {
  user: User
  onLogout: () => void
  children: ReactNode
}

export default function AppShell({ user, onLogout, children }: Props) {
  return (
    <div className={styles.shell}>
      <Navbar user={user} onLogout={onLogout} />
      <main className={styles.main}>{children}</main>
    </div>
  )
}
