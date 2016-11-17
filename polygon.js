const utils = require('./geo-utils');
const vf = require('./vector_features');
const ol = require('openlayers');
const Arc = require('./arcs');

class Polygon {
  constructor() {
    this._points = [];
    this._arcs = [];
    this._closed = false;

    this._createTempLine();
  }

  /*
   * Принимает координаты точки в виде долготы и широты
    * */
  addPoint(coords) {
    if (this._points.length > 0) {
      this._arcs.push(new Arc(this._points.slice(-1)[0], coords));
    }

    this._points.push(coords);
  }

  close() {
    if (this._points.length < 3) {
      return;
    }

    this._arcs.push(new Arc(this._points[0], this._points.slice(-1)[0]));
    this._closed = true;
  }

  isClosed() {
    return this._closed;
  }

  draw(vectorSource) {
    if (this._arcs.length === 0) {
      return;
    }
    console.log('draw');
    this._arcs.forEach((a) => a.draw(vectorSource));

    if (!this._tempLineAdded) {
      vectorSource.addFeature(this._tempLine);
      this._tempLineAdded = true;
    }

    if (this._closed || this._arcs.length === 1) {
      this._tempLine.setGeometry();
    } else {
      const p1 = ol.proj.transform(this._points[0], 'EPSG:4326', 'EPSG:3857');
      const p2 = ol.proj.transform(this._points.slice(-1)[0], 'EPSG:4326', 'EPSG:3857');

      this._tempLine.setGeometry(new ol.geom.LineString([p1, p2]));
    }
  }
  /*
   * Принимает долготу и широту точки, проверяет её принадлежность фигуре методом трассировки луча
   * Луч идёт от точки по меридиану до верхней границы карты
   * !!! может не работать с фигурами, выходящими за верхнюю границу (прецедентов не было, но подозрение есть) !!!
    * */
  checkDotInside(coords) {
    const MaxLat = 90;//85.05113;
    // точка, лежащая на верхней границе карты и на том же меридиане, что и данная
    const topPoint = [coords[0], MaxLat];
    const topRay = new Arc(coords, topPoint);
    const intersectionsCountTop = this._arcs.map((a) => a.findIntersection(topRay)).filter((x) => x != null).length;

    const bottomPoint = [coords[0], -MaxLat];
    const bottomRay = new Arc(coords, bottomPoint);
    const intersectionsCountBottom = this._arcs.map((a) => a.findIntersection(bottomRay)).filter((x) => x != null).length;

    return (intersectionsCountTop % 2 === 1) || (intersectionsCountBottom % 2 === 1);
  }

  _createTempLine() {
    this._tempLineAdded = false;
    this._tempLine = new ol.Feature({name: 'TempLine'});
    this._tempLine.setStyle(new ol.style.Style({
      stroke: new ol.style.Stroke({
        lineDash: [4, 4]
      })
    }));
  }
}

module.exports = Polygon;
