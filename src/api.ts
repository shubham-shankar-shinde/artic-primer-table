import type { Artwork } from "./types";

export interface ArtworkApiResponse {
  data: any[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    total_pages?: number;
  }
}

 
export async function fetchArtworksPage(page = 1, limit = 10): Promise<{ items: Artwork[]; total: number; per_page: number; }> {
   
  const url = `https://api.artic.edu/api/v1/artworks?page=${page}&limit=${limit}&fields=id,title,place_of_origin,artist_display,inscriptions,date_start,date_end`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch artworks');
  const json = await res.json() as ArtworkApiResponse;

  const items: Artwork[] = (json.data || []).map((d) => ({
    id: d.id,
    title: d.title ?? null,
    place_of_origin: d.place_of_origin ?? null,
    artist_display: d.artist_display ?? null,
    inscriptions: d.inscriptions ?? null,
    date_start: d.date_start ?? null,
    date_end: d.date_end ?? null
  }));
  
  const total = json.pagination?.total ?? 0;
  const per_page = json.pagination?.limit ?? limit;
  return { items, total, per_page };
}
