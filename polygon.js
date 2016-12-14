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

    if (!this._isClockwise()) {
      this._reverse()
    }

    this._innerPoint = this._findInnerPoint();
  }

  isClosed() {
    return this._closed;
  }

  draw(vectorSource, color="blue") {
    if (this._arcs.length === 0) {
      return;
    }

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
   * Один отрезок идёт от точки по меридиану до верхней границы карты
   * Второй отрезок идёт от точки по меридиану до нижней границы карты
   * Третий отрезок идёт по продолжению дуги первых двух отрезков
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

    const topReversePoint = [(coords[0] - 90) % 180, MaxLat - 0.1];
    const bottomReversePoint = [(coords[0] - 90) % 180, - MaxLat + 0.1];
    const reverseRay = new Arc(topReversePoint, bottomReversePoint);
    const intersectionsCountReverse = this._arcs.map((a) => a.findIntersection(reverseRay)).filter((x) => x != null).length;

    if (intersectionsCountReverse % 2 === 0) {
      return (intersectionsCountTop % 2 === 1) && (intersectionsCountBottom % 2 === 1);
    } else {
      return this._checkDotInsideWithInnerPoint(coords);
    }
  }

  intersection(other) {
    if (!this._closed || !other._closed) {
      return [];
    }

    const [thisDots, otherDots] = this._createPointsLists(other);
    const [thisLabeledDots, otherLabeledDots, startDots] = this._markPoints(thisDots, otherDots, other);

    if (startDots.length === 0 && thisDots.length > 0 && otherDots.length > 0) {
      if (other.checkDotInside(thisDots[0][0])) {
        return [thisDots.map((p) => p[0])];
      } else if (this.checkDotInside(otherDots[0][0])) {
        return [otherDots.map((p) => p[0])];
      } else {
        return [];
      }
    }

    return this._bypassPoints(thisLabeledDots, otherLabeledDots, startDots);
  }

  union(other) {
    if (!this._closed || !other._closed) {
      return [];
    }

    const [thisDots, otherDots] = this._createPointsLists(other);
    const [thisLabeledDots, otherLabeledDots, startDots] = this._markPoints(thisDots, otherDots, other, false);

    if (startDots.length === 0 && thisDots.length > 0 && otherDots.length > 0) {
      return [thisDots.map((p) => p[0]), otherDots.map((p) => p[0])];
    }

    return this._bypassPoints(thisLabeledDots, otherLabeledDots, startDots, false);
  }

  diff(other) {
    if (!this._closed || !other._closed) {
      return [];
    }

    const [thisDots, otherDots] = this._createPointsLists(other);
    const [thisLabeledDots, otherLabeledDots, startDots] = this._markPoints(thisDots, otherDots, other, false);

    return this._bypassPoints(thisLabeledDots, otherLabeledDots, startDots, false, true);
  }


  _markPoints(thisDots, otherDots, other, startFromEnter=true) {
    var firstPointChecked = false;
    var nextPointLabel = ENTER_POINT;
    const thisLabeledDots = [];
    const otherLabeledDots = [];
    const startDots = [];

    for (var i = 0; i < thisDots.length; i++) {
      const [coords, label] = thisDots[i];
      if (label === INTERSECTION_POINT && !firstPointChecked) {
        nextPointLabel = other.checkDotInside(thisDots[i - 1][0]) ? EXIT_POINT : ENTER_POINT;
        firstPointChecked = true;
      }

      if (label === INTERSECTION_POINT) {
        thisLabeledDots.push(new PointWAA(coords, nextPointLabel, i, -1));
        nextPointLabel = nextPointLabel === ENTER_POINT ? EXIT_POINT : ENTER_POINT;
      } else {
        thisLabeledDots.push(new PointWAA(coords, label, i, -1));
      }

    }

    for (var i = 0; i < otherDots.length; i++) {
      const [coords, label] = otherDots[i];

      const p1index = -1;
      if (label === INTERSECTION_POINT) {
        var j = 0;
        while (j < thisLabeledDots.length && !utils.is2dCoordsEqual(coords, thisLabeledDots[j].coords)) {
          j++;
        }
        const pointWAA = new PointWAA(coords, thisLabeledDots[j].label, j, i);
        otherLabeledDots.push(pointWAA);
        thisLabeledDots[j].p2index = i;

        if ((startFromEnter && pointWAA.label === ENTER_POINT) || (!startFromEnter && pointWAA.label === EXIT_POINT)) {
          startDots.push(pointWAA);
        }
      } else {
        otherLabeledDots.push(new PointWAA(coords, label, -1, i));
      }
    }

    return [thisLabeledDots, otherLabeledDots, startDots];
  }

  /*
   * Принимает списки точек для каждого многоугольника (с точками пересечения) в виде PointWAA, отдельный список начальных точек
   * и параметры обхода: начинать с точки или выхода и осуществлять обход в обратном направлении или прямом
   *
   * Возвращает список списков координат вершин для отсечённых многоугольников
   *
   * Работает c многоугольниками, заданными по часовой стрелке
    * */
  _bypassPoints(p1, p2, startPoints, startFromEnter=true, reverseBypass=false) {
    console.log(p1);
    console.log(p2);
    console.log(startPoints);

    const enter_point = startFromEnter ? ENTER_POINT : EXIT_POINT;
    const exit_point = startFromEnter ? EXIT_POINT : ENTER_POINT;
    const resultPolygons = [];

    while (startPoints.length != 0) {
      // обход точек заканчивается на исходной точке входа, причём она будет лежать на втором многоугольнике
      const firstPointP2Index = startPoints[0].p2index;

      var i = 0;
      var j = -1;
      const clippedPolygonPoints = [];

      while (j != firstPointP2Index) {
        if (j === -1) { j = firstPointP2Index; }
        for (i = p2[j].p1index; p1[i].label != exit_point; i++) {
          clippedPolygonPoints.push(p1[i].coords);
          if (i === p1.length - 1) {
            i = -1;
          }
        }

        for (j = p1[i].p2index; p2[j].label != enter_point; reverseBypass ? j-- : j++) {
          clippedPolygonPoints.push(p2[j].coords);
          if ((!reverseBypass && j === p2.length - 1)) {
            j = -1;
          } else if ((reverseBypass && j === 0)) {
            j = p2.length;
          }
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
          utils.addToListsDict(intersections, a.toString(), [intersection, INTERSECTION_POINT]);
          utils.addToListsDict(intersections, b.toString(), [intersection, INTERSECTION_POINT]);
        }
      })
    });


    var thisDots = [];
    var otherDots = [];

    this._arcs.forEach((a) => {
      thisDots.push([a.a, OWN_POINT]);
      if (intersections[a.toString()] != undefined) {
        thisDots = thisDots.concat(this._sortIntersectionPoints(a.a, a.b, intersections[a.toString()]));
      }
    });

    other._arcs.forEach((a) => {
      otherDots.push([a.a, OWN_POINT]);
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

  /**
   * Меняет направление обхода вершин многоугольника
    * */
  _reverse() {
    if (this._points.length < 3) {
      return;
    }

    this._points = [this._points[0]].concat(this._points.slice(1).reverse());

    this._arcs = [];
    for (var i = 0; i < this._points.length; i++) {
      if (i + 1 === this._points.length) {
        this._arcs.push(new Arc(this._points[i], this._points[0]));
      } else {
        this._arcs.push(new Arc(this._points[i], this._points[i + 1]));
      }
    }
    console.log("reversed");
  }

  _skewProduct(d1, d2, d3) {
    const [x1, y1] = d1;
    const [x2, y2] = d2;
    const [x3, y3] = d3;
    return (x2 - x1) * (y3 - y1) - (y2 - y1) * (x3 - x1);
  }

  _isClockwise() {
    return this._skewProduct(this._points.slice(-1)[0], this._points[0], this._points[1]) < 0;
  }

  _checkDotInsideWithInnerPoint(coords) {
    console.log("Dot checked with inner point");
    const segmentChecker = new Arc(coords, this._innerPoint);

    const intersectionsCount = this._arcs.map((a) => a.findIntersection(segmentChecker)).filter((x) => x != null).length;

    return intersectionsCount % 2 === 0;
  }

  _findInnerPoint() {
    if (this._points.length < 3) {
      return;
    }
    //console.log(this._points);

    const [pointWithMinY1, pointWithMinY2] = this._findTwoMinCoords(this._points, 1);
    const [minY1, minY2] = [pointWithMinY1, pointWithMinY2].map((p) => p[1]);
    const minY = (minY1 + minY2) / 2;
    const minX = this._points.map((p) => p[0]).reduce((p, v) => p < v ? p : v);
    const maxX = this._points.map((p) => p[0]).reduce((p, v) => p > v ? p : v);
    const secantArc = new Arc([minX, minY], [maxX, minY]);
    const intersections = this._arcs.map((a) => a.findIntersection(secantArc)).filter((i) => i != null);

    //console.log([minX, minY], [maxX, minY]);
    //console.log(intersections);
    if (intersections.length === 1) {
      intersections.push([pointWithMinY1, pointWithMinY2].filter((p) => p[0] != intersections[0][0])[0]);
    } else if (intersections.length === 0) {
      intersections.push(pointWithMinY1);
      intersections.push(pointWithMinY2);
    }
    const [minPointLong1, minPointLong2] = this._findTwoMinCoords(intersections, 0);
    console.log([minPointLong1, minPointLong2]);
    const innerArc = new Arc(minPointLong1, minPointLong2);
    const middlePoint = innerArc.getMiddlePoint();

    //console.log(middlePoint);
    return middlePoint;
  }

  _findTwoMinCoords(coords, index) {
    var [min1, min2] = [coords[0], coords[1]];

    for (var i = 0; i < coords.length; i++) {
      if (coords[i][index] < min1[index]) {
        min2 = min1;
        min1 = coords[i];
      } else if (coords[i][index] < min2[index] || coords[i][index] != min1[index]) {
        min2 = coords[i];
      }
    }

    return [min1, min2];
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

EXIT_POINT = "exit";
ENTER_POINT = "enter";
INTERSECTION_POINT = "intersection";
OWN_POINT = "own";

module.exports = Polygon;
