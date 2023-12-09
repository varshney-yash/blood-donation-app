var map = L.map('map', {
    center: [20.5937, 78.9629],
    zoom: 5,
    maxBounds: L.latLngBounds(L.latLng(6, 68), L.latLng(37, 97)) 
});

var coordinatesList = []; 
var markers = L.layerGroup().addTo(map); 

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

var searchControl = L.control.search({
    position: 'topright',
    layer: L.layerGroup().addTo(map),
    propertyName: 'name',
    initial: false,
    zoom: 12,
    marker: false,
    moveToLocation: function (latlng, title, map) {
        map.setView(latlng, 12);
    }
});

searchControl.on('search:locationfound', function(e) {
    e.layer.openPopup();
});

map.addControl(searchControl);

L.Control.geocoder().addTo(map);

map.on('click', function(e) {
    collectCoordinates(e.latlng);
});

async function initializeMap() {
    try {
        const getPrefEndpoint = '/api/getPref';
        const response = await fetch(getPrefEndpoint, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const data = await response.json();

        if (data.success) {
            coordinatesList = data.data || [];

            coordinatesList.forEach(coord => {
                if (coord.lat !== undefined && coord.lng !== undefined) {
                    var marker = L.marker([coord.lat, coord.lng]);
                    markers.addLayer(marker);
                }
            });

            updateCoordinatesList();
        } else {
            console.error("Failed to fetch preferences:", data.message);
        }
    } catch (error) {
        console.error("Error while fetching preferences:", error.message);
    }
}

document.addEventListener('DOMContentLoaded', initializeMap);

function collectCoordinates(clickedCoordinates) {
    var isWithinRadius = checkDistance(clickedCoordinates);

    if (!isWithinRadius) {
        var locationName = getLocationName(clickedCoordinates, function(name) {
            coordinatesList.push({
                lat: clickedCoordinates.lat,
                lng: clickedCoordinates.lng,
                name: name || 'Custom Location' 
            });

            var marker = L.marker(clickedCoordinates);
            markers.addLayer(marker);

            updateCoordinatesList();

            console.log("Coordinates List:", coordinatesList);
        });
    } else {
        alert("Coordinates should be at least 10 km apart.");
    }
}

function checkDistance(newCoordinate) {
    for (var i = 0; i < coordinatesList.length; i++) {
        if (coordinatesList[i].lat && coordinatesList[i].lng) {
            var distance = map.distance(newCoordinate, coordinatesList[i]);
            if (distance < 10000) { 
                return true; 
            }
        }
    }
    return false; 
}

function updateCoordinatesList() {
    var coordinatesListElement = document.getElementById('coordinates-list');
    coordinatesListElement.innerHTML = '';

    coordinatesList.forEach(function(coordinate, index) {
        var listItem = document.createElement('li');
        listItem.className = 'coordinate-item';

        // Check if lat, lng, and name properties are defined
        var latText = coordinate.lat !== undefined ? `Lat: ${coordinate.lat.toFixed(4)}` : 'Lat: N/A';
        var lngText = coordinate.lng !== undefined ? `Lng: ${coordinate.lng.toFixed(4)}` : 'Lng: N/A';
        var nameText = coordinate.name !== undefined ? coordinate.name : 'Custom Location';

        listItem.innerHTML = `
            <span>${index + 1}. ${nameText} - ${latText}, ${lngText}</span>
            <span class="delete-button" onclick="deleteCoordinate(${index})">&#10006;</span>
        `;

        coordinatesListElement.appendChild(listItem);
    });
}

function deleteCoordinate(index) {
    markers.eachLayer(function (layer) {
        if (layer._latlng.lat === coordinatesList[index].lat && layer._latlng.lng === coordinatesList[index].lng) {
            markers.removeLayer(layer);
        }
    });

    coordinatesList.splice(index, 1);

    updateCoordinatesList();

    console.log("Coordinates List:", coordinatesList);
}

async function submitPreference() {
    try {
        const endpoint = '/api/updatePref';
        const preferences = coordinatesList.map(coord => ({
            lat: coord.lat,
            lng: coord.lng,
            name: coord.name
        }));

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ preferences }),
        });

        const data = await response.json();

        if (data.success) {
            console.log("Preferences updated successfully:", data.message);
        } else {
            console.error("Failed to update preferences:", data.message);
        }
    } catch (error) {
        console.error("Error while updating preferences:", error.message);
    }
}

function getLocationName(latlng, callback) {
    var url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latlng.lat}&lon=${latlng.lng}&zoom=18&addressdetails=1`;
    fetch(url)
        .then(response => response.json())
        .then(data => {
            var name = data.display_name || '';
            callback(name);
        })
        .catch(error => {
            console.error('Error fetching location name:', error);
            callback('');
        });
}
