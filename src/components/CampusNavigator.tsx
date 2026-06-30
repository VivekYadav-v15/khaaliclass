"use client";

import { useState, useRef, useEffect } from 'react';
import 'leaflet/dist/leaflet.css';

export default function CampusNavigator() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const routeLayer = useRef<any>(null);
  const markerLayer = useRef<any>(null);
  const L = useRef<any>(null); // Store Leaflet instance
  
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null); // [lng, lat] for backend
  const [destination, setDestination] = useState<string>('');
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string>('');
  const [routeDistance, setRouteDistance] = useState<string>('');

  // Initialize Leaflet Map (Dynamic import to avoid Next.js SSR window errors)
  useEffect(() => {
    if (typeof window === 'undefined' || map.current || !mapContainer.current) return;

    import('leaflet').then((leaflet) => {
      L.current = leaflet;

      // Fix Leaflet's default icon path issues in Next.js
      delete (leaflet.Icon.Default.prototype as any)._getIconUrl;
      leaflet.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      // Init map
      map.current = leaflet.map(mapContainer.current!, {
        zoomControl: false // Optional: hide default zoom controls for cleaner look
      }).setView([28.6096, 77.0396], 15.5);

      // Add free Dark Mode tiles (CartoDB Dark Matter)
      leaflet.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://carto.com/">CartoDB</a>',
        maxZoom: 19
      }).addTo(map.current);
    });
  }, []);

  const handleGetLocation = () => {
    setIsLocating(true);
    setLocationError('');
    setRouteDistance(''); 

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported.');
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lng = position.coords.longitude;
        const lat = position.coords.latitude;
        
        setUserLocation([lng, lat]);
        setIsLocating(false);

        if (map.current && L.current) {
          // Leaflet flies to [lat, lng]
          map.current.flyTo([lat, lng], 17);
          
          // Remove old marker if exists
          if (markerLayer.current) {
            map.current.removeLayer(markerLayer.current);
          }
          
          // Drop a new marker
          markerLayer.current = L.current.marker([lat, lng]).addTo(map.current);
        }
      },
      (error) => {
        setIsLocating(false);
        setLocationError('Failed to get location. Please allow access.');
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  const handleSearchRoute = async () => {
    if (!userLocation) {
      alert("Please set your starting location first.");
      return;
    }
    if (!destination) {
      alert("Please select a destination.");
      return;
    }

    try {
      const response = await fetch('/api/routing/shortest-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startCoords: userLocation,
          destinationId: destination
        })
      });

      if (!response.ok) throw new Error("Failed to find path");

      const routeGeoJSON = await response.json();

      if (routeGeoJSON.properties?.distance) {
        setRouteDistance(routeGeoJSON.properties.distance);
      }

      if (map.current && L.current) {
        // Clear previous route if it exists
        if (routeLayer.current) {
          map.current.removeLayer(routeLayer.current);
        }

        // Draw the new route using GeoJSON
        routeLayer.current = L.current.geoJSON(routeGeoJSON, {
          style: {
            color: '#10b981', // Tailwind emerald-500
            weight: 5,
            opacity: 0.8
          }
        }).addTo(map.current);
        
        // Fit the map view to show the entire route
        map.current.fitBounds(routeLayer.current.getBounds(), { padding: [50, 50] });
      }
    } catch (err) {
      console.error("Failed to fetch route:", err);
      alert("Could not calculate route. Ensure backend is running.");
    }
  };

  return (
    <div className="relative w-full h-full min-h-[600px] flex flex-col items-center">
      {/* Floating UI Panel */}
      <div className="absolute top-6 z-[1000] w-11/12 max-w-md bg-zinc-900/90 backdrop-blur-md p-4 rounded-xl shadow-2xl border border-zinc-700">
        <div className="space-y-4">
          
          {/* Start Point Input */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Starting Point</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                readOnly 
                value={userLocation ? `${userLocation[0].toFixed(4)}, ${userLocation[1].toFixed(4)}` : ''}
                placeholder="Click the GPS button..."
                className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 border border-zinc-600 focus:outline-none"
              />
              <button 
                onClick={handleGetLocation}
                disabled={isLocating}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors font-semibold shadow-md whitespace-nowrap"
              >
                {isLocating ? 'Locating...' : 'Get GPS'}
              </button>
            </div>
            {locationError && <p className="text-red-400 text-xs mt-1">{locationError}</p>}
          </div>

          {/* Destination Selection */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Destination</label>
            <select 
              className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 border border-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            >
              <option value="">Select a campus landmark...</option>
              <option value="node_gate1">Main Gate 1</option>
              <option value="node_admin">Admin Block</option>
              <option value="node_canteen">Shopping Complex</option>
              <option value="node_bh1">Boys Hostel 1</option>
            </select>
          </div>

          <button 
            onClick={handleSearchRoute}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 rounded-lg transition-colors"
          >
            Find Shortest Path
          </button>

          {/* Distance Display */}
          {routeDistance && (
            <div className="mt-2 p-3 bg-zinc-800 rounded-lg border border-zinc-600 text-center">
              <span className="text-zinc-300 text-sm">Estimated Distance: </span>
              <span className="text-emerald-400 font-bold">{routeDistance}</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Map Container - Leaflet needs z-index lower than the UI panel */}
      <div ref={mapContainer} className="w-full h-full z-0 rounded-lg" />
    </div>
  );
}