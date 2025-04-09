// =============================================
// COMPLETE MANGROVE POINT EXPORT TOOL 
// =============================================

// 1. Load point collections
var Mangrove = ee.FeatureCollection(Mangrove);  
var NonMangrove = ee.FeatureCollection(NonMangrove);  

// 2. Add timestamp and additional metadata 
var now = new Date();  
var exportDate = ee.Date(now.getTime()); 

var final_mangrove = Mangrove.map(function(feat) {
  return feat
    .set('export_date', exportDate.format('YYYY-MM-dd'))
    .set('source', 'GEE Manual Digitization')
    .set('project', 'Sundarbans Mangroves 2024')
    .set('Class', 1);
});

var final_non_mangrove = NonMangrove.map(function(feat) {
  return feat
    .set('export_date', exportDate.format('YYYY-MM-dd'))
    .set('source', 'GEE Manual Digitization')
    .set('project', 'Sundarbans Mangroves 2024')
    .set('Class', 0);
});

// 3. Export with ALL properties
Export.table.toDrive({
  collection: final_mangrove,
  description: 'Mangrove_Points_Full_Export',
  fileFormat: 'CSV',
  folder: 'Mangrove_Project'
});

Export.table.toDrive({
  collection: final_non_mangrove,
  description: 'NonMangrove_Points_Full_Export',
  fileFormat: 'CSV',
  folder: 'Mangrove_Project'
});

// 4. Combined GeoJSON export
var all_points = final_mangrove.merge(final_non_mangrove);
Export.table.toDrive({
  collection: all_points,
  description: 'All_Training_Points_Combined',
  fileFormat: 'GeoJSON',
  folder: 'Mangrove_Project'
});

// 5. Asset backup (CHANGE YOUR_USERNAME)
Export.table.toAsset({
  collection: all_points,
  description: 'Mangrove_Points_Asset_Backup',
  assetId: 'users/shubhamapat24/MangroveClassification'
});

// =============================================
// VERIFICATION
// =============================================
print('Export date:', exportDate.format('YYYY-MM-dd'));
print('Mangrove points sample:', final_mangrove.limit(1));
print('NonMangrove points sample:', final_non_mangrove.limit(1));

// Visual verification
Map.addLayer(final_mangrove, {color: '00FF00'}, 'Mangrove');
Map.addLayer(final_non_mangrove, {color: 'FF0000'}, 'Non-Mangrove');
