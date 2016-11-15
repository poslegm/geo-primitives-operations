const ol = require('openlayers');
const Arc = require('./arcs');
const Polygon = require('./polygon');
const utils = require('./geo-utils');

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

const [vectorSource, map] = initMap();
const arcs = [];
const polygons = [];
const pointsLongLat = [];

draw = new ol.interaction.Draw({
  source: vectorSource,
  type: 'Point'
});

const typeSelect = document.getElementById('type');
typeSelect.onchange = function() {
  clearAll();
};

draw.on('drawstart', addDot);
document.addEventListener('keydown', handleKeys, false);
map.addInteraction(draw);

function addDot(e) {
  coords = e.feature.getGeometry().getCoordinates();
  longLat = ol.proj.transform(coords, 'EPSG:3857', 'EPSG:4326');

  if (typeSelect.value === 'Polygon') {
    addDotToPolygon(longLat);
  } else if (typeSelect.value === 'Line') {
    addDotToLines(longLat);
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
  if (pointsLongLat.length === 1) {
    const newArc = new Arc(pointsLongLat[0], point);
    newArc.draw(vectorSource);
    arcs.push(newArc);
    pointsLongLat.clear();
  } else {
    pointsLongLat.push(point);
  }
}

function handleKeys(event) {
  // ENTER key
  if (event.keyCode === 13) {
    if (typeSelect.value === 'Line') {
      computeAllArcsIntersections();
    } else if (typeSelect.value === 'Polygon') {
      closePolygon();
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

function clearAll() {
  vectorSource.clear();
  pointsLongLat.clear();
  polygons.clear();
  arcs.clear();
}

