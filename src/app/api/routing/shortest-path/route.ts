import { NextResponse } from 'next/server';

const BUILDING_ENTRANCES: Record<string, [number, number][]> = {
  'Admin Block': [[77.03665, 28.60975]], 
  'APJ Complex': [
    [77.0373643, 28.6118914],
    [77.037049, 28.6118176]
  ],
  'Students Centre': [[77.0369544, 28.611586]],
  'Smart Block': [[77.0377369, 28.611872]],
  'Shopping Complex': [[77.0375092, 28.6123712]],
  'Medical Centre': [[77.038598, 28.61162]],
  'Training and Placements Cell': [[77.0395303, 28.6087118]],
  'Hostel: Endgame': [[77.0358872, 28.6126216]],
  'Hostel: Civil War': [[77.0350544, 28.612325]],
  'Hostel: 1st Year': [[77.0346282, 28.613033]],
  'Hostel: Age of Engineers': [[77.035526, 28.6133467]],
  'Block 4': [[77.0376017, 28.6097615]],
  'Block 5': [[77.0384518, 28.6099717]],
  'Block 6': [
    [77.0378879, 28.6102671], 
    [77.0377199, 28.6108156]
  ],
  'Block 8A Connecting Block': [
    [77.0380657, 28.6097552],  
    [77.0381234, 28.6095493]
  ],
  'Library': [[77.0389305, 28.6103108]],
  'College Fountain': [[77.0380, 28.6100]] 
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { startCoords, startId, destinationId } = body;

    if (!destinationId) return NextResponse.json({ error: 'Missing destination' }, { status: 400 });

    // 1. Determine Start Coordinates
    let finalStartCoords: [number, number] | undefined;

    if (startCoords && startCoords.length === 2) {
      finalStartCoords = startCoords as [number, number]; 
    } else if (startId && BUILDING_ENTRANCES[startId]) {
      finalStartCoords = BUILDING_ENTRANCES[startId][0]; 
    }

    if (!finalStartCoords) return NextResponse.json({ error: 'Invalid start point' }, { status: 400 });

    const destinationEntrances = BUILDING_ENTRANCES[destinationId];
    if (!destinationEntrances || destinationEntrances.length === 0) {
      return NextResponse.json({ error: 'Destination entries not mapped' }, { status: 404 });
    }

    // 2. Loop through all entry doors and ask OSRM for the path to each
    let bestRoute: any = null;
    let shortestDistance = Infinity;
    let bestEntrance: [number, number] | null = null;

    for (const entryCoord of destinationEntrances) {
      const osrmUrl = `http://router.project-osrm.org/route/v1/foot/${finalStartCoords[0]},${finalStartCoords[1]};${entryCoord[0]},${entryCoord[1]}?geometries=geojson&overview=full`;
      
      const osrmResponse = await fetch(osrmUrl);
      if (!osrmResponse.ok) continue;

      const osrmData = await osrmResponse.json();
      
      if (osrmData.code === 'Ok' && osrmData.routes && osrmData.routes.length > 0) {
        const route = osrmData.routes[0];
        if (route.distance < shortestDistance) {
          shortestDistance = route.distance;
          bestRoute = route;
          bestEntrance = entryCoord;
        }
      }
    }

    if (!bestRoute || !bestEntrance) {
      return NextResponse.json({ error: 'No walkable route found to any entrance' }, { status: 404 });
    }

    // --- THE FIX: Stitching the exact coordinates onto the OSRM path ---
    // OSRM returns an array of coordinates like: [[lng1, lat1], [lng2, lat2], ...]
    let pathCoordinates = bestRoute.geometry.coordinates;

    // Add the exact starting door to the very beginning of the path array
    pathCoordinates.unshift(finalStartCoords);
    
    // Add the exact destination door to the very end of the path array
    pathCoordinates.push(bestEntrance);

    // 3. Return the fully stitched route to the frontend
    const routeGeoJSON = {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: pathCoordinates
      },
      properties: {
        distance: `${Math.round(bestRoute.distance)} meters`,
        duration: `${Math.round(bestRoute.duration / 60)} min walk`
      }
    };

    return NextResponse.json(routeGeoJSON);

  } catch (error) {
    console.error('Routing API Error:', error);
    return NextResponse.json({ error: 'Internal server failure' }, { status: 500 });
  }
}