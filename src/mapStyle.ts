/**
 * The basemap, restyled to match the instrument panel.
 *
 * Two reasons this exists beyond taste. First, a dark panel floating over
 * Google's default near-white basemap reads as unfinished — the chrome looks
 * pasted on rather than part of the app. Second, and the one that actually
 * matters: Guzzler's pins carry price and verdict color, and the default
 * basemap is covered in Google's own POI markers competing for the same
 * attention. Turning those off leaves the stations as the only things on the
 * map worth looking at.
 *
 * Google Maps style JSON, applied via `customMapStyle`. It works on Android
 * and on iOS only because we run PROVIDER_GOOGLE there too — Apple Maps
 * ignores it entirely. Ordering matters: later rules win, so the road and
 * label rules come after the blanket geometry rules they refine.
 */
export const darkMapStyle = [
  // Asphalt at dusk, one shade off the panel so the map still reads as ground
  // rather than as more chrome.
  { elementType: 'geometry', stylers: [{ color: '#1B2027' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8B95A3' }] },
  // Halo behind label text, dark enough that thin type stays legible at speed.
  { elementType: 'labels.text.stroke', stylers: [{ color: '#12161B' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },

  // Google's own POIs are off. Ours are the point.
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },

  // Parks stay, faintly — they are the landmarks people orient by.
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1E2A24' }] },

  // Roads climb in brightness with importance, so the highway you are on is
  // the brightest line under the pins.
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#262E38' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1B2027' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#7C8595' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#303945' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3C4756' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#232A33' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#A9B3C1' }] },

  // Water reads clearly darker than land — the one place on the map you can
  // never drive, so it should never be mistaken for road.
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0E1319' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3E4A59' }] },

  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#2E3641' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
];
