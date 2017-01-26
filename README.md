# Geo Primitives Drawing

Drawing and boolean operations with polygons on sphere

### Usage
1. ```npm install```
2. ```npm start```
3. Open index.html in browser

### Features

User can draw polygon on map using cursor or input accurate points coordinates in right menu. Using the cursor it is necessary to press ENTER key for close polygon. Polygon __must not be self-intersecting__!  
<img src="screenshots/s1.png" width="300"/>  
User can draw lines on sphere, press ENTER key and see intersection points.  
<img src="screenshots/s2.png" width="300"/>   
User can draw points, press ENTER key and see, what points are within polygons. _Warning!_ May not work correctly for polygons lying at the poles, because my algorithm is not perfect.  
<img src="screenshots/s3.png" width="300"/>    
User can perform boolean operations with two polygons.  
<img src="screenshots/s4.png" width="300"/>   
  
<img src="screenshots/s5.png" width="300"/>   
  
<img src="screenshots/s6.png" width="300"/>  

### Code
- ```arcs.js``` - lines rasterization and finding intersection point
- ```polygon.js``` - polygons drawing, point inside polygon checking (not perfect) and boolean operations by Weiler-Atherthon algorithm
- ```index.js``` - drawing figures with OpenLayers
- ```vector_features.js``` and ```geo-utils.js``` - accessory functions
