const ol = require('openlayers');
const Arc = require('./arcs');
const Polygon = require('./polygon');
const utils = require('./geo-utils');
const $ = require('jquery');

const [vectorSource, map] = initMap();
// списки объектов для отрисовки
const arcs = [];
const polygons = [];
const points = [];
// используется при графическом задании отрезков
const tempPointsLongLat = [];
// используется при покоординатном задании точек
const pointsCoordinates = [];

const drawPoint = new ol.interaction.Draw({
  source: vectorSource,
  type: 'Point'
});
drawPoint.on('drawstart', addDot);

$("#type").change(selectAction);
$("#clear").click(clearAll);
$("#intersection_button").click(polygonsIntersection);
$("#union_button").click(polygonsUnion);
$("#a_minus_b_button").click(polygonDiffAB);
$("#b_minus_a_button").click(polygonDiffBA);
$("#submit_figure").click(submitFigure);

document.addEventListener('keydown', handleKeys, false);
map.addInteraction(drawPoint);

var maxCoordinatesInputFieldNumber = 0;
addCoordinatesInputField(0);
// ----------------------------------

function initMap() {
  const mapParameters = {
    wrapX: false,
    noWrap: true
  };

  const raster = new ol.layer.Tile({
    source: new ol.source.OSM(mapParameters)
  });

  const vectorSource = new ol.source.Vector(mapParameters);

  const vector = new ol.layer.Vector({
    source: vectorSource
  });

  const map = new ol.Map({
    layers: [raster, vector],
    target: 'map',
    view: new ol.View({
      center: [0, 0],
      zoom: 2
    })
  });

  return [vectorSource, map];
}

function selectAction() {
  if ($('#type').val() === 'Polygon' || $('#type').val() === 'Line' || $('#type').val() === 'Point') {
    clickInput();
  } else if ($('#type').val() === 'Coordinates') {
    coordinatesInput();
  }
}

function clickInput() {
  map.addInteraction(drawPoint);
}

function addDot(e) {
  coords = e.feature.getGeometry().getCoordinates();
  longLat = ol.proj.transform(coords, 'EPSG:3857', 'EPSG:4326');

  if ($('#type').val() === 'Polygon') {
    addDotToPolygon(longLat);
  } else if ($('#type').val() === 'Line') {
    addDotToLines(longLat);
  } else if ($('#type').val() === 'Point') {
    addDotToPoints(longLat, e.feature);
  }
}

function addDotToPolygon(point) {
  const lastPolygon = polygons.slice(-1)[0];
  if (lastPolygon != undefined && !lastPolygon.isClosed()) {
    lastPolygon.addPoint(point);
    lastPolygon.draw(vectorSource);
  } else {
    const newPolygon = new Polygon();
    newPolygon.addPoint(point);
    newPolygon.draw(vectorSource);
    polygons.push(newPolygon);
  }
}

function addDotToLines(point) {
  if (tempPointsLongLat.length === 1) {
    const newArc = new Arc(tempPointsLongLat[0], point);
    newArc.draw(vectorSource);
    arcs.push(newArc);
    tempPointsLongLat.clear();
  } else {
    tempPointsLongLat.push(point);
  }
}

function addDotToPoints(point, feature) {
  points.push([point, feature]);
}

function handleKeys(event) {
  // ENTER key
  if (event.keyCode === 13) {
    if ($('#type').val() === 'Line') {
      computeAllArcsIntersections();
    } else if ($('#type').val() === 'Polygon') {
      closePolygon();
    } else if ($('#type').val() === 'Point') {
      checkAllPointsInside();
    }
  }
}

function computeAllArcsIntersections() {
  utils.range(arcs.length).forEach((i) => {
    for (var j = i + 1; j < arcs.length; j++) {
      const intersectDot = arcs[i].findIntersection(arcs[j]);
      if (intersectDot !== null) {
        const intersectDotXY = ol.proj.transform(intersectDot, 'EPSG:4326', 'EPSG:3857');
        vectorSource.addFeature(new ol.Feature(new ol.geom.Point(intersectDotXY)));
      }
    }
  });
}

function closePolygon() {
  if (polygons.length === 0) {
    return;
  }
  polygons.slice(-1)[0].close();
  polygons.slice(-1)[0].draw(vectorSource);
}

function checkAllPointsInside() {
  polygons.filter((p) => p.isClosed()).forEach((polygon) => points.forEach((point) => {
    const [coords, feature] = point;
    if (polygon.checkDotInside(coords)) {
      const coloredPoint = new ol.style.Circle({
        radius: 5,
        stroke: new ol.style.Stroke({color: 'red', width: 2})
      });
      feature.setStyle(new ol.style.Style({image: coloredPoint}));
    }
  }));
}

function polygonsIntersection() {
  if ($('#type').val() != 'Polygon') {
    return;
  }

  utils.range(polygons.length).forEach((i) => {
    for (var j = i + 1; j < polygons.length; j++) {
      polygons[i].intersection(polygons[j]).forEach((points) => {
        console.log(points);
        const polygon = new Polygon(points);
        polygon.draw(vectorSource, "red");
      });
    }
  });
}

function polygonsUnion() {
  if ($('#type').val() != 'Polygon') {
    return;
  }

  utils.range(polygons.length).forEach((i) => {
    for (var j = i + 1; j < polygons.length; j++) {
      polygons[i].union(polygons[j]).forEach((points) => {
        const polygon = new Polygon(points);
        polygon.draw(vectorSource, "green");
      });
    }
  });
}

function polygonDiffAB() {
  console.log("DIFF");
  if ($('#type').val() != 'Polygon' || polygons.length != 2) {
    return;
  }

  polygons[0].diff(polygons[1]).forEach((points) => {
    const polygon = new Polygon(points);
    polygon.draw(vectorSource, "yellow");
  });
}

function polygonDiffBA() {
  if ($('#type').val() != 'Polygon' || polygons.length != 2) {
    return;
  }

  polygons[1].diff(polygons[0]).forEach((points) => {
    const polygon = new Polygon(points);
    polygon.draw(vectorSource, "yellow");
  });
}

function addPointCoordinates(number) {
  const long = $('#long' + number).val();
  const lat = $('#lat' + number).val();
  if (long.length === 0 || lat.length === 0 || isNaN(long) || isNaN(lat)) {
    return;
  }

  pointsCoordinates.push([Number(long), Number(lat)]);
  addCoordinatesInputField(number + 1);
}

function submitFigure() {
  addPointCoordinates(maxCoordinatesInputFieldNumber); // если пользователь ввёл координаты и не нажал Add Dot

  const pointsWithFeatures = pointsCoordinates.map((p) => addPointFeature(p));

  if (pointsCoordinates.length === 1) {
    addDotToPoints(pointsWithFeatures[0][0], pointsWithFeatures[0][1]);
  } else if (pointsCoordinates.length === 2) {
    pointsCoordinates.forEach((p) => addDotToLines(p));
  } else {
    pointsCoordinates.forEach((p) => addDotToPolygon(p));
    closePolygon();
  }

  pointsCoordinates.clear();
  clearCoordinatesInputFields();
}

function addPointFeature(point) {
  const feature = new ol.Feature({
    geometry: new ol.geom.Point(ol.proj.transform(point, 'EPSG:4326', 'EPSG:3857'))
  });

  vectorSource.addFeature(feature);

  return [point, feature];
}

function clearAll() {
  console.log('clear');
  vectorSource.clear();
  tempPointsLongLat.clear();
  polygons.clear();
  arcs.clear();
  points.clear();
  pointsCoordinates.clear();
}

/**
 * Принимает порядковый номер поля, из которого формируются id
  * */
function addCoordinatesInputField(number) {
  maxCoordinatesInputFieldNumber = number;

  const btn = $('<button class="add_point_button" id="add' + number + '">Add dot</button>');
  btn.click(() => addPointCoordinates(number));

  const div = $('<div></div>')
    .append('<input id="lat' + number + '" placeholder="Latitude"/>')
    .append('<input id="long' + number + '" placeholder="Longtitude"/>')
    .append(btn);

  const elem = $('<li class="point_coordinates"></li>').append(div);

  $("#coordinates_input_list").append(elem);
}

function clearCoordinatesInputFields() {
  pointsCoordinates.clear();
  $(".point_coordinates").remove();
  addCoordinatesInputField(0);
  maxCoordinatesInputFieldNumber = 0;
}
