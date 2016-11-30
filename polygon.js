const utils = require('./geo-utils');
const vf = require('./vector_features');
const ol = require('openlayers');
const Arc = require('./arcs');

class Polygon {
  constructor(points=[]) {
    this._points = [];
    this._arcs = [];
    this._closed = false;

    points.forEach((p) => this.addPoint(p));
    if (points.length > 0) {
      this.close();
    }

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

    this._arcs.push(new Arc(this._points.slice(-1)[0], this._points[0]));
    this._closed = true;
  }

  isClosed() {
    return this._closed;
  }

  draw(vectorSource, color="blue") {
    if (this._arcs.length === 0) {
      return;
    }
    console.log('draw');
    this._arcs.forEach((a) => a.draw(vectorSource, color));

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
   * !!! может не работать с фигурами, выходящими за верхнюю границу !!!
    * */
  checkDotInside(coords) {
    const MaxLat = 90;
    // точка, лежащая на северном полюсе и на том же меридиане, что и данная
    const topPoint = [coords[0], MaxLat];
    const topRay = new Arc(coords, topPoint);
    const intersectionsCountTop = this._arcs.map((a) => a.findIntersection(topRay)).filter((x) => x != null).length;

    const bottomPoint = [coords[0], -MaxLat];
    const bottomRay = new Arc(coords, bottomPoint);
    const intersectionsCountBottom = this._arcs.map((a) => a.findIntersection(bottomRay)).filter((x) => x != null).length;

    return (intersectionsCountTop % 2 === 1) || (intersectionsCountBottom % 2 === 1);
  }

  // TODO проверять частный случай, когда пересечений нет
  // TODO вынести строки в константы
  intersection(other) {
    if (!this._closed || !other._closed) {
      return null;
    }

    const [thisDots, otherDots] = this._createPointsLists(other);

    var firstPointChecked = false;
    var nextPointLabel = "enter";
    const thisLabeledDots = [];
    const otherLabeledDots = [];
    const startDots = [];

    for (var i = 0; i < thisDots.length; i++) {
      const [coords, label] = thisDots[i];
      if (label === "intersection" && !firstPointChecked) {
        nextPointLabel = other.checkDotInside(thisDots[i - 1][0]) ? "exit" : "enter";
        firstPointChecked = true;
      }

      if (label === "intersection") {
        thisLabeledDots.push(new PointWAA(coords, nextPointLabel, i, -1));
        nextPointLabel = nextPointLabel === "enter" ? "exit" : "enter";
      } else {
        thisLabeledDots.push(new PointWAA(coords, label, i, -1));
      }

    }

    for (var i = 0; i < otherDots.length; i++) {
      const [coords, label] = otherDots[i];

      const p1index = -1;
      if (label === "intersection") {
        var j = 0;
        while (j < thisLabeledDots.length && !utils.is2dCoordsEqual(coords, thisLabeledDots[j].coords)) {
          j++;
        }
        const pointWAA = new PointWAA(coords, thisLabeledDots[j].label, j, i);
        otherLabeledDots.push(pointWAA);
        thisLabeledDots[j].p2index = i;

        if (pointWAA.label === "enter") {
          startDots.push(pointWAA);
        }
      } else {
        otherLabeledDots.push(new PointWAA(coords, label, -1, i));
      }
    }

    console.log(thisLabeledDots);
    console.log(otherLabeledDots);
    return this._bypassPoints(thisLabeledDots, otherLabeledDots, startDots);
  }

  /*
   * Принимает списки точек для каждого многоугольника (с точками пересечения) в виде PointWAA и отдельный список начальных точек
   * Возвращает список списков координат вершин для отсечённых многоугольников
   * !!! Работает только, если оба многоугольника заданы по часовой стрелке !!!
    * */
  _bypassPoints(p1, p2, startPoints) {
    const resultPolygons = [];

    while (startPoints.length != 0) {
      // обход точек заканчивается на исходной точке входа, причём она будет лежать на втором многоугольнике
      const firstPointP2Index = startPoints[0].p2index;

      var i = 0;
      var j = -1;
      const clippedPolygonPoints = [];

      while (j != firstPointP2Index) {
        if (j === -1) { j = firstPointP2Index; }
        for (i = p2[j].p1index; i < p1.length && p1[i].label != "exit"; i++) {
          clippedPolygonPoints.push(p1[i].coords);
        }
        console.log(clippedPolygonPoints);
        console.log(p1[i].p2index);

        for (j = p1[i].p2index; j < p2.length && p2[j].label != "enter"; j++) {
          clippedPolygonPoints.push(p2[j].coords);
          console.log(p2[j].label);
        }
        startPoints.removeFromArray(p2[j], (x, y) => x.p2index === y.p2index);
      }

      resultPolygons.push(clippedPolygonPoints);
    }

    return resultPolygons;
  }

  _createPointsLists(other) {
    // ключ - отрезок многоугольника, значение - список точек пересечения, лежащих на нём
    const intersections = {};

    this._arcs.forEach((a) => {
      other._arcs.forEach((b) => {
        const intersection = a.findIntersection(b);
        if (intersection != null) {
          utils.addToListsDict(intersections, a.toString(), [intersection, "intersection"]);
          utils.addToListsDict(intersections, b.toString(), [intersection, "intersection"]);
        }
      })
    });


    var thisDots = [];
    var otherDots = [];

    this._arcs.forEach((a) => {
      thisDots.push([a.a, "own"]);
      if (intersections[a.toString()] != undefined) {
        thisDots = thisDots.concat(this._sortIntersectionPoints(a.a, a.b, intersections[a.toString()]));
      }
    });

    other._arcs.forEach((a) => {
      otherDots.push([a.a, "own"]);
      if (intersections[a.toString()] != undefined) {
        otherDots = otherDots.concat(this._sortIntersectionPoints(a.a, a.b, intersections[a.toString()]));
      }
    });

    return [thisDots, otherDots];
  }

  _sortIntersectionPoints(start, end, points) {
    const [x1, y1] = start;
    const [x2, y2] = end;

    if (x1 > x2) {
      points.sort((a, b) => b[0][0] - a[0][0]);
    } else if (x1 < x2) {
      points.sort((a, b) => a[0][0] - b[0][0]);
    } else if (x1 === x2) {
      if (y1 > y2) {
        points.sort((a, b) => b[0][1] - a[0][1]);
      } else {
        points.sort((a, b) => a[0][1] - b[0][1]);
      }
    }

    return points;
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

/*
 * Класс точек, рассматриваемых при обходе многоугольников по алгоритму Вейлера-Азертона
  * */
class PointWAA {
  constructor(coords, label, p1index, p2index) {
    this.coords = coords;
    this.label = label;
    this.p1index = p1index;
    this.p2index = p2index;
  }
}

module.exports = Polygon;
