import { useEffect, useMemo, useState } from 'react'
import { events as EVENTS, nightShows } from './data/events'
import { specialPrograms as SPECIAL_PROGRAMS } from './data/specialPrograms'
import VenueMap from './components/VenueMap'
import './App.css'

const FILTERS = ['All', 'Technical', 'Workshop', 'Cultural', 'Music', 'Gaming', 'Sports']
const PAGES = [
  { id: 'home', label: 'Home' },
  { id: 'special-programs', label: 'Special Programs' },
  { id: 'events', label: 'Events' },
  { id: 'venue-map', label: 'Venue Map' },
  { id: 'seat-stats', label: 'Seat Stats' },
]
const DAYS = [
  { id: 1, label: 'Day 1 · 22 Oct' },
  { id: 2, label: 'Day 2 · 23 Oct' },
  { id: 3, label: 'Day 3 · 24 Oct' },
]
const STORAGE_KEY = 'campus-hub-event-state'

function pageFromHash() {
  const page = window.location.hash.replace(/^#\/?/, '')
  return PAGES.some((item) => item.id === page) ? page : 'home'
}

function loadSavedState() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (!saved) return { seats: {}, registered: [] }

    const parsed = JSON.parse(saved)
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof parsed.seats !== 'object' ||
      parsed.seats === null ||
      Array.isArray(parsed.seats) ||
      !Array.isArray(parsed.registered)
    ) {
      console.error('Saved event data is invalid; starting with the default event seats.')
      return { seats: {}, registered: [] }
    }
    return parsed
  } catch (error) {
    console.error('Could not load saved event registrations.', error)
    return { seats: {}, registered: [] }
  }
}

function App() {
  const [savedState, setSavedState] = useState(loadSavedState)
  const [activePage, setActivePage] = useState(pageFromHash)
  const [activeFilter, setActiveFilter] = useState('All')
  const [activeDay, setActiveDay] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [daysToGo, setDaysToGo] = useState(() =>
    Math.max(0, Math.ceil((new Date(2026, 9, 22) - new Date()) / 86400000)),
  )
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [formMessage, setFormMessage] = useState('')
  const [theme, setTheme] = useState(() => {
    try {
      return window.localStorage.getItem('campus-hub-theme') === 'light' ? 'light' : 'dark'
    } catch (error) {
      console.error('Could not load the saved theme preference.', error)
      return 'dark'
    }
  })

  const currentEvent = selectedEvent
    ? [...EVENTS, ...SPECIAL_PROGRAMS].find((item) => item.id === selectedEvent.id)
    : null

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      window.localStorage.setItem('campus-hub-theme', theme)
    } catch (error) {
      console.error('Could not save the theme preference.', error)
    }
  }, [theme])

  useEffect(() => {
    // Persist registrations locally so seat counts survive a page reload.
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(savedState))
    } catch (error) {
      console.error('Could not save event registrations.', error)
    }
  }, [savedState])

  useEffect(() => {
    // Recalculate the local-calendar countdown regularly so it advances without a reload.
    const updateCountdown = () =>
      setDaysToGo(Math.max(0, Math.ceil((new Date(2026, 9, 22) - new Date()) / 86400000)))
    const timer = window.setInterval(updateCountdown, 60000)
    return () => window.clearInterval(timer)
  }, [])

  // Apply category and search filters only after selecting the fest day.
  const visibleEvents = useMemo(
    () =>
      EVENTS.filter((event) => event.day === activeDay)
        .filter((event) => activeFilter === 'All' || event.category === activeFilter.toLowerCase())
        .filter((event) => `${event.title} ${event.categoryLabel} ${event.venue}`.toLowerCase().includes(searchQuery.trim().toLowerCase())),
    [activeDay, activeFilter, searchQuery],
  )

  const totalSeats = EVENTS.reduce(
    (total, event) => total + (savedState.seats[event.id] ?? event.seatsLeft),
    0,
  )
  const daySeatStats = [1, 2, 3].map((day) => {
    const dayEvents = EVENTS.filter((event) => event.day === day)
    const seatsRemaining = dayEvents.reduce(
      (total, event) => total + (savedState.seats[event.id] ?? event.seatsLeft),
      0,
    )
    const capacity = dayEvents.reduce((total, event) => total + event.seatsLeft, 0)
    return { day, seatsRemaining, seatsFilled: capacity - seatsRemaining, capacity }
  })

  useEffect(() => {
    // Track the section in view and honor a shared hash after client rendering.
    const sections = PAGES.map(({ id }) => document.getElementById(id)).filter(Boolean)
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleSection = entries
          .filter((entry) => entry.isIntersecting)
          .sort((first, second) => second.intersectionRatio - first.intersectionRatio)[0]
        if (visibleSection) setActivePage(visibleSection.target.id)
      },
      { rootMargin: '-15% 0px -70% 0px', threshold: [0, 0.1, 0.25, 0.5] },
    )
    sections.forEach((section) => observer.observe(section))

    const syncHash = () => navigateToSection(pageFromHash(), false)
    window.addEventListener('hashchange', syncHash)
    window.addEventListener('popstate', syncHash)
    if (window.location.hash) {
      window.setTimeout(() => navigateToSection(pageFromHash(), false), 0)
    }

    return () => {
      observer.disconnect()
      window.removeEventListener('hashchange', syncHash)
      window.removeEventListener('popstate', syncHash)
    }
  }, [])

  function navigateToSection(pageId, smooth = true) {
    setActivePage(pageId)
    if (window.location.hash !== `#${pageId}`) {
      window.history.pushState(null, '', `#${pageId}`)
    }
    const section = document.getElementById(pageId)
    if (!section) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({
      top: window.scrollY + section.getBoundingClientRect().top,
      behavior: smooth && !reducedMotion ? 'smooth' : 'instant',
    })
  }

  function openRegistration(event) {
    setSelectedEvent(event)
    setFormMessage('')
  }

  function handleRegistration(event) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const name = String(formData.get('name') || '').trim()
    const email = String(formData.get('email') || '').trim()

    // Validate before changing saved seats so invalid submissions never reserve a place.
    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFormMessage('Enter your name and a valid email address to continue.')
      return
    }

    const remaining = savedState.seats[currentEvent.id] ?? currentEvent.seatsLeft
    // Check and decrement seats in the same state update to prevent overbooking.
    if (remaining <= 0) {
      setFormMessage('This event is full. Choose another event to join.')
      return
    }

    setSavedState((current) => ({
      seats: {
        ...current.seats,
        [currentEvent.id]: (current.seats[currentEvent.id] ?? currentEvent.seatsLeft) - 1,
      },
      registered: [...current.registered, { eventId: currentEvent.id, name, email }],
    }))
    setFormMessage(`You're on the list, ${name.split(' ')[0]}! See you there.`)
  }

  return (
    <div className="app">
      <header className="navbar">
        <a
          className="brand"
          href="#home"
          aria-label="SRISHTI 2K'26 home"
          onClick={(event) => {
            event.preventDefault()
            navigateToSection('home')
          }}
        >
          <span className="brand-icon">✳</span>
          <span className="brand-name">SRISHTI 2K&apos;26</span>
        </a>

        <nav className="nav-links" aria-label="Main navigation">
          {PAGES.map((page) => (
            <a
              href={`#${page.id}`}
              key={page.id}
              aria-current={activePage === page.id ? 'page' : undefined}
              onClick={(event) => {
                event.preventDefault()
                navigateToSection(page.id)
              }}
            >
              {page.label}
            </a>
          ))}
        </nav>

        <button
          className="theme-toggle"
          type="button"
          onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        >
          <span aria-hidden="true">{theme === 'dark' ? '☼' : '◐'}</span>
          <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
        </button>
      </header>

      <main>
        <section className="hero" id="home">
          <div className="hero-content">
            <span className="eyebrow">
              <span className="live-dot"></span>
              YOUR CAMPUS. YOUR MOMENT.
            </span>

            <h1>SRISHTI 2K’26</h1>

            <p className="hero-quote">Grab your certificates by being a part of our campus.</p>

            <div className="hero-actions">
              <a className="primary-button" href="#events" onClick={(event) => {
                event.preventDefault()
                navigateToSection('events')
              }}>
                Explore events <span>↗</span>
              </a>
              <a className="secondary-button" href="#special-programs" onClick={(event) => {
                event.preventDefault()
                navigateToSection('special-programs')
              }}>
                Explore special programs <span>↗</span>
              </a>
            </div>

            <div className="hero-stats" aria-label="Campus event highlights">
              <div className="stat-box">
                <strong>{EVENTS.length.toString().padStart(2, '0')}</strong>
                <span>Events</span>
              </div>
              <div className="stat-box">
                <strong>{daysToGo.toString().padStart(2, '0')}</strong>
                <span>Days to go</span>
              </div>
              <div className="stat-box">
                <strong>{totalSeats.toString().padStart(2, '0')}</strong>
                <span>Seats left</span>
              </div>
            </div>
          </div>

          <div className="hero-art" aria-hidden="true">
            <div className="art-orbit orbit-one"></div>
            <div className="art-orbit orbit-two"></div>
            <div className="art-circle">
              <span className="art-star">✳</span>
              <span className="art-caption">MEET. CREATE. REPEAT.</span>
            </div>
            <div className="floating-card card-top">✦ Something exciting is happening</div>
            <div className="floating-card card-bottom">
              <span className="mini-dot"></span>
              Your next favourite memory
            </div>
          </div>
        </section>

        <div className="ticker" aria-label="Upcoming campus events">
          <div className="ticker-track">
            {[...EVENTS, ...EVENTS].map((event, index) => (
              <span className="ticker-item" key={`${event.id}-${index}`}>
                <span aria-hidden="true">✳</span>
                {event.title}
              </span>
            ))}
          </div>
        </div>

        <section className="page-section programs-page" id="special-programs">
          <div className="page-heading">
            <span className="section-label">THREE NIGHTS. THREE BIG MOMENTS.</span>
            <h1>Special Programs</h1>
            <p>Save your pass for the festival’s headline night shows.</p>
          </div>
          <div className="program-grid">
            {SPECIAL_PROGRAMS.map((program) => {
              const remaining = savedState.seats[program.id] ?? program.seatsLeft
              return (
                <article className="program-card category-music" key={program.id}>
                  <div className="card-strip"></div>
                  <div className="program-card-art">
                    <span className="program-date">DAY {program.day} · {program.date}</span>
                    <span className="program-icon" aria-hidden="true">{program.icon}</span>
                    <span className="program-art-label">SRISHTI NIGHT LIVE</span>
                  </div>
                  <div className="program-card-content">
                    <h2>{program.title}</h2>
                    <p>{program.description}</p>
                    <div className="event-meta">
                      <span>{program.time}</span>
                      <span>{program.venue}</span>
                    </div>
                    <div className="event-card-bottom">
                      <span className={`seats ${remaining === 0 ? 'full' : remaining < 5 ? 'low' : ''}`}>
                        {remaining === 0 ? 'Full' : `${remaining} passes left`}
                      </span>
                      <button
                        className="register-button"
                        type="button"
                        disabled={remaining === 0}
                        onClick={() => openRegistration(program)}
                      >
                        {remaining === 0 ? 'Full' : 'Register'} <span aria-hidden="true">↗</span>
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <section className="events-section" id="events">
          <div className="section-heading">
            <div>
              <span className="section-label">THE CAMPUS CALENDAR</span>
              <h2>Pick your arena, own your moment</h2>
            </div>
            <span className="event-count">{visibleEvents.length} EVENTS TO EXPLORE ↘</span>
          </div>

          <div className="day-tabs-scroll" role="tablist" aria-label="Choose fest day">
            {DAYS.map((day) => (
              <button
                className={activeDay === day.id ? 'day-tab active' : 'day-tab'}
                key={day.id}
                type="button"
                role="tab"
                aria-selected={activeDay === day.id}
                onClick={() => setActiveDay(day.id)}
              >
                {day.label}
              </button>
            ))}
          </div>

          <div className="filter-tabs" role="group" aria-label="Filter events by category">
            {FILTERS.map((filter) => (
              <button
                className={activeFilter === filter ? 'filter-tab active' : 'filter-tab'}
                key={filter}
                type="button"
                aria-pressed={activeFilter === filter}
                onClick={() => setActiveFilter(filter)}
              >
                {filter}
              </button>
            ))}
          </div>

          <label className="event-search">
            <span>Search events</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by event, category, or venue"
            />
          </label>

          <aside className="night-show" aria-label={`Day ${activeDay} night show`}>
            <span className="night-show-label">NIGHT SHOW · DAY {activeDay}</span>
            <strong>{nightShows[activeDay]}</strong>
            <span className="night-show-mark" aria-hidden="true">✦</span>
          </aside>

          {visibleEvents.length === 0 ? (
            <p className="no-events">No events match your search for this day.</p>
          ) : (
          <div className="event-grid">
            {visibleEvents.map((event, index) => {
              const remaining = savedState.seats[event.id] ?? event.seatsLeft
              return (
                <article
                  className={`event-card category-${event.category}`}
                  key={event.id}
                  style={{ '--card-index': EVENTS.indexOf(event) + index }}
                >
                  <div className="card-strip"></div>
                  <div className="event-visual">
                    <span className="visual-code">{event.categoryLabel.toUpperCase()}</span>
                    <span className="visual-icon" aria-hidden="true">{event.icon}</span>
                    <span className="visual-mark" aria-hidden="true">✳</span>
                  </div>
                  <div className="event-card-content">
                    <div className="event-card-topline">
                      <span className="category-tag">
                        <span>{String(EVENTS.indexOf(event) + 1).padStart(2, '0')}</span>
                        {event.categoryLabel}
                      </span>
                    </div>
                    <h3>{event.title}</h3>
                    <p className="event-description">{event.description}</p>
                    <div className="event-meta">
                      <span>{event.date}</span>
                      <span>{event.venue}</span>
                    </div>
                    <div className="event-card-bottom">
                      <span className={`seats ${remaining === 0 ? 'full' : remaining < 5 ? 'low' : ''}`}>
                        {remaining === 0 ? 'Full' : `${remaining} seats left`}
                      </span>
                      <button
                        className="register-button"
                        type="button"
                        disabled={remaining === 0}
                        onClick={() => openRegistration(event)}
                      >
                        {remaining === 0 ? 'Full' : 'Register'} <span aria-hidden="true">↗</span>
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
          )}
        </section>

        <VenueMap />

        <section className="page-section stats-page" id="seat-stats">
          <div className="page-heading">
            <span className="section-label">LIVE FEST CAPACITY</span>
            <h1>Seat Stats</h1>
            <p>Event seats remaining across the three festival days.</p>
          </div>
          <div className="stats-overall">
            <span>ALL EVENT SEATS LEFT</span>
            <strong>{totalSeats}</strong>
            <span>of {EVENTS.reduce((total, event) => total + event.seatsLeft, 0)} seats</span>
          </div>
          <div className="seat-stats-grid">
            {daySeatStats.map(({ day, seatsRemaining, seatsFilled, capacity }) => {
              const filledPercent = capacity ? (seatsFilled / capacity) * 100 : 0
              return (
                <article className="seat-stat-card" key={day}>
                  <h2>Day {day}</h2>
                  <div
                    className="seat-pie"
                    role="img"
                    aria-label={`Day ${day}: ${seatsFilled} seats filled and ${seatsRemaining} seats remaining out of ${capacity}`}
                    style={{ '--filled-percent': `${filledPercent}%` }}
                  >
                    <div className="seat-pie-center">
                      <strong>{seatsRemaining}</strong>
                      <span>LEFT</span>
                    </div>
                  </div>
                  <div className="seat-stat-totals">
                    <span><strong>{seatsFilled}</strong> filled</span>
                    <span><strong>{seatsRemaining}</strong> remaining</span>
                  </div>
                  <div className="seat-legend">
                    <span><i className="legend-filled"></i>Seats filled</span>
                    <span><i className="legend-remaining"></i>Seats remaining</span>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      </main>

      <footer id="about">
        <a className="brand" href="#home">
          <span className="brand-icon">✳</span>
          <span className="brand-name">SRISHTI 2K&apos;26</span>
        </a>
        <p>Made for campus life. Built for memories.</p>
        <span className="footer-note">SHOW UP. FIND YOUR PEOPLE.</span>
      </footer>

      {selectedEvent && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedEvent(null)
          }}
        >
          <section
            className="registration-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <button
              className="modal-close"
              type="button"
              aria-label="Close registration form"
              onClick={() => setSelectedEvent(null)}
            >
              ×
            </button>
            <span className="section-label">SAVE YOUR SPOT</span>
            <h2 id="modal-title">You’re almost there.</h2>
            <p className="modal-event-name">{currentEvent.title}</p>
            {formMessage.startsWith("You're on the list") ? (
              <div className="form-success" role="status">{formMessage}</div>
            ) : (
              <form className="registration-form" onSubmit={handleRegistration}>
                <label>
                  Your name
                  <input name="name" autoComplete="name" required minLength="2" />
                </label>
                <label>
                  Email address
                  <input name="email" type="email" autoComplete="email" required />
                </label>
                {formMessage && <p className="form-error" role="alert">{formMessage}</p>}
                <button className="form-submit" type="submit">Confirm registration <span>↗</span></button>
              </form>
            )}
            <p className="modal-footnote">{currentEvent.date} · {currentEvent.venue}</p>
          </section>
        </div>
      )}
    </div>
  )
}

export default App
