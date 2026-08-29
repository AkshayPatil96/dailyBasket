'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Default Leaflet marker images don't resolve correctly through bundlers — point at the CDN
// instead of wiring up webpack asset copying for three small icon files.
const markerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// India centroid — used before the user has searched a city or dropped a pin.
const DEFAULT_CENTER: [number, number] = [22.9734, 78.6569];
const DEFAULT_ZOOM = 5;
const PICKED_ZOOM = 15;

function RecenterOnChange({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, PICKED_ZOOM);
  }, [center, map]);
  return null;
}

function DraggableMarker({
  position,
  onChange,
}: {
  position: [number, number];
  onChange: (lat: number, lng: number) => void;
}) {
  const markerRef = useRef<L.Marker>(null);

  useMapEvents({
    click(event) {
      onChange(event.latlng.lat, event.latlng.lng);
    },
  });

  return (
    <Marker
      draggable
      position={position}
      icon={markerIcon}
      ref={markerRef}
      eventHandlers={{
        dragend: () => {
          const marker = markerRef.current;
          if (!marker) return;
          const { lat, lng } = marker.getLatLng();
          onChange(lat, lng);
        },
      }}
    />
  );
}

export function AddressMapPicker({
  latitude,
  longitude,
  onChange,
}: {
  latitude?: number;
  longitude?: number;
  onChange: (lat: number, lng: number) => void;
}) {
  const hasPin = latitude !== undefined && longitude !== undefined;
  const center: [number, number] = hasPin ? [latitude, longitude] : DEFAULT_CENTER;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-(--color-foreground)">Pin location</span>
      <div className="h-64 w-full overflow-hidden rounded-(--radius-inner) border border-(--color-border)">
        <MapContainer
          center={center}
          zoom={hasPin ? PICKED_ZOOM : DEFAULT_ZOOM}
          className="h-full w-full"
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {hasPin ? (
            <>
              <DraggableMarker position={center} onChange={onChange} />
              <RecenterOnChange center={center} />
            </>
          ) : null}
        </MapContainer>
      </div>
      <p className="text-xs text-(--color-muted-foreground)">
        Drag the pin (or tap the map) to your exact address for accurate delivery.
      </p>
    </div>
  );
}
