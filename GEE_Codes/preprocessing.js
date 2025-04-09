// =============================================
// ROBUST MANGROVE CLASSIFICATION WORKFLOW
// =============================================

// 1. Load and verify points
var Mangrove = ee.FeatureCollection(Mangrove);  
var NonMangrove = ee.FeatureCollection(NonMangrove);  
var allPoints = Mangrove.merge(NonMangrove);

print('Original points - Mangrove:', Mangrove.size(), 
      'Non-Mangrove:', NonMangrove.size());

// 2. Load optimized imagery 
var image = ee.ImageCollection("COPERNICUS/S2_SR")
  .filterBounds(allPoints) 
  .filterDate('2023-01-01', '2023-12-31')
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 5))
 
  .select(['B2', 'B3', 'B4', 'B8', 'B11', 'MSK_CLDPRB'])
  .map(function(img){
   
    return img.updateMask(img.select('MSK_CLDPRB').lt(10));
  })
  .median();

// 3. Add indices
var ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI');
var ndwi = image.normalizedDifference(['B3', 'B8']).rename('NDWI');
var imageWithIndices = image.addBands([ndvi, ndwi]);

// 4. Verify image availability
var imageCollection = ee.ImageCollection("COPERNICUS/S2_SR")
  .filterBounds(allPoints)
  .filterDate('2023-01-01', '2023-12-31')
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 5))
  .select(['B2', 'B3', 'B4', 'B8', 'B11', 'MSK_CLDPRB'])
  .map(function(img){
    return img.updateMask(img.select('MSK_CLDPRB').lt(10));
  });

var image = imageCollection.median();

var firstDate = ee.Image(imageCollection.first()).get('system:time_start');
print('First available image date:', ee.Date(firstDate).format('YYYY-MM-dd'));


// 5. Point validation with error handling
var validPoints = allPoints.map(function(feat){
  var point = feat.geometry();
  try {
    var values = imageWithIndices.reduceRegion({
      reducer: ee.Reducer.first(),
      geometry: point,
      scale: 10,
      maxPixels: 1e9
    });
    var isValid = values.keys().size().gt(0);
    return feat.set({
      'hasData': isValid,
      'B4_value': values.get('B4'),
      'NDVI_value': values.get('NDVI')
    });
  } catch (e) {
    return feat.set('hasData', 0);
  }
});

// 6. Filter and count valid points
var filteredPoints = validPoints.filter(ee.Filter.eq('hasData', 1));
print('Valid points:', filteredPoints.size());

// 7. Sample regions with backup for empty results
var bands = ['B2', 'B3', 'B4', 'B8', 'B11', 'NDVI', 'NDWI'];

var hasValidPoints = filteredPoints.size().gt(0);


var trainingSamples = imageWithIndices.select(bands)
  .sampleRegions({
    collection: filteredPoints,
    properties: ['Class'],
    scale: 10,
    tileScale: 16
  });

// 8. Split data
var split = trainingSamples.randomColumn();
var trainData = split.filter(ee.Filter.lt('random', 0.7));
var valData = split.filter(ee.Filter.gte('random', 0.7));

// 9. Verify counts
print('=== FINAL COUNTS ===');
print('Training samples (70%):', trainData.size());
print('Validation samples (30%):', valData.size());

// 10. Visual checks
Map.addLayer(trainData.filter(ee.Filter.eq('Class', 1))
  .style({color: '00FF00', pointSize: 5}), {}, 'Mangrove-Train');
Map.addLayer(valData.filter(ee.Filter.eq('Class', 1))
  .style({color: '007700', pointSize: 5}), {}, 'Mangrove-Val');
