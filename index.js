const ol = require('openlayers');
const Arc = require('./arcs');
const Polygon = require('./polygon');
const utils = require('./geo-utils');

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

const typeSelect = document.getElementById('type');
typeSelect.onchange = selectAction();
const clearButton = document.getElementById('clear');
clearButton.onclick = clearAll;

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
  if (typeSelect.value === 'Polygon' || typeSelect.value === 'Line' || typeSelect.value === 'Point') {
    map.addInteraction(drawPoint);
  } else if (typeSelect.value === 'Square') {
    map.removeInteraction(drawPoint);
  }
}

function addDot(e) {
  coords = e.feature.getGeometry().getCoordinates();
  longLat = ol.proj.transform(coords, 'EPSG:3857', 'EPSG:4326');

  if (typeSelect.value === 'Polygon') {
    addDotToPolygon(longLat);
  } else if (typeSelect.value === 'Line') {
    addDotToLines(longLat);
  } else if (typeSelect.value === 'Point') {
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
    if (typeSelect.value === 'Line') {
      computeAllArcsIntersections();
    } else if (typeSelect.value === 'Polygon') {
      closePolygon();
    } else if (typeSelect.value === 'Point') {
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
      console.log("inside");
      const coloredPoint = new ol.style.Circle({
        radius: 5,
        stroke: new ol.style.Stroke({color: 'red', width: 2})
      });
      feature.setStyle(new ol.style.Style({image: coloredPoint}));
    }
  }));
}

function clearAll() {
  console.log('clear');
  vectorSource.clear();
  tempPointsLongLat.clear();
  polygons.clear();
  arcs.clear();
  points.clear();
}

