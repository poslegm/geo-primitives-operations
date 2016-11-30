const ol = require('openlayers');
const Arc = require('./arcs');
const Polygon = require('./polygon');
const utils = require('./geo-utils');
const $ = require('jquery');

const [vectorSource, map] = initMap();
const arcs = [];
const polygons = [];
const points = [];
const tempPointsLongLat = [];

const drawPoint = new ol.interaction.Draw({
  source: vectorSource,
  type: 'Point'
});
drawPoint.on('drawstart', addDot);

$("#type").change(selectAction);
$("#clear").click(clearAll);
$("#intersection_button").click(polygonsIntersection);

document.addEventListener('keydown', handleKeys, false);
map.addInteraction(drawPoint);

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

function coordinatesInput() {
  map.removeInteraction(drawPoint);
  addCoordinatesInputField();
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
  console.log("intersection");
  if ($('#type').val() != 'Polygon') {
    return;
  }

  console.log("intersection");

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
      polygons[i].union(polygons[j]);
    }
  });
}

function clearAll() {
  console.log('clear');
  vectorSource.clear();
  tempPointsLongLat.clear();
  polygons.clear();
  arcs.clear();
  points.clear();
}

function addCoordinatesInputField() {
  const div = $("div").add("input")//.add("input").add("button");
  const elem = $("li").add(div);
  $("#coordinates_list").append(elem);
}
