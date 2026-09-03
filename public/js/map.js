
document.addEventListener("DOMContentLoaded", () => {
    const mapContainer = document.getElementById("map");

    if (!mapContainer || typeof maplibregl === "undefined") {
        return;
    }

    const fallbackCoordinates = [77.209, 28.6139];
    const popupTitle = typeof listingTitle !== "undefined" ? listingTitle : "Listing";
    const popupText = typeof listingLocation !== "undefined" ? listingLocation : "Listing location";
    const hasMapTilerKey = typeof mapToken !== "undefined" && mapToken && mapToken !== "undefined";
    const osmStyle = {
        version: 8,
        sources: {
            osm: {
                type: "raster",
                tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
                tileSize: 256,
                attribution: "OpenStreetMap",
            },
        },
        layers: [
            {
                id: "osm",
                type: "raster",
                source: "osm",
            },
        ],
    };

    const map = new maplibregl.Map({
        container: "map",
        style: osmStyle,
        center: fallbackCoordinates,
        zoom: 9,
    });

    map.addControl(new maplibregl.NavigationControl());

    const addMarker = (coordinates) => {
        map.setCenter(coordinates);

        new maplibregl.Marker({ color: "#ff385c" })
            .setLngLat(coordinates)
            .setPopup(
                new maplibregl.Popup({ offset: 25 }).setHTML(
                    `<strong>${popupTitle}</strong><br>${popupText}`
                )
            )
            .addTo(map);
    };

    map.on("load", () => {
        map.resize();
    });

    map.on("error", () => {
        addMarker(fallbackCoordinates);
    });

    if (hasMapTilerKey && typeof listingLocation !== "undefined") {
        fetch(
            `https://api.maptiler.com/geocoding/${encodeURIComponent(listingLocation)}.json?key=${mapToken}&limit=1`
        )
            .then((res) => res.json())
            .then((data) => {
                const coordinates = data.features?.[0]?.center || fallbackCoordinates;
                addMarker(coordinates);
            })
            .catch(() => addMarker(fallbackCoordinates));
    } else {
        addMarker(fallbackCoordinates);
    }
});
