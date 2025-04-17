import streamlit as st
from streamlit_folium import st_folium
import folium
import ee

# Initialize Earth Engine
try:
    ee.Initialize(project='ee-shubhamapat24')
except:
    ee.Authenticate()
    ee.Initialize(project='ee-shubhamapat24')

# Load pre-classified image
classified = ee.Image('users/shubhamapat24/mangrove_classification_2023')

# Get tile URL for visualization
def get_ee_tile_url(ee_image):
    map_id = ee_image.getMapId({'min': 0, 'max': 1, 'palette': ['red', 'green']})
    return map_id['tile_fetcher'].url_format

tile_url = get_ee_tile_url(classified)

# Streamlit app
st.set_page_config(layout="wide")
st.title("🌿 Click-to-Classify Mangrove Detector")


col1, col2 = st.columns([2, 1])

with col1:
    # Create Folium map centered on India
    m = folium.Map(location=[21.95, 88.5], zoom_start=6, control_scale=True)
    
    # basemap options
    folium.TileLayer("OpenStreetMap", name="Default Map").add_to(m)

    # Terrain View with proper attribution
    folium.TileLayer(
        tiles='https://stamen-tiles.a.ssl.fastly.net/terrain/{z}/{x}/{y}.jpg',
        attr='Map tiles by Stamen Design, under CC BY 3.0. Data by OpenStreetMap, under ODbL.',
        name='Terrain'
    ).add_to(m)

    # Satellite View
    folium.TileLayer(
        tiles='https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
        attr='Imagery © Google',
        name='Satellite View',
        subdomains=['mt0', 'mt1', 'mt2', 'mt3'],
        max_zoom=20
    ).add_to(m)


    # classified mangrove layer
    folium.TileLayer(
        tiles=tile_url,
        attr='Google Earth Engine',
        name='Mangrove Classification',
        overlay=True,
        control=True
    ).add_to(m)

    # Layer control
    folium.LayerControl().add_to(m)

    # click functionality
    m.add_child(folium.LatLngPopup())

    # Display the map
    map_data = st_folium(m, height=600, width=800)

with col2:
    st.subheader("How to Use")
    st.markdown("""
    1. Click anywhere on the map  
    2. See if it's mangrove (🌿) or not (🏖️)  
    3. Green areas = mangroves  
    4. Red areas = non-mangroves  
    5. Switch to **Satellite View** for real imagery  
    """)

    # Display clicked point info
    if map_data and map_data.get("last_clicked"):
        lat = map_data["last_clicked"]["lat"]
        lon = map_data["last_clicked"]["lng"]

        # Get classification at clicked point
        point = ee.Geometry.Point(lon, lat)

        with st.spinner('Classifying...'):
            sample = classified.reduceRegion(
                reducer=ee.Reducer.first(),
                geometry=point,
                scale=10
            ).getInfo()

            prediction = sample.get('classification', 0)

            if prediction == 1:
                st.success(f"""
                **Mangrove Detected!**   
                - Latitude: `{lat:.4f}`  
                - Longitude: `{lon:.4f}`  
                """)
            else:
                st.warning(f"""
                **Non-Mangrove Area**   
                - Latitude: `{lat:.4f}`  
                - Longitude: `{lon:.4f}`  
                """)
    else:
        st.info("Click on the map to classify a location")

# Statistics section
st.subheader("Mangrove Statistics")
with st.spinner('Calculating...'):
    stats = classified.reduceRegion(
        reducer=ee.Reducer.sum(),
        geometry=ee.Geometry.Rectangle([68, 6, 98, 36]),  
        scale=10,
        maxPixels=1e13
    ).getInfo()
    mangrove_area = stats.get('classification', 0) * 100 / 1e6  
    st.metric("Total Mangrove Area in India", f"{mangrove_area:,.2f} km²")
