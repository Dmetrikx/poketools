import { Link, NavLink } from 'react-router-dom'
import type { User } from '@/types/auth'
import styles from './Navbar.module.css'

interface Props {
  user: User
  onLogout: () => void
}

export default function Navbar({ user, onLogout }: Props) {
  return (
    <header className={styles.header}>
      <nav className={styles.nav}>
        <Link to="/" className={styles.brand}>
          Poketools
        </Link>
        <div className={styles.links}>
          <NavLink
            to="/"
            end
            className={({ isActive }) => isActive ? `${styles.link} ${styles.active}` : styles.link}
          >
            Decks
          </NavLink>
          <NavLink
            to="/import"
            className={({ isActive }) => isActive ? `${styles.link} ${styles.active}` : styles.link}
          >
            Import
          </NavLink>
        </div>
        <div className={styles.account}>
          <span className={styles.email}>{user.email}</span>
          <button className={styles.logout} onClick={onLogout}>
            Log out
          </button>
        </div>
      </nav>
    </header>
  )
}
