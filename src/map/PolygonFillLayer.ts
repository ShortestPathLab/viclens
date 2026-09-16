import { SolidPolygonLayer } from "@deck.gl/layers";

/**
 * The polygon fill, with its draw kept to the current data.
 *
 * deck.gl 9.4.0 sets only the vertex count on the fill model. luma.gl 9.4 sizes an indexed draw by
 * the index count instead, and without one it draws the whole index buffer. deck.gl keeps that
 * buffer at its largest size, so after a search narrowed the zones the fill went on drawing the
 * triangles left over from the statewide set, which smeared across the map. Setting the index
 * count keeps the draw to the polygons that are actually there.
 */
export default class PolygonFillLayer<DataT = unknown> extends SolidPolygonLayer<DataT> {
  static layerName = "PolygonFillLayer";

  draw(options: Parameters<SolidPolygonLayer["draw"]>[0]) {
    const { topModel, polygonTesselator } = this.state;
    if (topModel && topModel.indexCount !== polygonTesselator.vertexCount)
      topModel.setIndexCount(polygonTesselator.vertexCount);
    super.draw(options);
  }
}
