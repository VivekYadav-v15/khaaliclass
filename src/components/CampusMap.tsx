"use client";

import { updateRoomStatus } from "@/actions/roomActions";
import { useSession } from "next-auth/react";
import { applyForCR } from "@/actions/userActions";
import Link from "next/link";
import nsutBoundary from '@/data/nsutBoundary.json';
import { useEffect, useState, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, GeoJSON, useMapEvents } from 'react-leaflet';
import UserMenu from "@/components/UserMenu";

// Helper function to calculate distance between two coordinates in meters
function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // Earth's radius in meters
  const toRadians = (deg: number) => (deg * Math.PI) / 180;
  
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; 
}

// 🧭 The standalone Zoom Tracker (MUST BE OUTSIDE CampusMap!)
function MapZoomTracker({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  useMapEvents({
    zoom: (e) => onZoomChange(e.target.getZoom()),
    zoomend: (e) => onZoomChange(e.target.getZoom()),
  });
  return null;
}

export default function CampusMap({ onSelectBlock }: { onSelectBlock: (block: string) => void }) {
// ... rest of your code ...

  
    // Temporary state to hold live room statuses
  const [roomStatuses, setRoomStatuses] = useState<Record<number, "AVAILABLE" | "OCCUPIED">>({
    101: "AVAILABLE",
    102: "OCCUPIED",
    103: "AVAILABLE",
    104: "OCCUPIED",
    105: "AVAILABLE",
  });
  const [isMounted, setIsMounted] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false); 
    // 💾 Check local storage when the map first loads to remember dark mode
  useEffect(() => {
    const savedTheme = localStorage.getItem('khaaliclass-theme');
    if (savedTheme !== null) {
      setIsDarkMode(savedTheme === 'dark');
    }
  }, []);

  const { data: session, update } = useSession();
  const [hasApplied, setHasApplied] = useState(false);
    const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  // Auto-hide the login prompt after 4 seconds
  useEffect(() => {
    if (showLoginPrompt) {
      const timer = setTimeout(() => setShowLoginPrompt(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [showLoginPrompt]);

    // 🧹 NEW: Clear the 'hasApplied' memory if their role actually changes to CR/ADMIN
  useEffect(() => {
    if (session && ((session.user as any)?.role === 'CR' || (session.user as any)?.role === 'ADMIN')) {
      setHasApplied(false);
    }
  }, [session]);

  const hasCRPowers = session && ((session.user as any)?.role === 'CR' || (session.user as any)?.role === 'ADMIN');

  const [hoveredBuilding, setHoveredBuilding] = useState<any | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [selectedBuilding, setSelectedBuilding] = useState<any | null>(null);

    // Add this right below your other state variables (around line 25)
  const [fishyRoom, setFishyRoom] = useState<any>(null);
    // 1. Add this state near your other states
  const [currentZoom, setCurrentZoom] = useState(17.5);
    

  // --- ROUTING STATE & REFS ---
  const mapRef = useRef<any>(null);
  
  // startPoint can now be 'gps' OR the name of a building
  const [startPoint, setStartPoint] = useState<string>(''); 
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [destination, setDestination] = useState<string>('');
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [routeDistance, setRouteDistance] = useState<string>('');
  const [routeGeoJSON, setRouteGeoJSON] = useState<any>(null);

    // --- NEW: DATABASE & FILTER STATE ---
  const [dbRooms, setDbRooms] = useState<any[]>([]);
  const [selectedFloor, setSelectedFloor] = useState('First');
  const [selectedStatus, setSelectedStatus] = useState('AVAILABLE');
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);

      // --- 🌐 FETCH ALL ROOMS GLOBALLY ON LOAD & AUTO-REFRESH ---
  useEffect(() => {
    const fetchRooms = async () => {
      setIsLoadingRooms(true);
      try {
        const res = await fetch(`/api/rooms`, { cache: 'no-store' });
        const json = await res.json();
        const roomsArray = Array.isArray(json) ? json : (json.data || []);
        setDbRooms(roomsArray);
      } catch (error) {
        console.error("Failed to fetch rooms:", error);
      }
      setIsLoadingRooms(false);
    };

    fetchRooms(); // Run immediately on load

    const MapZoomTracker = () => {
    useMapEvents({
      zoomend: (e) => {
        setCurrentZoom(e.target.getZoom());
      },
    });
    return null;
  };
    // 🔄 Keep the map perfectly in sync every 10 seconds!
    const interval = setInterval(fetchRooms, 10000);
    return () => clearInterval(interval);
  }, []); // <-- Empty array means it runs on mount!
    // --- SILENT BACKGROUND ROLE SYNC ---
  useEffect(() => {
    // Don't run if they aren't logged in
    if (!session?.user?.email) return;

    const checkRole = async () => {
      try {
        const res = await fetch('/api/auth/role', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          const currentCookieRole = (session.user as any).role;
          
          // If the DB role is different from the Cookie role...
          if (data.role && data.role !== currentCookieRole) {
            console.log(`Role change detected! Syncing from ${currentCookieRole} to ${data.role}`);
            
            // Instantly rewrite their cookie and update the UI without logging out!
            await update({ role: data.role });
          }
        }
      } catch (error) {
        console.error("Background role sync failed", error);
      }
    };

    // Check the DB every 15 seconds in the background
    const roleInterval = setInterval(checkRole, 15000);
    return () => clearInterval(roleInterval);
  }, [session, update]); 

        // --- INSTANT LOCAL FILTERING (Bulletproof + APJ Floor Fix) ---
  const displayRooms = dbRooms.filter((room) => 
    selectedBuilding && 
    (room.building === selectedBuilding.name || room.name.includes(selectedBuilding.name)) && 
    (selectedBuilding.name === 'APJ' || room.floor === selectedFloor) && // 🛡️ APJ ignores the floor state!
    room.status === selectedStatus
  );

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return <div className="fixed inset-0 bg-zinc-900 animate-pulse flex items-center justify-center text-zinc-500 z-0">Loading NSUT Map...</div>;
  }
  
  const { MapContainer, TileLayer, Polygon, Tooltip, GeoJSON, CircleMarker } = require('react-leaflet');
  
     // Snug boundaries to perfectly frame the NSUT campus without floating into the void
  const campusBounds: L.LatLngBoundsExpression = [
    [28.6020, 77.0300], // South-West Corner (Bottom Left)
    [28.6170, 77.0450]  // North-East Corner (Top Right)
  ];

  const activeBuildings = [
    {
      name: 'Admin Block',
      color: '#64748b', 
      image: 'https://images.unsplash.com/photo-1572061483861-1c4b72c5be3e?q=80&w=1000&auto=format&fit=crop', 
      availableRooms: 0, 
      totalRooms: 0,
      isAdministrative: true,
      facilities: [
        { name: 'Main Auditorium', image: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=500&auto=format&fit=crop' },
        { name: 'DSW Office', image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=500&auto=format&fit=crop' },
        { name: 'SBI Branch', image: 'https://images.unsplash.com/photo-1601597111158-2fceff292cdc?q=80&w=500&auto=format&fit=crop' }
      ],
      coords: [
        [28.6100114, 77.0367979], [28.6100148, 77.0368014], [28.6100277, 77.0368535],
        [28.6100475, 77.0369399], [28.6100625, 77.0370089], [28.61006, 77.0370134],
        [28.6100133, 77.0370311], [28.6100115, 77.0370361], [28.6100209, 77.0370699],
        [28.6100181, 77.0370755], [28.6099589, 77.0371003], [28.6099567, 77.037101],
        [28.6099596, 77.0371012], [28.6099622, 77.037102], [28.6099698, 77.0371047],
        [28.6099732, 77.0371067], [28.6099756, 77.037109], [28.6099784, 77.0371175],
        [28.6099784, 77.0371288], [28.6099779, 77.0371317], [28.6099728, 77.0371379],
        [28.6099693, 77.0371399], [28.609907, 77.0371465], [28.6099034, 77.0371432],
        [28.6099027, 77.0371387], [28.6098993, 77.0371363], [28.609897, 77.0371368],
        [28.6098955, 77.0371394], [28.6098963, 77.0371451], [28.6098939, 77.0371507],
        [28.609883, 77.0371544], [28.6098725, 77.0371579], [28.6098589, 77.0371622],
        [28.6098472, 77.0371662], [28.6098341, 77.0371705], [28.6098239, 77.0371741],
        [28.6098181, 77.0371756], [28.6098136, 77.0371731], [28.609812, 77.0371671],
        [28.6098083, 77.0371652], [28.6098062, 77.0371666], [28.6098036, 77.0371708],
        [28.6098047, 77.0371774], [28.6098029, 77.0371812], [28.6097937, 77.0371872],
        [28.6097889, 77.0371904], [28.6097771, 77.037198], [28.6097694, 77.037203],
        [28.6097614, 77.0372043], [28.6097539, 77.0372043], [28.6097506, 77.0372022],
        [28.6097458, 77.0371968], [28.6097415, 77.0371874], [28.6097416, 77.037183],
        [28.6097426, 77.0371799], [28.6097446, 77.0371671], [28.6097434, 77.0371659],
        [28.6097247, 77.0371719], [28.6096889, 77.0371839], [28.609684, 77.0371813],
        [28.6096749, 77.037144], [28.6096699, 77.0371405], [28.6096216, 77.0371554],
        [28.6096168, 77.0371517], [28.6096112, 77.0371299], [28.609598, 77.0370721],
        [28.6095733, 77.036976], [28.6095647, 77.0369429], [28.6095665, 77.0369381],
        [28.6096307, 77.0368973], [28.6096616, 77.0368794], [28.6096966, 77.0368639],
        [28.6097439, 77.0368457], [28.6097926, 77.0368288], [28.6098286, 77.0368187],
        [28.6098904, 77.036803], [28.6099514, 77.0367962], [28.6099855, 77.0367962]
      ]
    },
    {
      name: 'Canteen(SC)',
      color: '#f59e0b', 
      image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=1000&auto=format&fit=crop', 
      availableRooms: 0, 
      totalRooms: 0,
      isAdministrative: false,
      facilities: [
        { name: 'Food Court', image: 'https://images.unsplash.com/photo-1626777552726-4122e51e907c?q=80&w=500&auto=format&fit=crop' },
        { name: 'Seating Area', image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=500&auto=format&fit=crop' }
      ],
      coords: [
        [28.6116573, 77.0367341], [28.6115442, 77.0367703], [28.6116302, 77.0371133],
        [28.6117635, 77.0370698], [28.611746, 77.0369936], [28.6117247, 77.0369984],
        [28.6116573, 77.0367341] 
      ]
    },
    {
      name: 'Smart Block',
      color: '#a67c52', 
      image: 'https://images.unsplash.com/photo-1541123437800-1bb1317bc20f?q=80&w=1000&auto=format&fit=crop', 
      availableRooms: 0, 
      totalRooms: 0,
      isAdministrative: false,
      facilities: [
        { name: 'Smart Classroom', image: 'https://images.unsplash.com/photo-1571260899304-42507011ecdf?q=80&w=500&auto=format&fit=crop' }
      ],
      coords: [
        [28.6121344, 77.037488], [28.6121389, 77.0374908], [28.6122083, 77.0377682],
        [28.6122065, 77.0377738], [28.6119077, 77.0378711], [28.6119032, 77.0378682],
        [28.611833, 77.0375914], [28.6118357, 77.0375859], [28.6121344, 77.037488] 
      ]
    },
    {
      name: 'Shopping Complex',
      color: '#10b981', 
      image: 'https://images.unsplash.com/photo-1519999482648-25049ddd37b1?q=80&w=1000&auto=format&fit=crop', 
      availableRooms: 0, 
      totalRooms: 0,
      isAdministrative: false,
      facilities: [
        { name: 'Stationery & Print Shop', image: 'https://images.unsplash.com/photo-1588666309990-d68f08e3d4a6?q=80&w=500&auto=format&fit=crop' },
        { name: 'Convenience Store', image: 'https://images.unsplash.com/photo-1601598851547-4302969d0614?q=80&w=500&auto=format&fit=crop' }
      ],
      coords: [
        [28.6123228, 77.0373447], [28.6123274, 77.0373491], [28.6123242, 77.0374014],
        [28.6123264, 77.0374421], [28.6123303, 77.0374763], [28.6123353, 77.0375042],
        [28.6123417, 77.0375361], [28.612352, 77.0375658], [28.6123638, 77.037592],
        [28.6123801, 77.0376237], [28.6124118, 77.0376673], [28.6124111, 77.0376735],
        [28.6123652, 77.0377127], [28.6123602, 77.0377119], [28.6123357, 77.0376817],
        [28.6123206, 77.0376583], [28.6123035, 77.0376254], [28.6122871, 77.0375846],
        [28.6122732, 77.0375411], [28.6122648, 77.0375022], [28.6122605, 77.0374569],
        [28.6122578, 77.0374048], [28.6122592, 77.0373457], [28.6122629, 77.0373417],
        [28.6123228, 77.0373447]
      ]
    },
    {
      name: 'Medical Centre',
      color: '#ef4444', 
      image: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?q=80&w=1000&auto=format&fit=crop', 
      availableRooms: 0, 
      totalRooms: 0,
      isAdministrative: false,
      facilities: [
        { name: 'First Aid & Emergency', image: 'https://images.unsplash.com/photo-1583324113626-70df0f4deaab?q=80&w=500&auto=format&fit=crop' },
        { name: 'Dispensary', image: 'https://images.unsplash.com/photo-1585435557343-3b092031a831?q=80&w=500&auto=format&fit=crop' }
      ],
      coords: [
        [28.6117749, 77.0385258], [28.6117785, 77.0385303], [28.6117796, 77.038672],
        [28.6117757, 77.0386762], [28.6116218, 77.0386791], [28.6116186, 77.0386747],
        [28.6116175, 77.0385314], [28.611621, 77.0385274], [28.6117749, 77.0385258]
      ]
    },
    {
      name: 'Training and Placements Cell',
      color: '#4338ca', 
      image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1000&auto=format&fit=crop', 
      availableRooms: 0, 
      totalRooms: 0,
      isAdministrative: true,
      facilities: [
        { name: 'Interview Cabins', image: 'https://images.unsplash.com/photo-1600508774634-4e11d34730e2?q=80&w=500&auto=format&fit=crop' },
        { name: 'Conference Room', image: 'https://images.unsplash.com/photo-1517502884422-41eaead166d4?q=80&w=500&auto=format&fit=crop' }
      ],
      coords: [
        [28.6086323, 77.0394356], [28.6086373, 77.0394383], [28.6086502, 77.0394894],
        [28.608655, 77.0394918], [28.6086737, 77.0394852], [28.6086786, 77.0394877],
        [28.6087035, 77.0395859], [28.608701, 77.0395914], [28.6086798, 77.0395984],
        [28.6086775, 77.0396038], [28.6086914, 77.0396592], [28.6086889, 77.0396651],
        [28.6085985, 77.0396961], [28.6085937, 77.039693], [28.6085856, 77.03966],
        [28.6085806, 77.0396572], [28.6085257, 77.0396763], [28.6085231, 77.0396814],
        [28.608531, 77.0397135], [28.6085288, 77.0397186], [28.6084335, 77.0397495],
        [28.6084288, 77.0397466], [28.6083723, 77.0395284], [28.6083747, 77.0395228],
        [28.6084699, 77.0394909], [28.6084747, 77.0394933], [28.6084805, 77.0395199],
        [28.6084854, 77.0395229], [28.6085415, 77.0395057], [28.608544, 77.0395002],
        [28.6085372, 77.0394716], [28.6085397, 77.0394663], [28.6086323, 77.0394356]
      ]
    },
    {
      name: 'Hostel: Endgame',
      color: '#8b5cf6', 
      image: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?q=80&w=1000&auto=format&fit=crop', 
      availableRooms: 0, 
      totalRooms: 0,
      isAdministrative: false,
      facilities: [
        { name: 'Hostel Mess', image: 'https://images.unsplash.com/photo-1577563908411-5077b6dc7624?q=80&w=500&auto=format&fit=crop' },
        { name: 'Common Room', image: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?q=80&w=500&auto=format&fit=crop' },
        { name: 'Recreation Area', image: 'https://images.unsplash.com/photo-1511882150382-421056c89033?q=80&w=500&auto=format&fit=crop' }
      ],
      coords: [
        [
          [28.6128408, 77.0354304], [28.6128456, 77.0354334], [28.6129439, 77.0358072],
          [28.6129226, 77.0358176], [28.6129407, 77.0358844], [28.6129527, 77.0358844],
          [28.612965, 77.0359312], [28.6129547, 77.035938], [28.6129751, 77.0360137],
          [28.6129916, 77.0360123], [28.613007, 77.036073], [28.6129568, 77.036091],
          [28.612953, 77.0360807], [28.612822, 77.0361245], [28.6128217, 77.0361341],
          [28.6127535, 77.0361563], [28.6127489, 77.036146], [28.612689, 77.0361644],
          [28.6126841, 77.0361618], [28.6126652, 77.0360864], [28.6126673, 77.0360816],
          [28.6126739, 77.0360791], [28.6126765, 77.0360736], [28.6126691, 77.0360447],
          [28.6126658, 77.0360413], [28.6126605, 77.0360429], [28.6126569, 77.0360401],
          [28.6126378, 77.0359675], [28.6126404, 77.0359621], [28.61265, 77.0359578],
          [28.6126389, 77.035905], [28.612598, 77.0358811], [28.6125498, 77.035899],
          [28.6125506, 77.035911], [28.6124903, 77.035928], [28.6124843, 77.0359134],
          [28.6124412, 77.0359264], [28.6124427, 77.0359435], [28.612415, 77.0359512],
          [28.6124105, 77.0359388], [28.6123716, 77.0359515], [28.6123412, 77.0358327],
          [28.6123511, 77.0358274], [28.6123097, 77.0356665], [28.6122956, 77.0356667],
          [28.6122848, 77.0356151], [28.6123571, 77.0355891], [28.6123646, 77.0356015],
          [28.6123977, 77.0355923], [28.612397, 77.035574], [28.6124658, 77.035548],
          [28.6124718, 77.0355614], [28.6125113, 77.0355518], [28.6125096, 77.0355327],
          [28.6125454, 77.0355223], [28.6125509, 77.0355292], [28.6127212, 77.035472],
          [28.6128408, 77.0354304]
        ],
        [
          [28.6125377, 77.0356538], [28.6125704, 77.035784], [28.6124081, 77.0358352],
          [28.6123777, 77.0357071], [28.6125377, 77.0356538]
        ],
        [
          [28.6125918, 77.0356392], [28.6126616, 77.0356274], [28.6126645, 77.0356379],
          [28.6127191, 77.035647], [28.6127665, 77.0356776], [28.6127939, 77.0357169],
          [28.6128056, 77.0357135], [28.6128263, 77.0357764], [28.612673, 77.0358309],
          [28.612632, 77.0358047], [28.6125918, 77.0356392]
        ],
        [
          [28.6128425, 77.0358417], [28.6128888, 77.0360248], [28.6127683, 77.0360629],
          [28.6127258, 77.0358833], [28.6128425, 77.0358417]
        ]
      ]
    },
    {
      name: 'Hostel: Civil War',
      color: '#9f1239', 
      image: 'https://images.unsplash.com/photo-1520277739336-7bf67edfa768?q=80&w=1000&auto=format&fit=crop', 
      availableRooms: 0, 
      totalRooms: 0,
      isAdministrative: false,
      facilities: [
        { name: 'Common Room', image: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?q=80&w=500&auto=format&fit=crop' },
        { name: 'Sports Room', image: 'https://images.unsplash.com/photo-1518605368461-1ee7c5320746?q=80&w=500&auto=format&fit=crop' },
        { name: 'Reading Room', image: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?q=80&w=500&auto=format&fit=crop' }
      ],
      coords: [
        [
          [28.6125701, 77.0346656], [28.6125873, 77.0347273], [28.6125697, 77.0347362],
          [28.6125857, 77.0348118], [28.612602, 77.034807], [28.6126122, 77.0348572],
          [28.6125985, 77.0348637], [28.6126157, 77.0349352], [28.6126399, 77.0349269],
          [28.6127317, 77.0353103], [28.6124364, 77.0354053], [28.6124393, 77.035418],
          [28.6124003, 77.0354282], [28.6123946, 77.0354076], [28.6123549, 77.0354192],
          [28.6123596, 77.0354401], [28.6122884, 77.0354659], [28.6122829, 77.0354415],
          [28.6122448, 77.0354502], [28.6122482, 77.0354702], [28.6121688, 77.0354934],
          [28.6121578, 77.0354398], [28.6121731, 77.0354304], [28.6121337, 77.0352751],
          [28.6121128, 77.0352788], [28.61209, 77.0351582], [28.6121243, 77.0351469],
          [28.6121229, 77.0351263], [28.6121527, 77.0351139], [28.6121589, 77.0351318],
          [28.6121993, 77.0351188], [28.6121995, 77.0351002], [28.6122567, 77.0350798],
          [28.6122624, 77.0350954], [28.6123135, 77.0350817], [28.6123344, 77.0350348],
          [28.6123227, 77.0349826], [28.6123043, 77.0349831], [28.6122851, 77.0349105],
          [28.6122955, 77.0349044], [28.612288, 77.0348675], [28.6122739, 77.0348711],
          [28.6122519, 77.0347895], [28.6123122, 77.0347662], [28.6123134, 77.0347514],
          [28.6123788, 77.0347308], [28.6123852, 77.0347433], [28.6125146, 77.0346987],
          [28.6125141, 77.0346851], [28.6125701, 77.0346656] 
        ],
        [
          [28.6124892, 77.0347805], [28.6125341, 77.0349638], [28.6124149, 77.0350017],
          [28.6123698, 77.0348175], [28.6124892, 77.0347805] 
        ],
        [
          [28.6125513, 77.035028], [28.6125665, 77.0350958], [28.6125527, 77.0350978],
          [28.6125535, 77.035121], [28.6125455, 77.0351569], [28.612531, 77.0351917],
          [28.6125124, 77.0352164], [28.6124815, 77.0352417], [28.6124858, 77.0352568],
          [28.6124232, 77.0352883], [28.6123766, 77.0351249], [28.6123985, 77.0350757],
          [28.6125513, 77.035028] 
        ],
        [
          [28.6123357, 77.0351816], [28.61237, 77.03531], [28.6122091, 77.0353611],
          [28.612175, 77.0352296], [28.6123357, 77.0351816] 
        ]
      ]
    },
    {
      name: 'Hostel: 1st Year',
      color: '#06b6d4', 
      image: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?q=80&w=1000&auto=format&fit=crop', 
      availableRooms: 0, 
      totalRooms: 0,
      isAdministrative: false,
      facilities: [
        { name: 'Fresher Mess', image: 'https://images.unsplash.com/photo-1577563908411-5077b6dc7624?q=80&w=500&auto=format&fit=crop' },
        { name: 'Common Room', image: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?q=80&w=500&auto=format&fit=crop' },
        { name: 'Table Tennis Area', image: 'https://images.unsplash.com/photo-1534158914592-062992fbe900?q=80&w=500&auto=format&fit=crop' }
      ],
      coords: [
        [
          [28.6128083, 77.0350957], [28.6131017, 77.0349935], [28.613104, 77.0350112],
          [28.6131408, 77.0349964], [28.6131382, 77.0349768], [28.6131765, 77.0349626],
          [28.613183, 77.0349821], [28.6132543, 77.0349573], [28.6132527, 77.0349324],
          [28.6132864, 77.0349189], [28.6132936, 77.0349404], [28.6133669, 77.0349133],
          [28.6133553, 77.0348588], [28.6133396, 77.0348602], [28.613299, 77.0347016],
          [28.6133122, 77.0346954], [28.6132811, 77.034576], [28.6132413, 77.0345876],
          [28.6132365, 77.0345724], [28.6132069, 77.0345803], [28.61321, 77.0346],
          [28.6131642, 77.0346102], [28.6131612, 77.0345936], [28.613102, 77.0346149],
          [28.6131047, 77.0346332], [28.6130518, 77.0346486], [28.6130125, 77.0346198],
          [28.6129937, 77.0345795], [28.6130128, 77.0345614], [28.6129963, 77.0344828],
          [28.6129799, 77.0344862], [28.6129746, 77.0344516], [28.61299, 77.0344388],
          [28.6129669, 77.034358], [28.6129068, 77.0343728], [28.612897, 77.0343562],
          [28.6128285, 77.034372], [28.6128319, 77.034403], [28.6127014, 77.0344412],
          [28.6126978, 77.03442], [28.6126406, 77.0344312], [28.6126596, 77.0345104],
          [28.6126777, 77.0345037], [28.6126976, 77.0345868], [28.6126804, 77.0345918],
          [28.6126945, 77.0346433], [28.6127162, 77.034637], [28.612733, 77.0347057],
          [28.6127052, 77.034718], [28.6128083, 77.0350957] 
        ],
        [
          [28.6127661, 77.034498], [28.6128868, 77.0344632], [28.6129276, 77.0346446],
          [28.6128092, 77.0346813], [28.6127661, 77.034498] 
        ],
        [
          [28.612977, 77.0346937], [28.6130203, 77.0347254], [28.6130548, 77.0348934],
          [28.6129856, 77.0349022], [28.6129832, 77.0348864], [28.6129431, 77.0348836],
          [28.6129117, 77.0348706], [28.612883, 77.0348492], [28.6128635, 77.034827],
          [28.6128553, 77.0348053], [28.6128427, 77.0348109], [28.6128251, 77.0347451],
          [28.612977, 77.0346937] 
        ],
        [
          [28.613081, 77.0347442], [28.6132416, 77.0346965], [28.6132731, 77.0348278],
          [28.613109, 77.0348743], [28.613081, 77.0347442] 
        ]
      ]
    },
    {
      name: 'Hostel: Age of Engineers',
      color: '#ea580c', 
      image: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?q=80&w=1000&auto=format&fit=crop', 
      availableRooms: 0, 
      totalRooms: 0,
      isAdministrative: false,
      facilities: [
        { name: 'Student Mess', image: 'https://images.unsplash.com/photo-1577563908411-5077b6dc7624?q=80&w=500&auto=format&fit=crop' },
        { name: 'Project Room', image: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?q=80&w=500&auto=format&fit=crop' },
        { name: 'Common Area', image: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?q=80&w=500&auto=format&fit=crop' }
      ],
      coords: [
        [
          [28.6129409, 77.0352708], [28.6132333, 77.0351846], [28.6132316, 77.0351712],
          [28.6132701, 77.0351585], [28.6132749, 77.0351759], [28.6133133, 77.0351667],
          [28.6133128, 77.035145], [28.6133848, 77.0351231], [28.613392, 77.0351428],
          [28.6134246, 77.0351324], [28.6134237, 77.0351141], [28.6134986, 77.03509],
          [28.6135135, 77.0351449], [28.613502, 77.0351516], [28.6135413, 77.0353117],
          [28.6135529, 77.0353129], [28.6135826, 77.0354276], [28.613546, 77.0354429],
          [28.6135465, 77.0354564], [28.6135202, 77.0354654], [28.6135138, 77.0354532],
          [28.6134701, 77.0354676], [28.6134727, 77.0354839], [28.6134153, 77.0355],
          [28.6134109, 77.0354876], [28.6133571, 77.035505], [28.6133355, 77.035549],
          [28.6133499, 77.0356029], [28.6133657, 77.0355966], [28.6133856, 77.035678],
          [28.6133757, 77.0356843], [28.6133839, 77.0357204], [28.6133978, 77.0357155],
          [28.6134075, 77.0357588], [28.6133774, 77.0357685], [28.6133872, 77.0358118],
          [28.6133574, 77.0358197], [28.6133572, 77.0358351], [28.6132917, 77.0358577],
          [28.6132861, 77.0358465], [28.6131565, 77.0358897], [28.6131603, 77.0359031],
          [28.6131058, 77.0359182], [28.6130891, 77.0358538], [28.613104, 77.0358469],
          [28.613086, 77.0357701], [28.6130703, 77.0357738], [28.6130601, 77.0357254],
          [28.6130737, 77.0357189], [28.613056, 77.0356505], [28.6130321, 77.0356541],
          [28.6129409, 77.0352708] 
        ],
        [
          [28.6132549, 77.0355844], [28.6133018, 77.0357656], [28.6131829, 77.0358047],
          [28.6131357, 77.0356252], [28.6132549, 77.0355844] 
        ],
        [
          [28.6131195, 77.0355564], [28.6132713, 77.0355137], [28.6132941, 77.0354583],
          [28.6132503, 77.0352975], [28.6131845, 77.0353287], [28.6131895, 77.0353443],
          [28.6131588, 77.0353679], [28.6131383, 77.0354004], [28.6131213, 77.0354379],
          [28.6131172, 77.0354664], [28.6131177, 77.0354885], [28.6131043, 77.0354924],
          [28.6131195, 77.0355564] 
        ],
        [
          [28.6133029, 77.0352778], [28.6133364, 77.0354066], [28.6134981, 77.0353507],
          [28.6134666, 77.0352214], [28.6133029, 77.0352778] 
        ]
      ]
    },
    {
      name: 'Block 5',
      color: '#f59e0b',
      image: 'https://images.unsplash.com/photo-1562774053-701939374585?q=80&w=1000&auto=format&fit=crop',
      availableRooms: 12,
      totalRooms: 15,
      coords: [
        [28.6099202, 77.0382859], [28.609932, 77.0383253], [28.6099414, 77.0383247],
        [28.6100031, 77.0385822], [28.6099964, 77.038588], [28.6100055, 77.0386295],
        [28.6099667, 77.0386438], [28.6099775, 77.0386881], [28.6100201, 77.0386785],
        [28.6100542, 77.038823], [28.6099448, 77.0388578], [28.6099365, 77.0388421],
        [28.6098617, 77.0389932], [28.6097503, 77.0389264], [28.6097774, 77.0388578],
        [28.6097676, 77.0388489], [28.6097279, 77.0389268], [28.6096995, 77.0389131],
        [28.609693, 77.0389208], [28.6095374, 77.0388269], [28.6095383, 77.0388195],
        [28.6095173, 77.0388031], [28.6095242, 77.0387806], [28.6095066, 77.0387694],
        [28.6094969, 77.0387824], [28.6094336, 77.038743], [28.6094541, 77.0386943],
        [28.6094353, 77.0386811], [28.6094145, 77.0385833], [28.6094224, 77.0385646],
        [28.6093744, 77.0385299], [28.6095369, 77.0382023], [28.6096137, 77.0382501],
        [28.6096268, 77.0382331], [28.6097408, 77.0382954], [28.6098604, 77.038257],
        [28.6098741, 77.038297], [28.6097757, 77.0383315], [28.6097893, 77.0383762],
        [28.6097792, 77.038383], [28.6098395, 77.0386054], [28.6098579, 77.0386028],
        [28.6098774, 77.0386725], [28.6098349, 77.0386892], [28.6098038, 77.0387455],
        [28.6096285, 77.038633], [28.6096022, 77.0386751], [28.6095696, 77.0386557],
        [28.6095614, 77.0386156], [28.6096097, 77.038595], [28.6095997, 77.0385554],
        [28.6095517, 77.038568], [28.6095392, 77.0385262], [28.6095581, 77.0384935],
        [28.6095971, 77.0385143], [28.6096978, 77.0383159], [28.6097463, 77.0383405]
      ]
    },
    {
      name: 'Fountain',
      color: '#3b82f6', 
      image: 'https://images.unsplash.com/photo-1549887552-cb11158b4ecf?q=80&w=1000&auto=format&fit=crop', 
      availableRooms: 0, 
      totalRooms: 0,
      isAdministrative: false,
      facilities: [],
      coords: [
        [
          [28.6100755, 77.0379095], [28.6100911, 77.0379185], [28.6101036, 77.037933], 
          [28.6101113, 77.0379521], [28.6101132, 77.0379727], [28.6101087, 77.0379931], 
          [28.6100994, 77.0380098], [28.6100856, 77.0380232], [28.6100683, 77.0380306], 
          [28.6100499, 77.038031], [28.6100327, 77.0380247], [28.6100165, 77.0380122], 
          [28.6100076, 77.0379941], [28.6100025, 77.0379742], [28.6100045, 77.0379528], 
          [28.610011, 77.0379338], [28.610024, 77.0379173], [28.6100399, 77.037908], 
          [28.6100577, 77.0379055], [28.6100755, 77.0379095] 
        ],
        [
          [28.6100786, 77.0379315], [28.6100963, 77.0379653], [28.6100894, 77.0379938],
          [28.6100693, 77.0380109], [28.6100316, 77.0380004], [28.610021, 77.0379732],
          [28.6100339, 77.0379357], [28.6100549, 77.0379251], [28.6100786, 77.0379315]
        ]
      ]
    },
    {
      name: 'APJ',
      color: '#3b82f6',
      image: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=1000&auto=format&fit=crop', 
      availableRooms: 2,
      totalRooms: 10,
      coords: [
        [28.6121502, 77.0365392], [28.6121641, 77.0365948], [28.6121326, 77.0366087],
        [28.612185, 77.036813], [28.6122451, 77.0367969], [28.6123566, 77.0372369],
        [28.6121602, 77.0373036], [28.6121874, 77.0374299], [28.6120605, 77.0374721],
        [28.6120425, 77.0374175], [28.6119265, 77.0374547], [28.6119004, 77.0373607],
        [28.611682, 77.0374293], [28.6116156, 77.0371659], [28.6118235, 77.0370972],
        [28.6117228, 77.0366777]
      ]
    }
  ];

  const comingSoonBuildings = [
    {
      name: 'Block 4',
      color: isDarkMode ? '#52525b' : '#71717a', 
      coords: [
        [
          [28.6096618, 77.0372422], [28.6096966, 77.0373892], [28.6096559, 77.0374054], [28.6096651, 77.037442],
          [28.609706, 77.0374326], [28.6097178, 77.0374733], [28.6097273, 77.0374719], [28.6097925, 77.0377315],
          [28.6097834, 77.0377382], [28.6097933, 77.0377863], [28.6097501, 77.0378011], [28.6097581, 77.0378394],
          [28.6096371, 77.0378812], [28.6095643, 77.038], [28.6095486, 77.0379919], [28.6095049, 77.0380719],
          [28.6093067, 77.0379443], [28.6093111, 77.0379315], [28.6092969, 77.0379217], [28.6092869, 77.0379318],
          [28.6092385, 77.0379038], [28.6092294, 77.0378688], [28.6092397, 77.0378375], [28.6092223, 77.0378258],
          [28.6091978, 77.0377295], [28.6092061, 77.0377094], [28.6091857, 77.0376959], [28.6091786, 77.0376576],
          [28.6092046, 77.0376098], [28.6092194, 77.0376155], [28.6092312, 77.0375954], [28.6092144, 77.0375785],
          [28.6092247, 77.0375513], [28.6092203, 77.0375446], [28.609303, 77.0373835], [28.6093116, 77.0373862],
          [28.6093312, 77.037354], [28.6093999, 77.0373987], [28.6094131, 77.037374], [28.6093481, 77.0373305],
          [28.6094094, 77.0372145], [28.6095457, 77.0373027], [28.6095457, 77.0372777]
        ],
        [
          [28.6095735, 77.037479], [28.6095847, 77.0375196], [28.6095657, 77.0375265], [28.6096281, 77.0377835],
          [28.6096455, 77.0377775], [28.6096576, 77.037827], [28.6096229, 77.0378408], [28.6095865, 77.0378962],
          [28.6094103, 77.0377845], [28.6093904, 77.037822], [28.6093539, 77.0377963], [28.6093539, 77.0377588],
          [28.609399, 77.0377429], [28.6093878, 77.0377044], [28.6093426, 77.0377163], [28.6093235, 77.0376787],
          [28.6093444, 77.0376352], [28.6093808, 77.037654], [28.6094806, 77.0374573], [28.6095335, 77.0374899]
        ]
      ]
    },
    {
      name: 'Block 6',
      color: isDarkMode ? '#52525b' : '#71717a',
      coords: [
        [
          [28.610195, 77.0375107], [28.6102329, 77.0376585], [28.6102707, 77.0376369], [28.6102869, 77.0376954],
          [28.6102437, 77.0377078], [28.6103167, 77.0380556], [28.6103707, 77.0380403], [28.6103815, 77.0380987],
          [28.6103383, 77.0381141], [28.6103734, 77.0382619], [28.6104896, 77.0382157], [28.610614, 77.0382804],
          [28.6108572, 77.037834], [28.6108167, 77.0375938], [28.610395, 77.0373568], [28.6103167, 77.0374892]
        ],
        [
          [28.6103809, 77.037653], [28.610383, 77.0376782], [28.610368, 77.037681], [28.6103843, 77.0377486],
          [28.6103974, 77.0377443], [28.6104449, 77.0379378], [28.6104286, 77.0379464], [28.6104467, 77.038014],
          [28.6104617, 77.038009], [28.610468, 77.0380254], [28.6104911, 77.0380185], [28.6105266, 77.0380411],
          [28.6106417, 77.037828], [28.6106885, 77.0378558], [28.6107054, 77.037824], [28.6106958, 77.0377854],
          [28.6106382, 77.0378], [28.6106302, 77.037762], [28.6106834, 77.0377442], [28.6106746, 77.0377059],
          [28.6106435, 77.0376846], [28.6106188, 77.0377307], [28.6104333, 77.037605], [28.6104063, 77.0376539]
        ]
      ]
    },
    {
      name: '8A Connecting Block',
      color: isDarkMode ? '#52525b' : '#71717a',
      coords: [
        [28.6097278, 77.0378515], [28.6097694, 77.0380216], [28.6097406, 77.0380336], [28.6097575, 77.0381009],
        [28.6097863, 77.0380933], [28.6098301, 77.0382624], [28.6097419, 77.0382959], [28.6095654, 77.0381904],
        [28.6095351, 77.0380614], [28.6096366, 77.0378803]
      ]
    },
    {
      name: 'Library',
      color: isDarkMode ? '#52525b' : '#71717a',
      coords: [
        [
          [28.6105101, 77.038789], [28.610397, 77.0388279], [28.6104002, 77.0388435], [28.6103688, 77.0388573],
          [28.6103801, 77.0389132], [28.6102447, 77.0389589], [28.6102291, 77.0389036], [28.6101823, 77.0389165],
          [28.6101763, 77.0389031], [28.6100492, 77.0389473], [28.6101613, 77.0393792], [28.6101902, 77.0393948],
          [28.6102239, 77.0394063], [28.6102577, 77.0394143], [28.610325, 77.0394211], [28.6103667, 77.039419],
          [28.6103953, 77.0394152], [28.6104269, 77.0394067], [28.6104557, 77.0393947], [28.6104824, 77.0393826],
          [28.6105114, 77.0393657], [28.6105372, 77.0393459], [28.610562, 77.0393217], [28.6105869, 77.0392933],
          [28.6106059, 77.0392598], [28.6106229, 77.0392248]
        ],
        [
          [28.6103886, 77.0390833], [28.6104183, 77.0392114], [28.6103408, 77.0392365], [28.6103085, 77.0391084]
        ]
      ]
    }
  ];
  
  const getDotColor = (available?: number, total?: number) => {
        if (total === undefined || total === 0) return 'bg-zinc-400'; 
    if (available === undefined || available === 0) return 'bg-rose-500';
    if (available >= total / 2) return 'bg-emerald-500';
    return 'bg-amber-500';
  };

  const allBuildings = [...activeBuildings, ...comingSoonBuildings];

  const tileUrl = isDarkMode 
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

  const worldMask = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [77.000, 28.640], [77.000, 28.580], [77.080, 28.580], [77.080, 28.640], [77.000, 28.640]
            ],
            nsutBoundary.features[0].geometry.coordinates[0]
          ]
        }
      }
    ]
  };

  // --- ROUTING HANDLERS ---
  const handleGetLocation = () => {
    setIsLocating(true);
    if (!navigator.geolocation) {
      alert('Geolocation is not supported.');
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setUserLocation([lng, lat]); 
        setStartPoint('gps'); // Automatically select GPS in the dropdown
        setIsLocating(false);
        if (mapRef.current) {
          mapRef.current.flyTo([lat, lng], 17);
        }
      },
      (error) => {
        setIsLocating(false);
        alert('Failed to get location. Please allow access.');
      }
    );
  };

  const handleSearchRoute = async () => {
    if (!startPoint || !destination) {
      alert("Please set both a starting point and a destination.");
      return;
    }

    let payload = {
      destinationId: destination,
      startCoords: null as [number, number] | null,
      startId: null as string | null
    };

    if (startPoint === 'gps') {
      if (!userLocation) {
        alert("Waiting for GPS location. Please click the GPS button first.");
        return;
      }
      payload.startCoords = userLocation;
    } else {
      payload.startId = startPoint;
    }

    try {
      const response = await fetch('/api/routing/shortest-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error("Failed to find path");
      
      const data = await response.json();
      setRouteGeoJSON(data);
      if (data.properties?.distance) setRouteDistance(data.properties.distance);
      
    } catch (err) {
      console.error(err);
      alert("Routing failed. Ensure backend API is running.");
    }
  };

  return (
    <div className={`relative w-full h-screen ${isDarkMode ? 'bg-zinc-800' : 'bg-zinc-50'}`}>
      
      {/* ---HIDDEN FLOATING ROUTING PANEL --- */}
      <div className={`hidden absolute top-6 left-6 z-[1000] w-72 backdrop-blur-md p-4 rounded-xl shadow-xl border transition-colors ${isDarkMode ? 'bg-zinc-800/90 border-zinc-700' : 'bg-white/90 border-zinc-200'}`}>
        <div className="space-y-3">
          
          <div>
            <label className={`block text-xs font-medium mb-1 ${isDarkMode ? 'text-zinc-400' : 'text-zinc-500'}`}>Starting Point</label>
            <div className="flex gap-2">
              <select 
                className={`w-full text-sm rounded-lg px-2 py-1.5 border outline-none focus:ring-2 focus:ring-blue-500 ${isDarkMode ? 'bg-zinc-800 text-white border-zinc-600' : 'bg-zinc-100 text-zinc-900 border-zinc-300'}`}
                value={startPoint} 
                onChange={(e) => setStartPoint(e.target.value)}
              >
                <option value="">Select starting point...</option>
                <option value="gps">📍 Current GPS Location</option>
                {activeBuildings.map(building => (
                  <option key={`start-${building.name}`} value={building.name}>{building.name}</option>
                ))}
              </select>
              <button 
                onClick={handleGetLocation} disabled={isLocating}
                className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1.5 rounded-lg text-sm font-semibold transition-colors flex-shrink-0"
                title="Use My Location"
              >
                {isLocating ? '...' : '📍'}
              </button>
            </div>
          </div>

          <div>
            <label className={`block text-xs font-medium mb-1 ${isDarkMode ? 'text-zinc-400' : 'text-zinc-500'}`}>Destination</label>
            <select 
              className={`w-full text-sm rounded-lg px-2 py-1.5 border outline-none focus:ring-2 focus:ring-blue-500 ${isDarkMode ? 'bg-zinc-800 text-white border-zinc-600' : 'bg-zinc-100 text-zinc-900 border-zinc-300'}`}
              value={destination} onChange={(e) => setDestination(e.target.value)}
            >
              <option value="">Select a landmark...</option>
              {activeBuildings.map(building => (
                <option key={`dest-${building.name}`} value={building.name}>{building.name}</option>
              ))}
            </select>
          </div>

          <button 
            onClick={handleSearchRoute}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold py-1.5 rounded-lg transition-colors"
          >
            Find Path
          </button>
          
          {routeDistance && (
            <div className="text-emerald-500 font-semibold text-xs text-center pt-1">
              Est. Distance: {routeDistance}
            </div>
          )}
        </div>
      </div>
      
                  {/* FLOATING ACTION BAR (Right Side) */}
      <div className="absolute top-6 right-6 z-[1000] flex gap-3 items-center">
        
        {/* NEW: Apply for CR Button (Only visible to Students) */}
        {session && (session.user as any)?.role === 'STUDENT' && (
          <button
            onClick={async () => {
              if (session.user?.email) {
                await applyForCR(session.user.email);
                setHasApplied(true);
              }
            }}
            disabled={hasApplied}
            className={`px-4 py-2 rounded-xl text-sm font-bold shadow-lg transition-all flex items-center gap-2
              ${hasApplied
                ? 'bg-zinc-200 text-zinc-500 cursor-not-allowed dark:bg-zinc-800 dark:text-zinc-500'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
          >
            {hasApplied ? '⏳ Pending Approval' : '🎓 Apply for CR'}
          </button>
        )}

        {/* Existing Search Button */}
        <button 
          className={`p-3 rounded-xl shadow-lg transition-colors flex items-center justify-center ${isDarkMode ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-white hover:bg-gray-100 text-zinc-900'}`}
          onClick={() => console.log('Search clicked')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        </button>

        {/* Existing Dark Mode Button */}
        <button 
            onClick={() => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode); // Update the screen
    localStorage.setItem('khaaliclass-theme', newMode ? 'dark' : 'light'); // Save to browser memory
  }}
          className={`p-3 rounded-xl shadow-lg transition-colors flex items-center justify-center ${isDarkMode ? 'bg-zinc-800 hover:bg-zinc-700 text-amber-400' : 'bg-white hover:bg-gray-100 text-blue-500'}`}
        >
          {isDarkMode ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
          )}
        </button>
        
                {/* Your User Profile Menu */}
        <UserMenu />

        {/* 👆 THE BOUNCING LOGIN REMINDER */}
        {showLoginPrompt && (
          <div className="absolute top-[110%] right-0 mt-4 flex flex-col items-end animate-bounce z-[9999]">
            <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500 drop-shadow-lg mb-1 mr-3">
              <path d="M12 19V5"/>
              <path d="m5 12 7-7 7 7"/>
            </svg>
            <div className="bg-amber-400 text-amber-950 px-4 py-2 rounded-xl font-bold text-sm shadow-xl shadow-amber-500/20 whitespace-nowrap border-2 border-amber-300">
              Hey! Sign in first to see the schedule!
            </div>
          </div>
        )}
      </div>

                        {/* 🎨 THE DARK MODE CSS TRICK */}
      <style>{`
        .dark-map-tiles {
          /* 🔥 Cranked brightness to 160% and dropped contrast to 70% to force a true grey! */
          filter: invert(100%) hue-rotate(180deg) brightness(160%) contrast(70%);
          transition: filter 0.3s ease;
        }
      `}</style>

                  <MapContainer 
        ref={mapRef} 
        center={[28.6100, 77.0382]}
        zoom={17.5}
        minZoom={16} /* 👈 THE FIX: Lowered from 16.5. This lets you zoom out WAY more! */
        maxZoom={19}   
        maxBounds={campusBounds} 
        maxBoundsViscosity={0.5} /* 👈 THE FIX: Changed from 1.0. This makes the map boundary feel like a bouncy rubber band instead of a hard brick wall. */
        style={{ height: '100%', width: '100%', backgroundColor: isDarkMode ? '#18181b' : '#f4f4f5' }}
        zoomControl={false} 
        
      >
        <MapZoomTracker onZoomChange={setCurrentZoom} /> {/* 👈 Now it properly sends the live zoom to the map! */}
                
        <TileLayer 
          url={tileUrl}
          /* 🗑️ Removed the dark-map-tiles className */
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          maxNativeZoom={19} 
          maxZoom={22}       
        />

        {/* THE OUTSIDE OF THE CAMPUS */}
        <GeoJSON 
          data={worldMask as any} 
          style={{
            /* Black outside for Dark Mode, White outside for Light Mode */
            fillColor: isDarkMode ? '#000000' : '#ffffff', 
            fillOpacity: 0.8,                              
            stroke: false                                  
          }}
        />

        {/* THE INSIDE OF THE CAMPUS */}
        <GeoJSON 
          data={nsutBoundary as any} 
          style={{
            color: isDarkMode ? '#52525b' : '#000000',     
            weight: 3, 
            fill: isDarkMode ? true : false,
            /* 🔥 THE MAGIC FIX: A tiny 6% white overlay turns the pitch-black map into the perfect smooth grey! */
            fillOpacity: isDarkMode ? 0.06 : 0,                                          
            fillColor: isDarkMode ? '#ffffff' : 'transparent',                      
          }}
        />


        {userLocation && startPoint === 'gps' && (
          <CircleMarker 
            center={[userLocation[1], userLocation[0]]} 
            radius={6}
            pathOptions={{ color: '#ffffff', fillColor: '#3b82f6', fillOpacity: 1, weight: 2 }}
          />
        )}

        {routeGeoJSON && (
          <GeoJSON 
            key={routeDistance} 
            data={routeGeoJSON}
            style={{ color: '#10b981', weight: 6, opacity: 0.9 }}
          />
        )}
          
                {allBuildings.map((building) => {
          // 🧮 LIVE MAP MATH: Sync the dots with the database!
          const isLiveBuilding = building.name === 'Block 5' || building.name === 'APJ';
          const bRooms = dbRooms.filter(r => r.building === building.name || r.name.includes(building.name));
          
          // If it's a live building, use DB data. If not, use the fallback dummy data.
        const total = isLiveBuilding ? (bRooms as any[]).length : ((building as any).totalRooms || 0);
        const available = isLiveBuilding ? (bRooms as any[]).filter((r: any) => r.status === 'AVAILABLE').length : ((building as any).availableRooms || 0);
          return (
            <Polygon 
              key={building.name}
              positions={building.coords as any} 
              pathOptions={{ 
                color: building.color, 
                fillColor: building.color, 
                fillOpacity: isDarkMode ? 0.35 : 0.5, 
                weight: 2 
              }}
                            eventHandlers={{
                click: () => {
                  setSelectedBuilding(building as any);
                  onSelectBlock((building as any).name);
                },
                mouseover: (e: any) => {
                  if (!selectedBuilding) {
                    setHoveredBuilding(building as any);
                    setMousePos({ x: e.originalEvent.clientX, y: e.originalEvent.clientY });
                  }
                },
                mousemove: (e: any) => {
                  if (!selectedBuilding) setMousePos({ x: e.originalEvent.clientX, y: e.originalEvent.clientY });
                },
                mouseout: () => setHoveredBuilding(null)
              }}
            >
                                          <Tooltip 
                permanent 
                direction="center" 
                className="!bg-transparent !border-none !shadow-none !p-0 pointer-events-none"
              >
                <div className="flex flex-col items-center justify-center -mt-4">
                  
                  {/* 🔥 THE NUCLEAR FIX: React will literally delete the text if zoomed out! */}
                  {currentZoom >= 16.8 && (
                    <span className={`font-bold text-[13px] whitespace-nowrap transition-all duration-200 ${isDarkMode ? 'text-zinc-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]' : 'text-zinc-900 drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]'}`}>
                      {building.name}
                    </span>
                  )}
                  
                  {/* 🔴 THE DYNAMIC DOT (This stays visible so you still see building statuses) */}
                  <div 
                    className={`w-3.5 h-3.5 rounded-full border-2 ${isDarkMode ? 'border-[#18181b]' : 'border-white'} shadow-sm ${getDotColor(available, total)} ${currentZoom >= 16.8 ? 'mt-0.5' : 'mt-2'}`}
                  />
                  
                </div>
              </Tooltip>
            </Polygon>
          );
        })}
            </MapContainer>

            {/* ============================================================== */}
      {/* HOVER TOOLTIP */}
      {/* ============================================================== */}
      {hoveredBuilding && hoveredBuilding.image && (() => {
        // 🧮 LIVE TOOLTIP MATH!
        const isLiveHover = hoveredBuilding.name === 'Block 5' || hoveredBuilding.name === 'APJ';
        const hRooms = dbRooms.filter(r => r.building === hoveredBuilding.name || r.name.includes(hoveredBuilding.name));
        
        const hoverTotal = isLiveHover ? hRooms.length : (hoveredBuilding.totalRooms || 0);
        const hoverAvail = isLiveHover ? hRooms.filter(r => r.status === 'AVAILABLE').length : (hoveredBuilding.availableRooms || 0);

        return (
          <div 
            className="fixed pointer-events-none z-[2000] rounded-xl overflow-hidden shadow-2xl transition-opacity duration-200"
            style={{
              left: `${mousePos.x + 15}px`, 
              top: `${mousePos.y + 15}px`,
              width: '280px',
              backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
            }}
          >
            <div 
              className="h-32 w-full bg-cover bg-center"
              style={{ backgroundImage: `url(${hoveredBuilding.image})` }}
            />
            
            <div 
              className="p-3 text-white flex flex-col"
              style={{ backgroundColor: hoveredBuilding.color }}
            >
              <span className="font-bold text-lg">{hoveredBuilding.name}</span>
              <div className="flex items-center gap-2 mt-1">
                {hoveredBuilding.isAdministrative ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>
                    <span className="text-sm font-semibold">Auditorium • DSW • SBI</span>
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="M14 9h4v6h-4z"/></svg>
                    <span className="text-sm font-semibold">
                      {hoverTotal > 0 ? `${hoverAvail}/${hoverTotal} available` : 'Coming Soon'}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}

            {/* ============================================================== */}
      {/* SLIDING SIDEBAR PANEL */}
      {/* ============================================================== */}
      <div 
        className={`fixed top-0 right-0 h-[100dvh] w-full sm:w-[400px] z-[3000] shadow-[-10px_0_30px_rgba(0,0,0,0.15)] transition-transform duration-300 ease-in-out transform flex flex-col overflow-y-auto
          ${selectedBuilding ? 'translate-x-0' : 'translate-x-full'}
          ${isDarkMode ? 'bg-zinc-900' : 'bg-zinc-50'}
        `}
      >
        {selectedBuilding && (
          <>
            <div className={`flex items-center justify-between p-5 sticky top-0 z-10 backdrop-blur-md ${isDarkMode ? 'bg-zinc-900/90 border-zinc-800' : 'bg-zinc-50/90 border-zinc-200'} border-b`}>
              <h2 className={`text-2xl font-extrabold ${isDarkMode ? 'text-white' : 'text-zinc-900'}`}>
                {selectedBuilding.name}
              </h2>
              <button 
                onClick={() => setSelectedBuilding(null)}
                className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-zinc-200 text-zinc-600'}`}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>

            {/* 📸 IMAGE & LIVE MATH HEADER */}
            {selectedBuilding.image && (() => {
              const isLiveBuilding = selectedBuilding.name === 'Block 5' || selectedBuilding.name === 'APJ';
              const buildingDbRooms = dbRooms.filter((r) => r.building === selectedBuilding.name || r.name.includes(selectedBuilding.name));
              
              const total = isLiveBuilding ? buildingDbRooms.length : (selectedBuilding.totalRooms || 0);
              const available = isLiveBuilding ? buildingDbRooms.filter((r) => r.status === 'AVAILABLE').length : (selectedBuilding.availableRooms || 0);

              let statusColor = selectedBuilding.color; 
              if (total > 0) {
                const ratio = available / total;
                if (ratio === 0) statusColor = '#ef4444'; // Red
                else if (ratio <= 0.4) statusColor = '#f59e0b'; // Orange
                else statusColor = '#10b981'; // Green
              }

              return (
                <div 
                  className="w-full h-56 bg-cover bg-center border-b border-zinc-200 dark:border-zinc-800 relative flex-shrink-0" 
                  style={{ backgroundImage: `url(${selectedBuilding.image})` }}
                >
                  {!selectedBuilding.isAdministrative && (
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-4">
                       <span 
                         className="font-bold text-xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] transition-colors duration-300" 
                         style={{ color: statusColor }}
                       >
                         {total > 0 ? `${available}/${total} Rooms Available` : 'Loading...'}
                       </span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* --- STICKY FILTERS (Only for Live Buildings) --- */}
            {(selectedBuilding.name === 'Block 5' || selectedBuilding.name === 'APJ') && (
              <div className={`sticky top-[73px] z-10 p-4 border-b shadow-sm ${isDarkMode ? 'bg-zinc-900/95 border-zinc-800' : 'bg-white/95 border-zinc-200'} backdrop-blur-md flex flex-col gap-3`}>
                
                {/* 🏢 DYNAMIC FLOOR BUTTONS */}
                <div className="flex gap-2 w-full">
                  {(selectedBuilding.name === 'Block 5' ? ['Ground', 'First', 'Second', 'Third'] : ['Ground']).map((floor) => (
                    <button 
                      key={floor}
                      onClick={() => setSelectedFloor(floor)}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-md border transition-all ${
                        (selectedFloor === floor || selectedBuilding.name === 'APJ') // Force highlight for APJ
                          ? 'bg-blue-500 text-white border-blue-600 shadow-md' 
                          : isDarkMode ? 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700' : 'bg-zinc-100 text-zinc-600 border-zinc-200 hover:bg-zinc-200'
                      }`}
                    >
                      {floor}
                    </button>
                  ))}
                </div>

                {/* Status Buttons */}
                <div className="flex gap-2 w-full">
                  <button 
                    onClick={() => setSelectedStatus('AVAILABLE')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-md border transition-all ${
                      selectedStatus === 'AVAILABLE' 
                        ? 'bg-emerald-500 text-white border-emerald-600 shadow-md' 
                        : isDarkMode ? 'bg-zinc-800 text-emerald-500/70 border-zinc-700 hover:bg-zinc-700' : 'bg-zinc-100 text-emerald-600 border-zinc-200 hover:bg-zinc-200'
                    }`}
                  >
                    🟢 Free
                  </button>
                  <button 
                    onClick={() => setSelectedStatus('OCCUPIED')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-md border transition-all ${
                      selectedStatus === 'OCCUPIED' 
                        ? 'bg-rose-500 text-white border-rose-600 shadow-md' 
                        : isDarkMode ? 'bg-zinc-800 text-rose-500/70 border-zinc-700 hover:bg-zinc-700' : 'bg-zinc-100 text-rose-600 border-zinc-200 hover:bg-zinc-200'
                    }`}
                  >
                    🔴 Occupied
                  </button>
                </div>
              </div>
            )}

            <div className="p-4 flex flex-col gap-3">
              {/* THE DYNAMIC ROOM LIST (Block 5 & APJ) */}
              {(selectedBuilding.name === 'Block 5' || selectedBuilding.name === 'APJ') ? (
                isLoadingRooms ? (
                  <div className="text-center py-10 text-zinc-500 animate-pulse">Scanning {selectedFloor} Floor...</div>
                ) : displayRooms.length === 0 ? (
                  <div className="text-center py-10 px-4 text-zinc-500 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl">
                    No rooms found matching filters.
                  </div>
                ) : (
                  displayRooms.map((room: any) => (
                    <div 
                      key={room.id}
                      className={`p-4 rounded-xl border flex flex-col gap-3 transition-colors ${
                        isDarkMode ? 'border-zinc-800 bg-zinc-800/40' : 'border-zinc-200 bg-white hover:border-zinc-300'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className={`font-bold text-lg ${isDarkMode ? 'text-white' : 'text-zinc-900'}`}>
                            {room.name.replace(`${selectedBuilding.name} - `, '')}
                          </h3>
                          <div className={`flex items-center gap-1 text-xs mt-1 ${isDarkMode ? 'text-zinc-400' : 'text-zinc-500'}`}>
                            <span>Capacity: {room.capacity} Seats</span>
                          </div>
                        </div>
                        
                        {/* Live Status Indicator */}
                        {room.status === "AVAILABLE" ? (
                          <span className="text-emerald-500 font-semibold text-sm flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>Available
                          </span>
                        ) : (
                          <span className="text-rose-500 font-semibold text-sm flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-rose-500"></span>In Use
                          </span>
                        )}
                      </div>

                                            {/* ACTION BUTTONS */}
                      {hasCRPowers ? (
                        <button 
                          onClick={async () => {
                            const nextStatus = room.status === 'AVAILABLE' ? 'OCCUPIED' : 'AVAILABLE';
                            setDbRooms(prev => prev.map(r => r.id === room.id ? { ...r, status: nextStatus } : r));

                            try {
                              const res = await fetch('/api/rooms/report', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ roomId: room.id, status: nextStatus }),
                              });

                              // 🛡️ THE BOUNCER TRAP STARTS HERE
                              if (res.status === 403) {
                                const data = await res.json();
                                if (data.roleChanged) {
                                  alert("Access Denied: Your permissions have changed.");
                                  await update({ role: "STUDENT" });
                                  
                                  // Revert the fake optimistic UI update
                                  setDbRooms(prev => prev.map(r => r.id === room.id ? { ...r, status: room.status } : r));
                                  return;
                                }
                              }
                              // 🛡️ THE BOUNCER TRAP ENDS HERE
                              
                            } catch (err) {
                              console.error("Failed to update status", err);
                            }
                          }}
                          className={`w-full py-2 text-xs font-bold uppercase tracking-wider border rounded transition-colors ${
                            room.status === 'AVAILABLE'
                              ? isDarkMode 
                                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20'
                                  : 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'
                              : isDarkMode
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                                  : 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
                          }`}
                        >
                          Mark as {room.status === 'AVAILABLE' ? '🔴 Occupied' : '🟢 Free'}
                        </button>
                                            ) : (
                        <button 
                          onClick={() => {
                            // 🛑 Check if they are logged in first!
                            if (!session?.user) {
                              setSelectedBuilding(null); // Slides sidebar away
                              setShowLoginPrompt(true);  // Triggers bouncing arrow
                            } else {
                              // ✅ They are logged in (Student), open the report modal
                              setFishyRoom(room);
                            }
                          }}
                          className={`w-full py-2 text-xs font-medium border rounded transition-all ${
                            isDarkMode 
                              ? 'text-zinc-500 border-zinc-800 hover:text-amber-400 hover:bg-amber-400/10 hover:border-amber-900' 
                              : 'text-zinc-500 border-zinc-200 hover:text-amber-600 hover:bg-amber-50 hover:border-amber-300'
                          }`}
                        >
                           Something fishy?? Put your correction
                        </button>
                      )}

                      {/* NEW BUTTON: View Full Schedule (Protected) */}
                      {session?.user ? (
                        <Link 
                          href={`/room/${room.id}`}
                          className={`w-full py-2 mt-2 text-center block text-xs font-bold uppercase tracking-wider border rounded transition-colors ${
                            isDarkMode 
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20'
                              : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100'
                          }`}
                        >
                           View Full Schedule
                        </Link>
                      ) : (
                        <button 
                          onClick={() => {
                            setSelectedBuilding(null); // 🚪 Slides the sidebar away
                            setShowLoginPrompt(true);  // 👆 Triggers the bouncing arrow
                          }}
                          className={`w-full py-2 mt-2 text-center block text-xs font-bold uppercase tracking-wider border rounded transition-colors ${
                            isDarkMode 
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20'
                              : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100'
                          }`}
                        >
                          View Full Schedule
                        </button>
                      )}
                      
                      
                    </div>
                  ))
                )
              ) : (
                /* THE "COMING SOON" PLACEHOLDER FOR ALL OTHER BUILDINGS */
                <div className="flex flex-col items-center justify-center py-20 px-6 text-center mt-10">
                  <span className="text-5xl mb-4 animate-bounce">🚧</span>
                  <h3 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-zinc-100' : 'text-zinc-900'}`}>
                    Coming Soon
                  </h3>
                  <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-zinc-400' : 'text-zinc-500'}`}>
                    We are currently mapping the live room data for <strong className={isDarkMode ? 'text-zinc-300' : 'text-zinc-700'}>{selectedBuilding.name}</strong>.<br/>Check back in a future update!
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ============================================================== */}
      {/* THE "SOMETHING FISHY" MODAL */}
      {/* ============================================================== */}
      {fishyRoom && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-xl max-w-sm w-full shadow-2xl relative">
            <h3 className="text-xl font-bold text-zinc-100 mb-2 text-center">
              Report Correction
            </h3>
            
            <p className="text-zinc-300 text-center mb-6 font-medium">
              {fishyRoom.status === 'AVAILABLE' 
                ? `Class ${fishyRoom.name.replace(`${selectedBuilding?.name || 'Block 5'} - `, '')} is marked as free but is busy?` 
                : `Class ${fishyRoom.name.replace(`${selectedBuilding?.name || 'Block 5'} - `, '')} is marked as occupied but is free?`}
            </p>

            <div className="flex gap-3">
              <button 
                onClick={() => setFishyRoom(null)}
                className="flex-1 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors font-medium"
              >
                Cancel
              </button>
              <button 
                onClick={async () => {
                  const getLiveLocation = () => new Promise<[number, number] | null>((resolve) => {
                    if (!navigator.geolocation) return resolve(null);
                    navigator.geolocation.getCurrentPosition(
                      (pos) => resolve([pos.coords.latitude, pos.coords.longitude]),
                      () => resolve(null),
                      { timeout: 4000, enableHighAccuracy: true } 
                    );
                  });

                  const liveCoords = await getLiveLocation();
                  
                  const BLOCK_5_CENTER_LAT = 28.6097;
                  const BLOCK_5_CENTER_LNG = 77.0385;
                  const GEOFENCE_RADIUS_METERS = 60;
                  
                  let distance = 9999; 
                  
                  if (liveCoords) {
                    distance = getDistanceInMeters(liveCoords[0], liveCoords[1], BLOCK_5_CENTER_LAT, BLOCK_5_CENTER_LNG);
                  } else if (userLocation) {
                    distance = getDistanceInMeters(userLocation[1], userLocation[0], BLOCK_5_CENTER_LAT, BLOCK_5_CENTER_LNG);
                  }

                  const isValidated = distance <= GEOFENCE_RADIUS_METERS;
                  const reportedStatus = fishyRoom.status === 'AVAILABLE' ? 'OCCUPIED' : 'AVAILABLE';

                  try {
                    const response = await fetch('/api/suggestions', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        roomName: fishyRoom.name,
                        reportedStatus: reportedStatus,
                        distanceMeters: Math.round(distance),
                        isValidated: isValidated,
                        userName: session?.user?.name || "Anonymous Student" 
                      })
                    });
                    
                    if (!response.ok) console.error("Shadow filter dropped the data.");
                  } catch (error) {
                    console.error("Network error on shadow filter.");
                  }

                  alert("Got it! We will verify this shortly. Thanks for helping out!");
                  setFishyRoom(null); 
                }}
                className="flex-1 py-2 rounded-lg bg-amber-500 text-zinc-950 hover:bg-amber-400 font-bold transition-colors shadow-lg shadow-amber-500/20"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}