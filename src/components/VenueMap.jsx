import { useEffect, useMemo } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { events } from '../data/events'
import { specialPrograms } from '../data/specialPrograms'
import { COLLEGE_CENTRE, venues } from '../data/venues'
import 'leaflet/dist/leaflet.css'

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

const nightShowTitles = {
  1: 'DJ Night',
  2: 'Arijit Singh Concert',
  3: 'Vineeth Sreenivasan Concert',
}

function MapInteractionControls() {
  const map = useMap()

  useEffect(() => {
    const container = map.getContainer()
    let previousTouchCentre = null

    const enableWheelZoom = () => map.scrollWheelZoom.enable()
    const handleTouchStart = (event) => {
      if (event.touches.length > 1) {
        previousTouchCentre = getTouchCentre(event.touches)
      }
    }
    const handleTouchMove = (event) => {
      if (event.touches.length < 2) {
        previousTouchCentre = null
        return
      }

      event.preventDefault()
      const touchCentre = getTouchCentre(event.touches)
      if (previousTouchCentre) {
        map.panBy(
          [previousTouchCentre.x - touchCentre.x, previousTouchCentre.y - touchCentre.y],
          { animate: false },
        )
      }
      previousTouchCentre = touchCentre
    }
    const handleTouchEnd = (event) => {
      if (event.touches.length < 2) previousTouchCentre = null
    }

    map.dragging.disable()
    map.touchZoom.disable()
    container.addEventListener('click', enableWheelZoom)
    container.addEventListener('touchstart', handleTouchStart, { passive: true })
    container.addEventListener('touchmove', handleTouchMove, { passive: false })
    container.addEventListener('touchend', handleTouchEnd, { passive: true })
    container.addEventListener('touchcancel', handleTouchEnd, { passive: true })

    return () => {
      container.removeEventListener('click', enableWheelZoom)
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
      container.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, [map])

  return null
}

function getTouchCentre(touches) {
  return {
    x: (touches[0].clientX + touches[1].clientX) / 2,
    y: (touches[0].clientY + touches[1].clientY) / 2,
  }
}

function VenueMap() {
  const venueContents = useMemo(
    () =>
      venues.map((venue) => ({
        ...venue,
        events: events.filter((event) => event.venue === venue.name),
        programs: specialPrograms.filter((program) => program.venue === venue.name),
      })),
    [],
  )

  return (
    <section className="page-section map-page" id="venue-map">
      <div className="page-heading">
        <span className="section-label">FIND YOUR WAY AROUND CET</span>
        <h1>Venue Map</h1>
        <p>Explore event locations across the College of Engineering Trivandrum campus.</p>
      </div>
      <div className="venue-map" aria-label="Interactive map of CET event venues">
        <MapContainer center={COLLEGE_CENTRE} zoom={16} scrollWheelZoom={false} dragging={false}>
          <MapInteractionControls />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={COLLEGE_CENTRE}>
            <Popup>
              <strong>College of Engineering Trivandrum (CET)</strong>
              <br />
              Sreekaryam
            </Popup>
          </Marker>
          {venueContents.map((venue) => (
            <Marker key={venue.name} position={venue.position}>
              <Popup>
                <strong>{venue.name}</strong>
                {venue.events.map((event) => (
                  <p key={event.id}>
                    {event.title} · Day {event.day} · {event.time}
                  </p>
                ))}
                {venue.programs.map((program) => (
                  <p key={program.id}>
                    {nightShowTitles[program.day]} · Day {program.day} · {program.time}
                  </p>
                ))}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      <p className="map-note">Venue pin locations are illustrative and shown within the campus.</p>
    </section>
  )
}

export default VenueMap
