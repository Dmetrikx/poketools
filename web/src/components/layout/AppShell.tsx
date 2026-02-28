import type { ReactNode } from 'react'
import Navbar from './Navbar'
import styles from './AppShell.module.css'

interface Props {
  children: ReactNode
}

export default function AppShell({ children }: Props) {
  return (
    <div className={styles.shell}>
      <Navbar />
      <main className={styles.main}>{children}</main>
    </div>
  )
}
