import React, { useEffect, useRef, useState } from 'react';
import { findTollsOnRoute, calculateTotalTollCost } from './tolls';

export default function RouteMapComponent({
  origin, // [lat, lon]
  destination, // [lat, lon]
  route,
  height = '400px'
}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [tollsOnRoute, setTollsOnRoute] = useState([]);
  const [selectedToll, setSelectedToll] = useState(null);
  const [showTollModal, setShowTollModal] = useState(false);

  // Calcular pedágios quando a rota carrega
  useEffect(() => {
    if (route && route.geometry && route.geometry.length > 0) {
      const tolls = findTollsOnRoute(route.geometry);
      setTollsOnRoute(tolls);
      console.log('Pedágios encontrados na rota:', tolls);
    }
  }, [route]);

  if (!origin || !destination || !Array.isArray(origin) || !Array.isArray(destination) || origin.length < 2 || destination.length < 2) {
    return (
      <div className="flex items-center justify-center bg-gray-100 rounded-lg border-2 border-dashed border-gray-300" style={{ height }}>
        <div className="text-center text-gray-500">
          <div className="text-4xl mb-2">🗺️</div>
          <p className="font-medium">Mapa da Rota</p>
          <p className="text-sm">Selecione origem e destino para visualizar</p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let isMounted = true;

    const loadLeaflet = async () => {
      if (!window.L) {
        return new Promise((resolve) => {
          if (document.querySelector('link[href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"]')) {
             // Se já existe, não adiciona de novo
          } else {
            const cssLink = document.createElement('link');
            cssLink.rel = 'stylesheet';
            cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            document.head.appendChild(cssLink);
          }

          const script = document.createElement('script');
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          script.onload = () => {
            delete window.L.Icon.Default.prototype._getIconUrl;
            window.L.Icon.Default.mergeOptions({
              iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
              iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
              shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
            });
            resolve();
          };
          document.head.appendChild(script);
        });
      }
    };

    const initMap = async () => {
      await loadLeaflet();
      if (!isMounted || !mapRef.current) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }

      const L = window.L;
      const map = L.map(mapRef.current);
      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);

      const routeLayers = L.featureGroup().addTo(map);

      // ✅ ÍCONES PERSONALIZADOS
      const originSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#22c55e" stroke="#ffffff" stroke-width="1"/>
        <circle cx="12" cy="9" r="3" fill="#ffffff"/>
        <path d="M10 9l2 2 4-4" stroke="#22c55e" stroke-width="2" fill="none"/>
      </svg>`;

      const destinationSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#ef4444" stroke="#ffffff" stroke-width="1"/>
        <circle cx="12" cy="9" r="4" fill="#ffffff"/>
        <circle cx="12" cy="9" r="3" fill="#ef4444"/>
        <circle cx="12" cy="9" r="2" fill="#ffffff"/>
        <circle cx="12" cy="9" r="1" fill="#ef4444"/>
      </svg>`;

      // ✅ NOVO ÍCONE PARA PEDÁGIOS
      const tollSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28">
        <circle cx="12" cy="12" r="10" fill="#f97316" stroke="#ffffff" stroke-width="2"/>
        <text x="12" y="16" text-anchor="middle" fill="white" font-size="12" font-weight="bold">R$</text>
      </svg>`;

      const originIcon = L.icon({
        iconUrl: `data:image/svg+xml;utf8,${encodeURIComponent(originSvg)}`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
      });

      const destinationIcon = L.icon({
        iconUrl: `data:image/svg+xml;utf8,${encodeURIComponent(destinationSvg)}`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
      });

      const tollIcon = L.icon({
        iconUrl: `data:image/svg+xml;utf8,${encodeURIComponent(tollSvg)}`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14]
      });

      // Adicionar marcadores
      routeLayers.addLayer(L.marker(origin, { icon: originIcon }).bindPopup('<b>🚀 Origem</b>'));
      routeLayers.addLayer(L.marker(destination, { icon: destinationIcon }).bindPopup('<b>🎯 Destino</b>'));

      if (route && route.geometry && route.geometry.length > 0) {
        // Desenhar a rota
        routeLayers.addLayer(L.polyline(route.geometry, { color: '#3b82f6', weight: 5, opacity: 0.7 }));

        // ✅ ADICIONAR MARCADORES DE PEDÁGIO COM CLIQUE
        tollsOnRoute.forEach((toll) => {
          const tollMarker = L.marker([toll.lat, toll.lon], { icon: tollIcon })
            .bindPopup(`
              <div class="text-center">
                <h4 class="font-bold text-orange-600">${toll.name}</h4>
                <p class="text-sm text-gray-600">${toll.city}/${toll.state}</p>
                <p class="text-sm font-medium">${toll.highway}</p>
                <div class="mt-2 space-y-1">
                  <p class="text-xs"><strong>Carro:</strong> R$ ${toll.car.toFixed(2)}</p>
                  <p class="text-xs"><strong>Caminhão:</strong> R$ ${toll.truck.toFixed(2)}</p>
                </div>
              </div>
            `)
            .on('click', () => {
              setSelectedToll(toll);
              setShowTollModal(true);
            });
          
          routeLayers.addLayer(tollMarker);
        });
      }
      
      setTimeout(() => {
        if (mapInstanceRef.current && routeLayers.getBounds().isValid()) {
          mapInstanceRef.current.invalidateSize();
          mapInstanceRef.current.fitBounds(routeLayers.getBounds().pad(0.1));
        }
      }, 10);
    };

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [origin, destination, route, tollsOnRoute]);

  const totalTollCost = calculateTotalTollCost(tollsOnRoute, 'truck');

  return (
    <>
      <div className="relative rounded-lg overflow-hidden border border-gray-300 shadow-sm">
        <div ref={mapRef} style={{ width: '100%', height, minHeight: '300px' }} className="bg-gray-100" />
        {route && (
          <div className="absolute top-2 right-2 bg-white bg-opacity-90 backdrop-blur-sm rounded-lg p-3 shadow-lg border z-[1000]">
            <div className="text-sm font-medium text-gray-800 space-y-2">
              <div className="flex items-center">
                <span className="text-blue-600 mr-2">📏</span>
                <span>Distância: {route.distance || 'N/A'} km</span>
              </div>
              <div className="flex items-center">
                <span className="text-green-600 mr-2">⏱️</span>
                <span>Duração: {route.duration ? `${Math.floor(route.duration / 60)}h ${Math.round(route.duration % 60)}m` : 'N/A'}</span>
              </div>
              {tollsOnRoute.length > 0 && (
                <div className="flex items-center pt-2 border-t mt-2">
                  <span className="text-orange-500 mr-2">💰</span>
                  <div>
                    <div>{tollsOnRoute.length} pedágio{tollsOnRoute.length > 1 ? 's' : ''}</div>
                    <div className="text-xs font-bold text-orange-600">
                      Total: R$ {totalTollCost.toFixed(2)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ✅ MODAL DETALHADO DO PEDÁGIO */}
      {showTollModal && selectedToll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-bold text-gray-800">Detalhes do Pedágio</h3>
              <button
                onClick={() => setShowTollModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">💰</span>
                </div>
                <h4 className="font-bold text-orange-600 text-xl">{selectedToll.name}</h4>
                <p className="text-gray-600">{selectedToll.city}/{selectedToll.state}</p>
                <p className="text-sm font-medium text-gray-700">{selectedToll.highway}</p>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4">
                <h5 className="font-semibold text-gray-800 mb-3">Valores do Pedágio</h5>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-blue-100 rounded">
                    <div className="text-sm text-gray-600">Carro</div>
                    <div className="text-lg font-bold text-blue-600">R$ {selectedToll.car.toFixed(2)}</div>
                  </div>
                  <div className="text-center p-3 bg-orange-100 rounded">
                    <div className="text-sm text-gray-600">Caminhão</div>
                    <div className="text-lg font-bold text-orange-600">R$ {selectedToll.truck.toFixed(2)}</div>
                  </div>
                </div>
              </div>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-xs text-yellow-800">
                  <strong>Localização:</strong> Lat: {selectedToll.lat.toFixed(4)}, Lon: {selectedToll.lon.toFixed(4)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}