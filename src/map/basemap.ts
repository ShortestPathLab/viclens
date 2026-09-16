// A Mapbox token turns on the street basemap. Without one the map draws its own coastline and
// city labels so the page still works offline.
export const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN?.trim() || "";
export const cities = [
  { name: "Melbourne", position: [144.9631, -37.8136] },
  { name: "Geelong", position: [144.3617, -38.1499] },
  { name: "Ballarat", position: [143.8503, -37.5622] },
  { name: "Bendigo", position: [144.2794, -36.757] },
  { name: "Shepparton", position: [145.3987, -36.3833] },
  { name: "Warrnambool", position: [142.48, -38.38] },
  { name: "Traralgon", position: [146.53, -38.2] },
];
export interface Hover {
  x: number;
  y: number;
  title: string;
  detail: string;
}
