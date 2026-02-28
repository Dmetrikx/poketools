import { Link, NavLink } from 'react-router-dom'
import styles from './Navbar.module.css'

export default function Navbar() {
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
      </nav>
    </header>
  )
}
