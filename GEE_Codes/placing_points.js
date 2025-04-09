// =============================================
// MANGROVE TRAINING POINT COLLECTION TOOL
// =============================================

// 1. Define ROI - India
var india = ee.FeatureCollection("USDOS/LSIB_SIMPLE/2017")
  .filter(ee.Filter.eq('country_na', 'India'));
Map.centerObject(india, 6);

// 2. Load and preprocess Sentinel-2 imagery
var image = ee.ImageCollection("COPERNICUS/S2_SR")
  .filterBounds(india)
  .filterDate('2023-01-01', '2023-12-31') // Dry season
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10))
  .median()
  .clip(india);

// 3. Calculate important indices
var ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI');
var ndwi = image.normalizedDifference(['B3', 'B8']).rename('NDWI');
var mndwi = image.normalizedDifference(['B3', 'B11']).rename('MNDWI');
var imageWithIndices = image.addBands([ndvi, ndwi, mndwi]);

// 4. Visualization layers for guidance
Map.addLayer(image, {
  bands: ['B4', 'B3', 'B2'],
  min: 0,
  max: 3000,
  gamma: 1.2
}, 'True Color', true);

Map.addLayer(image, {
  bands: ['B8', 'B4', 'B3'],
  min: 0,
  max: 3000,
  gamma: 1.2
}, 'False Color', false);

Map.addLayer(imageWithIndices, {
  bands: ['B11', 'B8', 'B4'],
  min: 0,
  max: 3000
}, 'SWIR-NIR-Red (Mudflats)', false);

Map.addLayer(ndvi.subtract(ndwi), {
  min: -0.3,
  max: 0.3,
  palette: ['blue', 'white', 'red']
}, 'NDVI-NDWI (Forest vs Mangrove)', false);


Map.setOptions('HYBRID');

// INSTRUCTIONS FOR POINT PLACEMENT:
// 1. Open the "Geometry Imports" panel (top-left)
// 2. Click "+ new layer" and rename to "mangrove_points"
// 3. Set "Import as" to "FeatureCollection"
// 4. Use the point tool to place mangrove samples (Class 1)
// 5. Repeat for "non_mangrove_points" (Class 0)
// =============================================
