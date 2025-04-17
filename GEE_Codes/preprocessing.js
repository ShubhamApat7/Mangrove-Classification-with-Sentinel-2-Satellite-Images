// =============================================
// FIXED MANGROVE CLASSIFICATION WORKFLOW 
// =============================================

// 1. Load and verify points
// Make sure to set class labels
var Mangrove = ee.FeatureCollection(Mangrove).map(function(f) {
  return f.set('Class', 1);
});

var NonMangrove = ee.FeatureCollection(NonMangrove).map(function(f) {
  return f.set('Class', 0);
});

var allPoints = Mangrove.merge(NonMangrove);

print('Original points - Mangrove:', Mangrove.size(), 
      'Non-Mangrove:', NonMangrove.size());

// 2. Load CORRECT imagery (2023 data)
var image = ee.ImageCollection("COPERNICUS/S2_SR")
  .filterBounds(allPoints)
  .filterDate('2023-01-01', '2023-12-31') // Fixed date range
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 5))
  .select(['B2', 'B3', 'B4', 'B8', 'B11', 'MSK_CLDPRB'])
  .map(function(img){
    return img.updateMask(img.select('MSK_CLDPRB').lt(10));
  })
  .median();

Map.addLayer(image, {bands: ['B4', 'B3', 'B2'], min: 0, max: 3000}, 'RGB Composite');

// 3. Calculate indices
var ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI');
var ndwi = image.normalizedDifference(['B3', 'B8']).rename('NDWI');
var imageWithIndices = image.addBands([ndvi, ndwi]);

// Debug: Check bands
print('Final image bands:', imageWithIndices.bandNames());

// 4. Verify first image date
var firstImage = ee.Image(
  ee.ImageCollection("COPERNICUS/S2_SR")
    .filterBounds(allPoints)
    .filterDate('2023-01-01', '2023-12-31')
    .sort('system:time_start')
    .first()
);
print('First available image date:', ee.Date(firstImage.get('system:time_start')).format('YYYY-MM-dd'));

// 5. Filter valid points with data
var validPoints = allPoints.map(function(feat){
  var values = imageWithIndices.reduceRegion({
    reducer: ee.Reducer.first(),
    geometry: feat.geometry(),
    scale: 10,
    maxPixels: 1e9
  });
  return feat.set('hasData', values.keys().size().gt(0));
}).filter(ee.Filter.eq('hasData', 1));

print('Valid points count:', validPoints.size());
print('First few validPoints:', validPoints.limit(5));

// 6. Extract training samples
var trainingSamples = imageWithIndices.select(['B2', 'B3', 'B4', 'B8', 'B11', 'NDVI', 'NDWI'])
  .sampleRegions({
    collection: validPoints,
    properties: ['Class'],
    scale: 10
  });

print('Sampled training data:', trainingSamples.size());

// 7. Balanced data split
function balancedSplit(data) {
  var class0 = data.filter(ee.Filter.eq('Class', 0));
  var class1 = data.filter(ee.Filter.eq('Class', 1));
  var minCount = class0.size().min(class1.size());
  
  var trainSize = minCount.multiply(0.7).toInt();
  var valSize = minCount.multiply(0.3).toInt();

  return {
    train: class0.limit(trainSize).merge(class1.limit(trainSize)),
    val: class0.limit(valSize, trainSize).merge(class1.limit(valSize, trainSize))
  };
}

var split = balancedSplit(trainingSamples);
var trainData = split.train;
var valData = split.val;

print('Training samples:', trainData.size());
print('Validation samples:', valData.size());
print('Training class balance:', trainData.aggregate_histogram('Class'));
print('Validation class balance:', valData.aggregate_histogram('Class'));

// 8. Train classifier
var classifier = ee.Classifier.smileRandomForest(50)
  .train({
    features: trainData,
    classProperty: 'Class',
    inputProperties: ['B2', 'B3', 'B4', 'B8', 'B11', 'NDVI', 'NDWI']
  });

// 9. Classify and display
var classified = imageWithIndices.classify(classifier);
Map.centerObject(validPoints, 10);
Map.addLayer(classified.clip(allPoints.geometry().bounds()), 
             {min: 0, max: 1, palette: ['red', 'green']}, 
             'Mangroves Classification');
Map.addLayer(validPoints, {color: 'yellow'}, 'Valid Points');

Map.addLayer(classified, {min: 0, max: 1, palette: ['red', 'green']}, 'Mangrove Classification');

var validated = valData.classify(classifier);
var confMatrix = validated.errorMatrix('Class', 'classification');
print('Confusion Matrix:', confMatrix);
print('Overall Accuracy:', confMatrix.accuracy());
print('Kappa Coefficient:', confMatrix.kappa());

Export.image.toAsset({
  image: classified,
  description: 'Mangrove_Classification_Asset',
  assetId: 'users/shubhamapat24/mangrove_classification_2023',
  scale: 10,
  region: allPoints.geometry().bounds(),
  maxPixels: 1e13
});

Export.table.toDrive({
  collection: trainingSamples,
  description: 'Mangrove_Training_Data',
  fileFormat: 'CSV'
});

Export.classifier.toAsset({
  classifier: classifier,
  description: 'ExportMangroveClassifier',
  assetId: 'users/shubhamapat24/mangrove_classifier_v2'
});



