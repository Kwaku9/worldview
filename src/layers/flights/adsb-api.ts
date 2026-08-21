export interface MilitaryAircraft {
  icao: string;
  callsign: string;
  type: string;
  description: string;
  operator: string;
  longitude: number;
  latitude: number;
  altitude: number;
  speed: number;
  heading: number;
  squawk: string;
  flag: string;
}

/**
 * Military aircraft, from airplanes.live's /v2/mil feed.
 *
 * REQUIRES APPROVAL. Since 2026-08 airplanes.live answers anonymous callers
 * with 403 and asks you to email contact@airplanes.live describing your
 * project. Verified from two unrelated IPs, so it is policy rather than a
 * per-host block. There is no free substitute: OpenSky (which now backs the
 * civil flights layer) publishes no military filter.
 *
 * Consequence for anyone running this from a clone: this layer stays empty
 * until they arrange their own access. It reports that plainly instead of
 * throwing, so one unavailable feed cannot take the rest of the globe with it.
 */
export class MilitaryFeedUnavailable extends Error {
  constructor(public readonly status: number) {
    super(
      status === 403
        ? 'Military feed requires approval from airplanes.live — see README'
        : `airplanes.live API error: ${status}`
    );
    this.name = 'MilitaryFeedUnavailable';
  }
}

export async function fetchMilitaryAircraft(): Promise<MilitaryAircraft[]> {
  let response: Response;
  try {
    response = await fetch('/api/planes/v2/mil');
  } catch (e) {
    throw new MilitaryFeedUnavailable(0);
  }

  if (!response.ok) {
    throw new MilitaryFeedUnavailable(response.status);
  }

  const data = await response.json();
  if (!data.ac) return [];

  return data.ac
    .filter((ac: any) => ac.lon != null && ac.lat != null)
    .map((ac: any): MilitaryAircraft => ({
      icao: ac.hex || '',
      callsign: (ac.flight || '').trim(),
      type: ac.t || 'Unknown',
      description: ac.desc || '',
      operator: ac.ownOp || '',
      longitude: ac.lon,
      latitude: ac.lat,
      altitude: (ac.alt_geom ?? ac.alt_baro ?? 0) * 0.3048,
      speed: ac.gs ?? 0,
      heading: ac.track ?? 0,
      squawk: ac.squawk || '',
      flag: ac.dbFlags?.toString() || '',
    }));
}
